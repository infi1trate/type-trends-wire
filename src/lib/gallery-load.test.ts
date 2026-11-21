// A cold /patterns view against an in-memory stand-in for the public database, sized like the live library (300 brands, ~1,430
// quarterly samples, ~2,460 home captures, ~1,390 forecast rows): counts every request and how many run at once.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const db: { tables: Record<string, Row[]>; requests: string[]; live: number; peak: number; failNext: Set<string> } = { tables: {}, requests: [], live: 0, peak: 0, failNext: new Set() };
function query(table: string) {
  const f: ((r: Row) => boolean)[] = []; let lo = 0, hi = Infinity;
  const q = {
    select: () => q, order: () => q, not: () => q,
    eq: (c: string, v: unknown) => (f.push(r => r[c] === v), q),
    in: (c: string, vs: unknown[]) => (f.push(r => vs.includes(r[c])), q),
    gte: (c: string, v: string) => (f.push(r => String(r[c]) >= v), q),
    lte: (c: string, v: number) => (f.push(r => (r[c] as number) <= v), q),
    lt: (c: string, v: string) => (f.push(r => String(r[c]) < v), q),
    range: (a: number, b: number) => ((lo = a), (hi = b), q),
    // The history keyset walk: rows after (domain, quarter), as `afterKey` writes it.
    or: (expr: string) => {
      const m = /^domain\.gt\."(.*)",and\(domain\.eq\."(.*)",quarter\.gt\."(.*)"\)$/.exec(expr);
      if (!m) throw new Error(`unexpected or(): ${expr}`);
      const [, d, , qu] = m as unknown as [string, string, string, string];
      f.push(r => String(r["domain"]) > d || (r["domain"] === d && String(r["quarter"]) > qu));
      return q;
    },
    limit: (n: number) => ((hi = lo + n - 1), q),
    then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => {
      db.requests.push(table); db.live++; db.peak = Math.max(db.peak, db.live);
      return new Promise(r => setTimeout(r, 1)).then(() => {
        db.live--;
        if (db.failNext.delete(table)) return { data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } };
        const rows = (db.tables[table] ?? []).filter(r => f.every(g => g(r)));
        return { data: rows.slice(lo, Math.min(hi + 1, lo + 1000)), error: null };
      }).then(ok, bad);
    },
  };
  return q;
}
vi.mock("@/lib/mcp/supabase", () => ({ supabaseAnon: () => ({ from: query }) }));
// The suite's setup stubs the signal snapshot; this test reads it through the stand-in database like the real page does.
vi.mock("@/lib/signals.server", async orig => await orig());
vi.mock("@/lib/patterns", async orig => ({ ...(await orig<typeof import("./patterns")>()), isPatternSignal: (s: { key: string }) => s.key === "hero_media:video" }));

const SECTORS = ["fintech", "dev-tools", "health", "media"];
function seed() {
  const sites = Array.from({ length: 300 }, (_, i) => ({ domain: `${"abcdefghijklmnopqrstuvwxyz"[i % 26]}${i}.com`, name: `Brand ${i}`, sector: SECTORS[i % 4], active: true }));
  const history: Row[] = [], snaps: Row[] = [];
  let id = 1;
  for (const s of sites) for (let q = 0; q < 8 && history.length < 1433; q++) {
    const at = new Date(Date.UTC(2025, q * 3, 15)).toISOString();
    snaps.push({ id, domain: s.domain, page_type: "home", viewport: "desktop", source: "live", captured_at: at, page: { w: 1280, h: 900 }, color: null, skeleton: [{ kind: "heading", x: 0, y: 0, w: 200, h: 40 }] });
    if (q < 5) history.push({ domain: s.domain, quarter: `${2025 + Math.floor(q / 4)}Q${(q % 4) + 1}`, captured_at: at, source: "live", now: q === 4, snapshot_id: id, sector: s.sector, hero_media: "video", theme: "dark", css_features: [], frameworks: {}, ai_tags: {} });
    id++;
  }
  const runs = Array.from({ length: 15 }, (_, i) => ({ id: i + 1, status: "ok", computed_at: new Date(Date.UTC(2026, 0, 1 + i * 7)).toISOString() }));
  const forecasts: Row[] = [];
  for (const run of [13, 14, 15]) for (let k = 0; k < (run === 15 ? 1386 : 200); k++)
    forecasts.push({ run_id: run, scope: k < 200 ? "all" : SECTORS[k % 4], dimension: k === 0 ? "hero_media" : "x", value: k === 0 ? "video" : `v${k}`, status: "ok", stage: "Rising", momentum: 1, current_share: 0.5, next_wave_score: 1, present: [], sites: 100, usable: true });
  db.tables = { library_sites: sites, library_site_history_rows: history.sort((a, b) => String(a["domain"]) < String(b["domain"]) ? -1 : String(a["domain"]) > String(b["domain"]) ? 1 : String(a["quarter"]) < String(b["quarter"]) ? -1 : 1), library_snapshots: snaps, site_crops: [], forecast_runs: runs,
    weekly_briefs: [13, 14, 15].map(run_id => ({ run_id })), chart_cards: [], forecast_calls: [], forecasts, library_events: [] };
  db.requests = []; db.live = 0; db.peak = 0; db.failNext = new Set();
}

/** A cold /patterns view may make at most this many database requests (it made 66 before Phase 20b), at most six at a time. */
const COLD_BUDGET = 18;
describe("a cold gallery view", () => {
  beforeEach(() => { vi.resetModules(); seed(); });
  it(`reads the database at most ${COLD_BUDGET} times, never more than six at once`, async () => {
    const { loadGallery } = await import("./gallery.server"), { NO_FILTER } = await import("./gallery");
    const g = await loadGallery(NO_FILTER);
    expect(g.tiles.length).toBe(48);
    expect(g.tiles.every(t => t.frame !== null)).toBe(true);
    expect(db.requests.length).toBeLessThanOrEqual(COLD_BUDGET);
    expect(db.peak).toBeLessThanOrEqual(6);
    expect(db.requests).not.toContain("library_events"); // no change stamps unless the view is a "changed" view
    expect(db.requests.filter(t => t === "library_site_history_rows").length).toBe(2); // keyset walk: one per 1,000 stored rows
    db.requests = [];
    await loadGallery(NO_FILTER); expect(db.requests).toEqual([]); // the settled view is reused
  });
  it("a statement timeout on the first history read is retried inside the loader", async () => {
    db.failNext.add("library_site_history_rows");
    const { loadGallery } = await import("./gallery.server"), { NO_FILTER } = await import("./gallery");
    const g = await loadGallery(NO_FILTER);
    expect(g.total).toBeGreaterThan(48);
  });
  it("a load that still fails rejects, and the next request loads again and succeeds", async () => {
    const { loadGallery } = await import("./gallery.server"), { NO_FILTER } = await import("./gallery");
    const real = db.failNext.delete.bind(db.failNext);
    db.failNext.delete = (k: string) => k === "site_crops" || real(k); // the crops read fails every time, retries included
    await expect(loadGallery(NO_FILTER)).rejects.toMatchObject({ code: "57014" });
    db.failNext.delete = real;
    await expect(loadGallery(NO_FILTER)).resolves.toMatchObject({ page: 1 });
  });
  it("a changed view reads the change stamps too", async () => {
    const { loadGallery } = await import("./gallery.server"), { NO_FILTER } = await import("./gallery");
    await loadGallery({ ...NO_FILTER, changed: 30 });
    expect(db.requests).toContain("library_events");
  });
});
