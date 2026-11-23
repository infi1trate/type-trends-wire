import { afterEach, describe, expect, it, vi } from "vitest";
import { CALLER_LIMIT_MS, FINISH_GRACE_MS, HOST_AFTER_ANSWER_MS, PASS_END_MS, WIRE_FOLLOWUPS_SCHEDULE, WIRE_FOLLOWUP_STEPS, WIRE_STEPS, firstStep, followupsNote, stepOrder, sweepLimitMs, wireFollowupsSlot, writtenByKind, writtenLine } from "./wire-followups";
import { REVIEW_MINUTES } from "../newsroom/review-pass";
import { storedAges } from "../records/records";

afterEach(() => { vi.resetModules(); vi.doUnmock("./runs.server"); });

describe("L2 · the wire follow-ups pass", () => {
  it("runs one minute after each wire job, never on a review-pass minute", () => {
    expect(WIRE_FOLLOWUPS_SCHEDULE).toMatchObject({ name: "wire-followups", cron: "1-59/15 * * * *", path: "/api/public/jobs/wire-followups" });
    for (const m of [1, 16, 31, 46]) expect(REVIEW_MINUTES as readonly number[]).not.toContain(m);
  });
  it("keeps every step: the wire job ingests and gives the news desk its turn; the pass builds stories and sweeps records", () => {
    expect([...WIRE_STEPS, ...WIRE_FOLLOWUP_STEPS]).toEqual(["ingest", "news desk", "story build", "records sweep"]);
  });
  it("takes one fifteen-minute slot and notes each step's seconds and what it rewrote", () => {
    expect(wireFollowupsSlot(Date.parse("2026-11-22T14:31:05Z"))).toBe("wire-followups:2026-11-22T14:30");
    expect(followupsNote([{ step: "story build", ms: 21_100 }, { step: "records sweep", ms: 14_960, note: "brand-card 8" }])).toBe("story build 21.1 s · records sweep 15 s (brand-card 8)");
    expect(writtenLine(writtenByKind(["brand-card:a.com", "brand-card:b.com", "signals"]))).toBe("brand-card 2, signals 1");
    expect(writtenLine({})).toBe("nothing rewritten");
  });
});

describe("T1 · the pass answers at once and finishes after the answer", () => {
  it("ends inside the host's window after the answer, which the five-second caller cannot cut", () => {
    expect(CALLER_LIMIT_MS).toBe(5_000);
    expect(PASS_END_MS + FINISH_GRACE_MS).toBeLessThan(HOST_AFTER_ANSWER_MS);
    expect(sweepLimitMs(0, 12_000)).toBe(15_000);
    expect(sweepLimitMs(0, 30_000)).toBe(0);
  });
  it("takes turns: the :00 and :30 slots build first, the :15 and :45 slots sweep first", () => {
    expect(firstStep(Date.parse("2026-11-22T16:01:00Z"))).toBe("story build");
    expect(firstStep(Date.parse("2026-11-22T16:16:00Z"))).toBe("records sweep");
    expect(firstStep(Date.parse("2026-11-22T16:31:00Z"))).toBe("story build");
    expect(stepOrder(Date.parse("2026-11-22T16:46:00Z"))).toEqual(["records sweep", "story build"]);
  });

  const fakeDb = (open: { id: number }[] = [], finished: number[] = []) => {
    const q: Record<string, unknown> = {};
    for (const k of ["select", "eq", "gte", "order", "in"]) q[k] = () => q;
    q["limit"] = async () => ({ data: open });
    q["then"] = (res: (v: unknown) => void) => res({ data: finished.map(start_id => ({ start_id })) });
    return { from: () => q } as never;
  };
  const mockRuns = (rows: string[]) => vi.doMock("./runs.server", () => ({ startRun: async () => ({ id: 77, slotTaken: false, finish: async (ok: boolean, note: string, detail: unknown) => { rows.push(`finish:${ok}:${note.replace(/[\d.]+ s/g, "n s")}:${JSON.stringify((detail as { first?: string }).first)}`); } }) }));

  it("runs both steps in the slot's order and writes one finish row with what was rewritten", async () => {
    const rows: string[] = [];
    mockRuns(rows);
    const { runWireFollowups } = await import("./wire-followups.server");
    const at = Date.parse("2026-11-22T16:16:00Z");
    const r = await runWireFollowups(fakeDb(), { now: () => at, deps: { build: async () => { rows.push("build"); return "wire · 0 new, 0 published, 0 held"; }, sweep: async () => { rows.push("sweep"); return { written: ["signals", "brand-card:a.com"], skipped: 0, timed_out: false, errors: [] }; } } });
    expect(r.ran).toBe(true);
    expect(r.run_id).toBe(77);
    expect(rows).toEqual(["sweep", "build", 'finish:true:records sweep n s (brand-card 1, signals 1) · story build n s (0 new, 0 published, 0 held):"records sweep"']);
  });
  it("answers with the run id before the work, which is handed to the host", async () => {
    const rows: string[] = [];
    mockRuns(rows);
    let release!: () => void;
    const gate = new Promise<void>(r => { release = r; });
    vi.doMock("@/integrations/supabase/cron-auth", () => ({ authenticateCronRequest: async () => null }));
    vi.doMock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: fakeDb() }));
    vi.doMock("../stories/build.server", () => ({ afterJob: async () => { await gate; rows.push("build"); return "wire · held: job_hold on stories"; } }));
    vi.doMock("../records/refresh.server", () => ({ refreshAfterJob: async () => { rows.push("sweep"); return { written: [], skipped: 3, timed_out: false, errors: [] }; } }));
    const { handleWireFollowups } = await import("./wire-followups.server");
    const kept: Promise<unknown>[] = [];
    const res = await handleWireFollowups(new Request("http://x/api/public/jobs/wire-followups", { method: "POST", body: JSON.stringify({ kind: "wire-followups" }) }), { waitUntil: p => { kept.push(p); } });
    const body = await res.json() as { ran: boolean; run_id: number; mode: string };
    expect(body).toMatchObject({ ran: true, run_id: 77, mode: "background" });
    expect(rows).toEqual([]); // nothing has run yet: the answer went first
    release(); await Promise.all(kept);
    expect(rows.slice(0, 2).sort()).toEqual(["build", "sweep"]);
    expect(rows[2]).toMatch(/^finish:true:/);
    vi.doUnmock("@/integrations/supabase/cron-auth"); vi.doUnmock("@/integrations/supabase/client.server"); vi.doUnmock("../stories/build.server"); vi.doUnmock("../records/refresh.server");
  });
  it("never doubles a run still going: a recent start row with no finish row stops the pass", async () => {
    const rows: string[] = [];
    mockRuns(rows);
    const { runWireFollowups } = await import("./wire-followups.server");
    const r = await runWireFollowups(fakeDb([{ id: 5 }], []), { deps: { build: async () => { rows.push("build"); return null; }, sweep: async () => null } });
    expect(r).toMatchObject({ ran: false, why: "another follow-ups pass is running" });
    expect(rows).toEqual([]);
  });
  it("writes the finish row at the pass's end when a step overruns, saying it was cut off", async () => {
    const rows: string[] = [];
    mockRuns(rows);
    const { runWireFollowups } = await import("./wire-followups.server");
    const at = Date.parse("2026-11-22T16:01:00Z");
    let calls = 0; // the start, then a clock already past the pass's end while the build hangs
    const r = await runWireFollowups(fakeDb(), { now: () => (calls++ === 0 ? at : at + PASS_END_MS + FINISH_GRACE_MS + 1), deps: { build: () => new Promise(() => {}), sweep: async () => null } });
    expect(r.why).toMatch(/^cut off at the pass end/);
    expect(rows[0]).toMatch(/^finish:false:cut off at the pass end/);
  });
});

describe("T1 · stored pages' ages in health", () => {
  const now = Date.parse("2026-11-23T01:00:00Z");
  it("names each kind past its limit with its age and limit", () => {
    const r = storedAges([
      { key: "brands-index", computed_at: "2026-11-22T17:31:00Z" },
      { key: "front-tape", computed_at: "2026-11-23T00:30:00Z" },
      { key: "brand-card:a.com", computed_at: "2026-11-22T20:00:00Z" },
      { key: "brand-card:b.com", computed_at: "2026-11-20T20:00:00Z" },
    ], now);
    expect(r.past_limit).toBe(2);
    expect(r.kinds.find(k => k.kind === "brands-index")).toMatchObject({ age_min: 449, limit_min: 180, past_limit: true });
    expect(r.kinds.find(k => k.kind === "front-tape")).toMatchObject({ age_min: 30, past_limit: false });
    expect(r.line).toBe("2 of 3 kinds of stored page are past their limit, so fresh instances rebuild them live: brand-card 53 h (limit 48 h, 1 of 2 rows); brands-index 7.5 h (limit 3 h).");
  });
  it("says so plainly when every kind is within its limit", () => {
    expect(storedAges([{ key: "signals", computed_at: "2026-11-23T00:50:00Z" }], now).line).toBe("All 1 kinds of stored page are within their limits (oldest 10 min old).");
  });
});
