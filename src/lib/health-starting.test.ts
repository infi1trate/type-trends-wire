import { describe, expect, it, vi } from "vitest";
import { topStatus } from "./health";
import { sweepLine } from "./db-health";

// D1b · health says what is true: a just-started server with no job facts says "starting" (not "down"), inside the two-second answer,
// with the database lines read; "down" only when the database lines say bad or a job that matters is failing.
describe("D1b · the top-level status rule", () => {
  it("is down only for a bad database or failing job facts; no facts yet is starting", () => {
    expect(topStatus(null, "ok")).toBe("starting");
    expect(topStatus(null, null)).toBe("starting");
    expect(topStatus(null, "bad")).toBe("down");
    expect(topStatus("ok", "warn")).toBe("ok");
    expect(topStatus("down", "ok")).toBe("down");
    expect(topStatus("ok", "bad")).toBe("down");
  });
});

describe("D1b · the stored-pages sweep's line", () => {
  const NOW = Date.parse("2026-11-23T07:10:00Z");
  it("reads an old note-only row: 6 written, timed out, 2 errors is a warn", () => {
    const l = sweepLine({ at: "2026-11-23T07:01:27Z", ok: false, ms: 23_148, note: "wire · 6 written, 13 skipped, timed out, 2 errors" }, NOW);
    expect(l).toMatchObject({ state: "warn", written: 6, errors: 2, timed_out: true });
    expect(l.line).toBe("The stored-pages sweep last finished 9 min ago in 23.1 s: 6 written, 2 errors, ran out of time, rest next pass.");
  });
  it("a whole sweep with no errors in the last 40 minutes is ok and says what it only re-timed", () => {
    const l = sweepLine({ at: "2026-11-23T07:00:00Z", ok: true, ms: 18_000, written: 3, retimed: 14, skipped: 2, timed_out: false, error_steps: [] }, NOW);
    expect(l).toMatchObject({ state: "ok", written: 3, retimed: 14, errors: 0, timed_out: false });
  });
  it("names the steps that failed, and is bad when the last sweep is over two hours old", () => {
    expect(sweepLine({ at: "2026-11-23T07:00:00Z", ok: false, ms: 9_000, written: 1, retimed: 0, timed_out: false, error_steps: ["rebrands"] }, NOW).line).toContain("1 error (rebrands)");
    expect(sweepLine({ at: "2026-11-23T05:00:00Z", ok: true, ms: 9_000, written: 1, retimed: 0, timed_out: false, error_steps: [] }, NOW).state).toBe("bad");
    expect(sweepLine(null, NOW).state).toBe("warn");
  });
});

describe("D1b · a just-started server", () => {
  it("answers starting within two seconds when its first job facts fail, with the database lines read", async () => {
    vi.resetModules();
    vi.doMock("./health-facts.server", () => ({ healthFactsResult: async () => ({ data: null, error: { code: "PGRST000", message: "first call failed" } }) }));
    const answer = { data: null, error: null };
    const chain = { abortSignal: () => Promise.resolve(answer), then: (ok: (v: typeof answer) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(answer).then(ok, bad) };
    vi.doMock("./mcp/supabase", () => ({ supabaseAnon: () => ({ rpc: () => chain }) }));
    vi.doMock("./db-probe.server", () => ({ probeDb: async () => ({ at: Date.now(), ms: 80, ok: true }), probeHistory: () => [{ at: Date.now(), ms: 80, ok: true }] }));
    vi.doMock("./safe-mode.server", () => ({ safeModeState: () => ({ on: false, why: "" }), safeModeOn: async () => ({ on: false, why: "" }) }));
    const { healthWithin } = await import("./health.server");
    const t0 = Date.now();
    const { body, slow } = await healthWithin();
    expect(Date.now() - t0).toBeLessThan(2_000);
    expect(body.status).toBe("starting");
    expect(slow).toBe(true); // not cached by the edge
    expect(body.jobs).toEqual([]);
    expect(body.db?.answer.state).toBe("ok");
    expect(body.database?.status).toBe("starting");
    vi.doUnmock("./health-facts.server"); vi.doUnmock("./mcp/supabase"); vi.doUnmock("./db-probe.server"); vi.doUnmock("./safe-mode.server");
  });
});
