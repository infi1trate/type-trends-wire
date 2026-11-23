// @vitest-environment node
// D1c · the sweep always reaches a page past its limit, and unchanged pages cost one small check row instead of a rewrite of their time.
import { describe, expect, it, vi } from "vitest";
import { needsRetime, storedAges, sweepUrgent, isUrgent, lastLook } from "./records";
import { refreshRecords, sweepOrder, type RefreshDeps } from "./refresh.server";
import { stepOrder, sweepLimitMs, URGENT_SWEEP_MS, PASS_END_MS } from "../jobs/wire-followups";

const H = 3_600_000, MIN = 60_000;
const db = vi.hoisted(() => ({ rows: new Map<string, { body_hash: string; computed_at: string }>(), stamped: [] as string[], upserts: [] as string[], checks: [] as { key: string }[][] }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (table: string) => {
  let op = "select", keys: string[] = [];
  const run = () => (op === "select" ? { data: keys.filter(k => db.rows.has(k)).map(key => ({ key, ...db.rows.get(key)! })), error: null } : (db.stamped.push(...keys), { data: null, error: null }));
  const q = {
    select: () => q, update: () => { op = "update"; return q; },
    upsert: (r: { key: string }[]) => { if (table === "read_record_checks") db.checks.push(r); else db.upserts.push(...r.map(x => x.key)); return Promise.resolve({ data: null, error: null }); },
    in: (_c: string, k: string[]) => { keys = k; return Promise.resolve(run()); },
  };
  return q;
} } }));

describe("re-timing an unchanged page", () => {
  it("moves its time only in the last fifth of its limit", () => {
    const now = Date.parse("2026-11-23T13:30:00Z"), at = (ms: number) => new Date(now - ms).toISOString();
    expect(needsRetime("brand-similar:a.com", at(10 * H), now)).toBe(false); // 10 h of 48 h
    expect(needsRetime("brand-similar:a.com", at(39 * H), now)).toBe(true); // past 38.4 h
    expect(needsRetime("brands-index", at(2 * H), now)).toBe(false); // 2 h of 3 h
    expect(needsRetime("brands-index", at(2.5 * H), now)).toBe(true); // past 2.4 h
    expect(needsRetime("signals", null, now)).toBe(true);
  });
  it("300 unchanged brand pages cost one check row, not 300 time writes", async () => {
    const { stableHash } = await import("../stable-json");
    const { writeRecordsCounted } = await import("./store.server");
    const fresh = new Date(Date.now() - 10 * H).toISOString(), h = await stableHash({ s: 1 });
    db.rows.clear(); db.stamped = []; db.upserts = []; db.checks = [];
    const rows = Array.from({ length: 300 }, (_, i) => ({ key: `brand-similar:b${i}.com`, body: { s: 1 }, source: "wire" }));
    for (const r of rows) db.rows.set(r.key, { body_hash: h, computed_at: fresh });
    const r = await writeRecordsCounted(rows, { set: "brand-similar" });
    expect(r.written).toEqual([]);
    expect(r.retimed).toEqual([]);
    expect(r.checked.length).toBe(300);
    expect(db.stamped).toEqual([]);
    expect(db.checks).toEqual([[{ key: "brand-similar", checked_at: expect.any(String), source: "wire" }]]);
  });
  it("a page near its limit is re-timed; a changed page is rewritten with its change time", async () => {
    const { stableHash } = await import("../stable-json");
    const { writeRecordsCounted } = await import("./store.server");
    db.rows.clear(); db.stamped = []; db.upserts = []; db.checks = [];
    db.rows.set("brands-index", { body_hash: await stableHash({ a: 1 }), computed_at: new Date(Date.now() - 2.5 * H).toISOString() });
    db.rows.set("signals", { body_hash: await stableHash({ a: 1 }), computed_at: new Date(Date.now() - 10 * MIN).toISOString() });
    const r = await writeRecordsCounted([{ key: "brands-index", body: { a: 1 }, source: "wire" }, { key: "signals", body: { a: 2 }, source: "wire" }]);
    expect(r.retimed).toEqual(["brands-index"]);
    expect(r.written).toEqual(["signals"]);
    expect(db.checks).toEqual([]);
  });
});

describe("the sweep's order and share of the pass", () => {
  it("a kind that will pass its limit before the next pass goes first, whatever it costs", () => {
    expect(isUrgent(2 * H + 50 * MIN, 3 * H)).toBe(true);
    expect(isUrgent(2 * H, 3 * H)).toBe(false);
    const order = sweepOrder([
      { what: "front-tape", brand: false, age: 20 * MIN, limit: 2 * H, est: 500, due: true },
      { what: "brands-index", brand: false, age: 2 * H + 50 * MIN, limit: 3 * H, est: 11_000, due: true },
      { what: "signals", brand: false, age: 30 * MIN, limit: 3 * H, est: 2_000, due: true },
    ]).map(x => x.what);
    expect(order[0]).toBe("brands-index");
  });
  it("the 13:31 case: brands-index 3.1 h old is built even though its estimate is longer than the time left", async () => {
    const now = Date.now(), at = (ms: number) => new Date(now - ms).toISOString();
    const shared = ["site-index", "signals", "rebrands", "moving-runs", "quarter-series", "front-tape", "front-cards", "library"];
    const calls: string[] = [];
    const deps: RefreshDeps = {
      metas: async () => [{ key: "brands-index", computed_at: at(3.1 * H) }, ...shared.map(k => ({ key: k, computed_at: at(20 * MIN) }))],
      checks: async () => new Map(), signalsChanged: async () => null,
      write: async rows => rows.map(r => r.key), card: async d => ({ d }), shared: async k => { calls.push(k); return {}; },
      sites: async () => [], similar: async () => [], sector: async () => [], pageKeys: async () => ["brands-index"],
      page: async k => { calls.push(k); await new Promise(r => setTimeout(r, 30)); return {}; },
    };
    const r = await refreshRecords({ job: "wire", deadline: now + 400, deps, estimates: { metas: 1, sites: 1, "page-keys": 1, "page:brands-index": 9_500 } });
    expect(calls[0]).toBe("brands-index");
    expect(r.written).toContain("brands-index");
    expect(r.overdue_tried[0]).toBe("brands-index");
  });
  it("a per-brand set checked unchanged ten minutes ago is not rebuilt, and a re-timed signals record dirties no card", async () => {
    const now = Date.now(), at = (ms: number) => new Date(now - ms).toISOString();
    const sites = Array.from({ length: 5 }, (_, i) => ({ domain: `b${i}.com`, sector: "saas", last_snapshot_at: at(20 * H) }));
    const calls: string[] = [];
    const deps: RefreshDeps = {
      metas: async () => [
        ...["site-index", "rebrands", "moving-runs", "quarter-series", "front-tape", "front-cards", "library"].map(k => ({ key: k, computed_at: at(5 * MIN) })),
        { key: "signals", computed_at: at(1 * MIN) }, // re-timed a minute ago, last changed 10 h ago
        ...sites.flatMap(s => ["brand-similar", "brand-sector", "brand-card"].map(k => ({ key: `${k}:${s.domain}`, computed_at: at(10 * H) }))),
        { key: "brand-card:gone.com", computed_at: at(47.9 * H) }, // a brand no longer tracked
      ],
      checks: async () => new Map([["brand-similar", at(10 * MIN)], ["brand-sector", at(10 * MIN)], ...sites.map(s => [`brand-card:${s.domain}`, at(1 * H)] as [string, string])]),
      signalsChanged: async () => at(10 * H + 5 * MIN),
      write: async rows => rows.map(r => r.key), card: async d => { calls.push(`card ${d}`); return {}; }, shared: async k => { calls.push(k); return {}; },
      sites: async () => sites, similar: async () => { calls.push("similar"); return []; }, sector: async () => { calls.push("sector"); return []; },
      pageKeys: async () => [], page: async () => ({}),
    };
    await refreshRecords({ job: "wire", deadline: now + 2_000, deps, estimates: { metas: 1, sites: 1, "page-keys": 1, "card-chunk": 1 } });
    expect(calls).toEqual([]);
  });
  it("the pass gives an urgent sweep the first 20 s in any slot", () => {
    const t0 = Date.parse("2026-11-23T13:31:00Z"); // a slot that would build first
    expect(stepOrder(t0)).toEqual(["story build", "records sweep"]);
    expect(stepOrder(t0, false, true)).toEqual(["records sweep", "story build"]);
    expect(sweepLimitMs(t0, t0 + 1_000, true, 15_000, true)).toBe(URGENT_SWEEP_MS);
    expect(sweepLimitMs(t0, t0 + 10_000, true, 15_000, true)).toBe(PASS_END_MS - 10_000);
    expect(sweepLimitMs(t0, t0 + 1_000, true)).toBe(PASS_END_MS - 15_000 - 1_000);
  });
  it("urgent records, most late first; a fresh one is not urgent", () => {
    const now = Date.parse("2026-11-23T13:35:00Z"), at = (ms: number) => new Date(now - ms).toISOString();
    expect(sweepUrgent([{ key: "brands-index", computed_at: at(3.1 * H) }, { key: "digest:2026-W47", computed_at: at(5.9 * H) }, { key: "signals", computed_at: at(1 * H) }, { key: "brand-card:a.com", computed_at: at(47.9 * H) }], now))
      .toEqual(["brands-index", "digest:2026-W47"]);
    expect(lastLook("2026-11-23T10:00:00Z", "2026-11-23T13:00:00Z")).toBe("2026-11-23T13:00:00Z");
    expect(lastLook("2026-11-23T10:00:00Z", undefined)).toBe("2026-11-23T10:00:00Z");
  });
});

describe("health's ages", () => {
  it("leave out per-brand rows of a brand no longer tracked", () => {
    const now = Date.parse("2026-11-23T15:00:00Z"), at = (ms: number) => new Date(now - ms).toISOString();
    const metas = [{ key: "brand-card:a.com", computed_at: at(2 * H) }, { key: "brand-card:ragged-edge.com", computed_at: at(49 * H) }];
    expect(storedAges(metas, now).past_limit).toBe(1);
    expect(storedAges(metas, now, new Set(["a.com"])).past_limit).toBe(0);
  });
});
