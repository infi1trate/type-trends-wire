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
    const f = fakes();
    const r = await refreshRecords({ job: "wire", deadline: 2_000, now: () => clock, deps: f.deps, estimates: { ...tiny, "brand-sector": 10_000 } });
    expect(f.calls).not.toContain("sector");
    expect(f.calls).toContain("similar");
    expect(f.calls).toContain("page brands-index");
    expect(r.timed_out).toBe(true);
  });
  it("a step that was cut off is skipped up front next time (its estimate grows)", async () => {
    const f = fakes({ shared: async k => (k === "rebrands" ? new Promise(r => setTimeout(() => r({}), 1_000)) : {}) });
    await refreshRecords({ job: "wire", deadline: Date.now() + 200, deps: f.deps, estimates: tiny });
    const g = fakes();
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
