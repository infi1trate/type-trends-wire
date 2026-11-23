import { describe, it, expect } from "vitest";
import { DAILY_RETRIES_MAX, RETRY_EVERY_MS, attemptsOf, retryDue, type Attempt } from "./retries";
const T = (h: number, m = 0) => `2026-11-23T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000Z`, at = (h: number) => Date.parse(T(h));
const start = (h: number): Attempt => ({ at: T(h), kind: "start" }), done = (h: number, failed: boolean, called = false): Attempt => ({ at: T(h, 1), kind: "outcome", failed, called });

describe("PH1 · daily desk jobs try again", () => {
  it("every six hours at most, three more times a day at most", () => {
    expect(RETRY_EVERY_MS).toBe(6 * 3_600_000); expect(DAILY_RETRIES_MAX).toBe(3);
    expect(retryDue("daily", [start(1), done(1, true)], at(6)).due).toBe(false);
    expect(retryDue("daily", [start(1), done(1, true)], at(7) + 60_000)).toMatchObject({ due: true, retry: 1 });
    expect(retryDue("daily", [start(1), done(1, true), start(7), done(7, true), start(13), done(13, true), start(19), done(19, true)], at(23))).toMatchObject({ due: false, why: "all 3 tries again used today" });
  });
  it("a stood-down run (started, no result) tries again too; a run that worked does not", () => {
    expect(retryDue("daily", [start(1)], at(8))).toMatchObject({ due: true, retry: 1 });
    expect(retryDue("daily", [start(1), done(1, false)], at(12)).due).toBe(false);
    expect(retryDue("daily", [start(1), done(1, true), start(7), done(7, false)], at(20)).due).toBe(false);
  });
});
describe("PH1 · weekly model-call jobs try once more", () => {
  it("one more try, six hours later, only when the failure came before the model call", () => {
    expect(retryDue("weekly", [start(1), done(1, true, false)], at(8))).toMatchObject({ due: true, retry: 1 });
    expect(retryDue("weekly", [start(1), done(1, true, false)], at(6)).due).toBe(false);
    expect(retryDue("weekly", [start(1), done(1, true, false), start(8), done(8, true, false)], at(20))).toMatchObject({ due: false, waitsForNextWeek: true });
  });
  it("never after a model call, or when a call row exists, or when cut off with nothing stored", () => {
    expect(retryDue("weekly", [start(1), done(1, true, true)], at(8))).toMatchObject({ due: false, waitsForNextWeek: true });
    expect(retryDue("weekly", [start(1), done(1, true, false)], at(8), { callSince: () => true })).toMatchObject({ due: false, waitsForNextWeek: true });
    expect(retryDue("weekly", [start(1)], at(8))).toMatchObject({ due: false, waitsForNextWeek: true });
  });
});
describe("PH1 · attempts from desk_log", () => {
  it("reads starts, retries, outcomes and a legacy result row", () => {
    const rows = [
      { at: T(1), subject_id: "checks", reason: "Started at 01:00 UTC; the result follows in its own row (none means it was cut off).", detail: {} },
      { at: T(1, 1), subject_id: "checks", reason: "Daily checks: ok; 0 opened, 0 closed.", detail: {} },
      { at: T(7), subject_id: "checks:retry", reason: "Started at 07:00 UTC (try again 1)", detail: {} },
      { at: T(7, 1), subject_id: "checks:outcome", reason: "failed: x", detail: { run: "checks", counts: { failed: 1, called: 0 } } },
    ];
    expect(attemptsOf("checks", rows)).toEqual([{ at: T(1), kind: "start" }, { at: T(1, 1), kind: "outcome", failed: false }, { at: T(7), kind: "start" }, { at: T(7, 1), kind: "outcome", failed: true, called: false }]);
  });
});
