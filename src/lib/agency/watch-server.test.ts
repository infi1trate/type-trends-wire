// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createRateLimiter } from "../mcp/rate-limit";
import { sha256Hex } from "../gate";
import { createWatch, editWatch, checkEdit, feedItems, handleWatchFeed, viewWatch, type WatchDeps, type WatchRecord, type WatchStore } from "./watch.server";
import { TOKEN_RE } from "./watch";
import type { WatchRows } from "./watch-feed";

function memStore(active = ["linear.app", "vercel.com", "supabase.com"], traits = ["css:subgrid", "theme:dark"]) {
  const rows = new Map<string, WatchRecord>(), queued: string[] = [];
  const act = new Set(active);
  const store: WatchStore = {
    insert: async r => void rows.set(r.id, { ...r }),
    get: async id => (rows.has(id) ? { ...rows.get(id)! } : null),
    byFeed: async t => [...rows.values()].find(r => r.feed_token === t) ?? null,
    update: async (id, p) => { const r = rows.get(id); if (!r) return null; const n = { ...r, ...p }; rows.set(id, n); return { ...n }; },
    remove: async id => void rows.delete(id),
    touch: async (id, at) => { const r = rows.get(id); if (r) r.last_viewed_at = at; },
    activeDomains: async ds => new Set(ds.filter(d => act.has(d))),
    traitKeys: async ks => new Set(ks.filter(k => traits.includes(k))),
    queueRenders: async ds => void queued.push(...ds),
  };
  return { store, rows, queued, act };
}
const now = () => new Date("2026-11-15T12:00:00Z");
const load = async (w: WatchRows["watch"], n: Date): Promise<WatchRows> => ({ watch: w, now: n.toISOString(), events: [{ id: 7, domain: "linear.app", type: "theme_flip", before: { theme: "light" }, after: { theme: "dark" }, detected_at: "2026-11-14T10:00:00Z" }], rebrands: [], runs: [], stages: [], alerts: [], siteTraits: {}, sites: [], thumbs: [], traitsNow: [], lastEvent: null });
const deps = (m = memStore(), limit = 1000): WatchDeps & { m: typeof m } => ({ store: m.store, allow: createRateLimiter(limit, 3600000), now, load, m });

describe("watchlist server", () => {
  it("creates with three distinct capability tokens and stores only the edit token's hash", async () => {
    const d = deps();
    const r = await createWatch({ name: "Acme", sites: ["linear.app", "newco.io"], traits: ["css:subgrid"], request_render: true }, "1.1.1.1", d);
    if (!r.ok) throw new Error(r.message);
    const rec = d.m.rows.get(r.id)!;
    for (const t of [r.id, r.edit_token, rec.feed_token]) expect(t).toMatch(TOKEN_RE);
    expect(new Set([r.id, r.edit_token, rec.feed_token]).size).toBe(3);
    expect(rec.edit_token_sha256).toBe(await sha256Hex(r.edit_token));
    expect(JSON.stringify(rec)).not.toContain(r.edit_token);
    expect(JSON.stringify(r.watch)).not.toContain(rec.edit_token_sha256);
    expect(rec.sites).toEqual(["linear.app"]);
    expect(rec.pending_sites).toEqual(["newco.io"]);
    expect(d.m.queued).toEqual(["newco.io"]);
    expect(r.edit_url).toContain(`/watch/${r.id}?k=${r.edit_token}`);
  });

  it("edits need the edit token; wrong tokens and unknown ids look the same", async () => {
    const d = deps();
    const r = await createWatch({ name: "Acme", sites: ["linear.app"] }, "ip", d);
    if (!r.ok) throw new Error();
    const wrong = await editWatch({ id: r.id, token: "x".repeat(22), op: { op: "rename", name: "Hacked" } }, "ip", d);
    const unknown = await editWatch({ id: "y".repeat(22), token: r.edit_token, op: { op: "rename", name: "Hacked" } }, "ip", d);
    const feedAsEdit = await editWatch({ id: r.id, token: d.m.rows.get(r.id)!.feed_token, op: { op: "delete" } }, "ip", d);
    expect(wrong).toEqual(unknown);
    expect(feedAsEdit).toEqual(unknown);
    expect(wrong).toMatchObject({ ok: false, error: "not_found", message: "Not found." });
    expect(d.m.rows.get(r.id)!.name).toBe("Acme");
    expect(await checkEdit({ id: r.id, token: r.edit_token }, "ip", d)).toBe(true);
    expect(await checkEdit({ id: r.id, token: "x".repeat(22) }, "ip", d)).toBe(false);
    const ok = await editWatch({ id: r.id, token: r.edit_token, op: { op: "add", sites: ["vercel.com"], traits: ["theme:dark"] } }, "ip", d);
    expect(ok.ok && "watch" in ok && ok.watch.sites).toEqual(["linear.app", "vercel.com"]);
  });

  it("limits creates and edits to 20 per hour per IP", async () => {
    const d = deps(memStore(), 20);
    for (let i = 0; i < 20; i++) expect((await createWatch({ name: `L${i}` }, "9.9.9.9", d)).ok).toBe(true);
    const r = await createWatch({ name: "L21" }, "9.9.9.9", d);
    expect(r).toMatchObject({ ok: false, error: "rate_limited" });
    expect((await createWatch({ name: "other ip" }, "8.8.8.8", d)).ok).toBe(true);
  });

  it("rotating the feed token makes the old feed 404 and the new one serve RSS", async () => {
    const d = deps();
    const r = await createWatch({ name: "Acme", sites: ["linear.app"] }, "ip", d);
    if (!r.ok) throw new Error();
    const old = d.m.rows.get(r.id)!.feed_token;
    expect((await handleWatchFeed(`${old}.xml`, d)).status).toBe(200);
    const rot = await editWatch({ id: r.id, token: r.edit_token, op: { op: "rotate_feed" } }, "ip", d);
    expect(rot.ok).toBe(true);
    const fresh = d.m.rows.get(r.id)!.feed_token;
    expect(fresh).not.toBe(old);
    const gone = await handleWatchFeed(`${old}.xml`, d);
    expect(gone.status).toBe(404);
    expect(await gone.text()).toBe("Not found");
    const res = await handleWatchFeed(`${fresh}.xml`, d);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/rss+xml; charset=utf-8");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    expect(res.headers.get("cache-control")).toBe("public, max-age=900");
    expect(await feedItems(old, d)).toBeNull();
    expect((await feedItems(fresh, d))!.items[0]!.title).toBe("Linear switched to a dark theme (was light)");
  });

  it("unknown or malformed tokens and ids → 404 / null without detail", async () => {
    const d = deps();
    for (const p of ["nope.xml", `${"z".repeat(22)}.xml`, "../../etc"]) {
      const res = await handleWatchFeed(p, d);
      expect(res.status).toBe(404);
      expect(await res.text()).toBe("Not found");
    }
    expect(await viewWatch("z".repeat(22), "week", d)).toBeNull();
    expect(await viewWatch("bad id", "week", d)).toBeNull();
  });

  it("deleting stops view, edit and feed links", async () => {
    const d = deps();
    const r = await createWatch({ name: "Acme" }, "ip", d);
    if (!r.ok) throw new Error();
    const feed = d.m.rows.get(r.id)!.feed_token;
    expect(await editWatch({ id: r.id, token: r.edit_token, op: { op: "delete" } }, "ip", d)).toEqual({ ok: true, deleted: true });
    expect(await viewWatch(r.id, "week", d)).toBeNull();
    expect((await handleWatchFeed(`${feed}.xml`, d)).status).toBe(404);
  });

  it("promotes pending sites on view once they are tracked", async () => {
    const d = deps();
    const r = await createWatch({ name: "Acme", sites: ["newco.io"], request_render: true }, "ip", d);
    if (!r.ok) throw new Error();
    d.m.act.add("newco.io");
    const v = await viewWatch(r.id, "week", d);
    expect(v!.sites.map(s => s.domain)).toEqual(["newco.io"]);
    expect(v!.pending).toEqual([]);
  });
});
