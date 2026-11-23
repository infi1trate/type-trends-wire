// The record refresh keeps to its deadline: a crawl batch only rewrites its own brands' cards, and a slow step can never hold a call
// past the deadline (fake steps, fake clock where the clock matters).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { refreshRecords, resetStepEstimates, type RefreshDeps } from "./refresh.server";

vi.mock("./store.server", () => ({ recordMetas: async () => { throw new Error("real store must not be used"); }, writeRecords: async () => { throw new Error("real store must not be used"); } }));

const SITES = Array.from({ length: 300 }, (_, i) => ({ domain: `b${i}.com`, sector: "saas", last_snapshot_at: "2026-11-20T09:00:00Z" }));
function fakes(over: Partial<RefreshDeps> = {}) {
  const calls: string[] = [], written: string[] = [];
  const deps: RefreshDeps = {
    metas: async () => { calls.push("metas"); return []; }, // nothing stored yet: every shared record is due
    checks: async () => new Map(), signalsChanged: async () => null,
    write: async rows => { written.push(...rows.map(r => r.key)); return rows.map(r => r.key); },
    card: async d => { calls.push(`card ${d}`); return { d }; },
    shared: async k => { calls.push(`shared ${k}`); return {}; },
    sites: async () => { calls.push("sites"); return SITES; },
    similar: async s => { calls.push("similar"); return s.map(x => ({ key: `brand-similar:${x.domain}`, body: {} })); },
    sector: async s => { calls.push("sector"); return s.map(x => ({ key: `brand-sector:${x.domain}`, body: {} })); },
    pageKeys: async () => { calls.push("page-keys"); return ["brands-index", "data-index"]; },
    page: async k => { calls.push(`page ${k}`); return {}; },
    ...over,
  };
  return { deps, calls, written };
}
const hang = () => new Promise<never>(() => {});
/** D1c · every record stored 40 minutes ago: due, inside its limit, so not urgent (an urgent step runs whatever its estimate). */
const dueNotUrgent = (now = Date.now()) => {
  const at = new Date(now - 40 * 60_000).toISOString();
  return [...["site-index", "signals", "rebrands", "moving-runs", "quarter-series", "front-tape", "front-cards", "brands-index", "data-index"].map(k => ({ key: k, computed_at: at })),
    ...SITES.flatMap(x => ["brand-similar", "brand-sector", "brand-card"].map(k => ({ key: `${k}:${x.domain}`, computed_at: at })))];
};
beforeEach(() => resetStepEstimates());

describe("a crawl batch (only: captured)", () => {
  it("rewrites only its own brands' cards and ends within the 8 s limit even when every shared record is due", async () => {
    let clock = 0;
    const f = fakes({ card: async d => { f.calls.push(`card ${d}`); clock += 700; return { d }; } });
    const domains = Array.from({ length: 25 }, (_, i) => `b${i}.com`);
    const r = await refreshRecords({ job: "library", deadline: 8_000, domains, only: "captured", now: () => clock, deps: f.deps });
    expect(f.calls.every(c => c.startsWith("card "))).toBe(true);
    expect(f.written.length).toBeGreaterThan(0);
    expect(f.written.every(k => k.startsWith("brand-card:") && domains.includes(k.slice("brand-card:".length)))).toBe(true);
    expect(clock).toBeLessThanOrEqual(8_000);
    expect(r.timed_out).toBe(true); // 25 brands do not fit; the wire sweep picks up the rest
  });
  it("with time to spare it writes every captured card and nothing else", async () => {
    const f = fakes();
    const r = await refreshRecords({ job: "library", deadline: Date.now() + 30_000, domains: ["a.com", "B.com", "a.com"], only: "captured", deps: f.deps });
    expect(f.written.sort()).toEqual(["brand-card:a.com", "brand-card:b.com"]);
    expect(r.timed_out).toBe(false);
    expect(f.calls.filter(c => !c.startsWith("card "))).toEqual([]);
  });
});

describe("the full sweep", () => {
  const tiny = { metas: 5, sites: 5, "page-keys": 5, "card-chunk": 5, "site-index": 5, signals: 5, rebrands: 5, "moving-runs": 5, "quarter-series": 5, "brand-similar": 5, "brand-sector": 5, page: 5 };
  it("cuts a slow step off at the deadline and reports timed_out", async () => {
    const f = fakes({ shared: async k => { f.calls.push(`shared ${k}`); return k === "signals" ? hang() : {}; } });
    const t0 = Date.now();
    const r = await refreshRecords({ job: "wire", deadline: t0 + 300, deps: f.deps, estimates: tiny });
    expect(Date.now() - t0).toBeLessThan(450);
    expect(r.timed_out).toBe(true);
    expect(r.errors.join(" ")).toContain("signals: cut off at the deadline");
  });
  it("the same applies to a forced crawl finish", async () => {
    const f = fakes({ sector: () => hang() });
    const t0 = Date.now();
    const r = await refreshRecords({ job: "crawl-finish", deadline: t0 + 300, force: true, deps: f.deps, estimates: tiny });
    expect(Date.now() - t0).toBeLessThan(450);
    expect(r.timed_out).toBe(true);
    expect(f.calls).toContain("similar");
  });
  it("skips a step whose estimate does not fit, without starting it, and still runs the cheaper ones", async () => {
    let clock = 0;
    const f = fakes({ metas: async () => dueNotUrgent(0) });
    const r = await refreshRecords({ job: "wire", deadline: 2_000, now: () => clock, deps: f.deps, estimates: { ...tiny, "brand-sector": 10_000 } });
    expect(f.calls).not.toContain("sector");
    expect(f.calls).toContain("similar");
    expect(f.calls).toContain("page brands-index");
    expect(r.timed_out).toBe(true);
  });
  it("a step that was cut off is skipped up front next time (its estimate grows)", async () => {
    const f = fakes({ metas: async () => dueNotUrgent(), shared: async k => (k === "rebrands" ? new Promise(r => setTimeout(() => r({}), 1_000)) : {}) });
    await refreshRecords({ job: "wire", deadline: Date.now() + 200, deps: f.deps, estimates: tiny });
    const g = fakes({ metas: async () => dueNotUrgent() });
    const r = await refreshRecords({ job: "wire", deadline: Date.now() + 250, deps: g.deps, estimates: tiny });
    expect(g.calls).not.toContain("shared rebrands");
    expect(g.calls).toContain("shared moving-runs");
    expect(r.timed_out).toBe(true);
  });
  it("a throwing step is recorded and the sweep carries on", async () => {
    const f = fakes({ similar: async () => { throw new Error("boom"); } });
    const r = await refreshRecords({ job: "wire", deadline: Date.now() + 5_000, deps: f.deps, estimates: tiny });
    expect(r.errors.some(e => e.startsWith("brand-similar: boom"))).toBe(true);
    expect(f.calls).toContain("sector");
  });
});

describe("T2 · Part 0c: overdue page models go before the per-brand rows", () => {
  const tiny = { metas: 1, shared: 1, sites: 1, "brand-similar": 1, "brand-sector": 1, "page-keys": 1, page: 1, "card-chunk": 1 } as Record<string, number>;
  it("a page past its limit is rewritten even when the brand-sector step takes the rest of the pass", async () => {
    const now = Date.now(), old = new Date(now - 9 * 3_600_000).toISOString(), fresh = new Date(now - 60_000).toISOString();
    const metas = [{ key: "data-story:a", kind: "data-story", computed_at: old }, { key: "data-index", kind: "data-index", computed_at: fresh },
      ...["site-index", "signals", "rebrands", "moving-runs", "quarter-series", "front-tape", "front-cards"].map(k => ({ key: k, kind: k, computed_at: fresh }))];
    const f = fakes({ metas: async () => metas, pageKeys: async () => ["data-index", "data-story:a"], sector: () => hang() });
    const r = await refreshRecords({ job: "wire", deadline: Date.now() + 300, deps: f.deps, estimates: tiny });
    expect(f.calls.indexOf("page data-story:a")).toBeGreaterThan(-1);
    expect(f.calls.indexOf("page data-story:a")).toBeLessThan(f.calls.indexOf("similar"));
    expect(f.calls).not.toContain("page data-index"); // fresh and not due: still skipped
    expect(r.written).toContain("data-story:a");
  });
  it("orders overdue keys most overdue first and leaves keys within their limit out", async () => {
    const { overdueFirst } = await import("./refresh.server");
    const now = Date.parse("2026-11-23T03:00:00Z"), at = (h: number) => ({ computed_at: new Date(now - h * 3_600_000).toISOString() });
    const m: Record<string, { computed_at: string }> = { "data-story:a": at(7), digest: at(9), gallery: at(1) };
    expect(overdueFirst(["gallery", "data-story:a", "digest", "collections"], k => m[k], now)).toEqual(["collections", "digest", "data-story:a"]);
  });
});

describe("D1b · the sweep's queue: overdue first (D1c: most late first)", () => {
  it("puts every page past its limit before a shared input that is only due, most late first (cheapest first on a tie)", async () => {
    const { sweepOrder } = await import("./refresh.server");
    const H = 3_600_000;
    const order = sweepOrder([
      { what: "signals", brand: false, age: 20 * 60_000, limit: 3 * H, est: 2_000, due: true },
      { what: "data-index", brand: false, age: 13.6 * H, limit: 6 * H, est: 11_000, due: true },
      { what: "gallery:default", brand: false, age: 13.6 * H, limit: 6 * H, est: 2_000, due: true },
      { what: "rebrands", brand: false, age: 5.7 * H, limit: 3 * H, est: 6_000, due: true },
      { what: "brand-sector", brand: true, age: Infinity, limit: 48 * H, est: 15_000, due: true },
      { what: "moving-runs", brand: false, age: 5 * 60_000, limit: 6 * H, est: 500, due: false },
    ]).map(x => x.what);
    expect(order).toEqual(["gallery:default", "data-index", "rebrands", "brand-sector", "signals", "moving-runs"]);
  });
  it("among items inside their limit, the one closest to its limit goes first", async () => {
    const { sweepOrder } = await import("./refresh.server");
    const H = 3_600_000;
    const order = sweepOrder([
      { what: "collections", brand: false, age: 1 * H, limit: 6 * H, est: 100, due: true },
      { what: "site-index", brand: false, age: 2.5 * H, limit: 3 * H, est: 9_000, due: true },
    ]).map(x => x.what);
    expect(order).toEqual(["site-index", "collections"]);
  });
  it("the 07:01 pass: with every shared input due and seven pages overdue, the overdue pages are built before the due shared inputs", async () => {
    const now = Date.now(), old = new Date(now - 13.6 * 3_600_000).toISOString(), due = new Date(now - 20 * 60_000).toISOString();
    const pages = ["data-index", "data-story:a", "collections", "collection:x:1", "gallery:default", "digest:2026-W46"];
    const metas = [...pages.map(k => ({ key: k, kind: k.split(":")[0]!, computed_at: old })),
      ...["site-index", "signals", "rebrands", "moving-runs", "quarter-series", "front-tape", "front-cards"].map(k => ({ key: k, kind: k, computed_at: due }))];
    const f = fakes({ metas: async () => metas, pageKeys: async () => pages });
    const r = await refreshRecords({ job: "wire", deadline: Date.now() + 2_000, deps: f.deps, estimates: { metas: 1, "page-keys": 1, sites: 1, page: 1, "card-chunk": 1, "brand-similar": 1, "brand-sector": 1, "site-index": 1, signals: 1, rebrands: 1, "moving-runs": 1, "quarter-series": 1, "front-tape": 1, "front-cards": 1 } });
    const firstShared = Math.min(...f.calls.map((c, i) => (c.startsWith("shared ") ? i : Infinity)));
    for (const p of pages) expect(f.calls.indexOf(`page ${p}`)).toBeLessThan(firstShared);
    expect(r.overdue_tried).toEqual(expect.arrayContaining(pages));
  });
  it("counts bodies that only had their time moved apart from those rewritten", async () => {
    const f = fakes({ write: async rows => ({ written: rows.filter(r => r.key === "signals").map(r => r.key), retimed: rows.filter(r => r.key !== "signals").map(r => r.key) }) });
    const r = await refreshRecords({ job: "wire", deadline: Date.now() + 2_000, deps: f.deps, estimates: { metas: 1, "page-keys": 1, sites: 1, page: 1, "card-chunk": 1, "brand-similar": 1, "brand-sector": 1, "site-index": 1, signals: 1, rebrands: 1, "moving-runs": 1, "quarter-series": 1, "front-tape": 1, "front-cards": 1 } });
    expect(r.written).toEqual(["signals"]);
    expect(r.retimed).toContain("site-index");
    expect(r.retimed).not.toContain("signals");
  });
  it("the run note names the errors", async () => {
    const { sweepNote } = await import("./refresh.server");
    expect(sweepNote("wire", { written: ["a", "b"], retimed: ["c"], skipped: 3, timed_out: true, errors: ["rebrands: rebrands_incomplete"] })).toBe("wire · 2 written, 1 re-timed, 3 skipped, timed out, 1 error (rebrands: rebrands_incomplete)");
  });
});

describe("D1b · slow per-brand sets are rebuilt before they pass their limit", () => {
  it("a per-brand set at 40 h of 48 h goes before a shared input at 20 min of 3 h", async () => {
    const { sweepOrder } = await import("./refresh.server");
    const H = 3_600_000;
    const order = sweepOrder([
      { what: "signals", brand: false, age: 20 * 60_000, limit: 3 * H, est: 2_000, due: true },
      { what: "brand-sector", brand: true, age: 40 * H, limit: 48 * H, est: 12_000, due: true },
    ]).map(x => x.what);
    expect(order).toEqual(["brand-sector", "signals"]);
  });
});
