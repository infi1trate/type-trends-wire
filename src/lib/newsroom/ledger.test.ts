import { describe, expect, it } from "vitest";
import { buildLedger, CREDIT_USD, etWeeks, healthSpendLine, shippedIn, unitCost, type CallRow, type LedgerInput } from "./ledger";

const empty: LedgerInput = { calls: [], builds: [], agents: [], texts: [], deskCalls: [], published: [], ships: [], cap: null };
const call = (at: string, o: Partial<CallRow> = {}): CallRow => ({ at, kind: "vision", model: "m", ok: true, state: "done", input_tokens: 100, output_tokens: 10, usd: 0.01, snapshot_id: 1, ...o });

describe("T1 spend ledger", () => {
  it("weeks run Monday 00:00 to Monday 00:00 Eastern time across the November clock change", () => {
    const w = etWeeks(Date.parse("2026-11-04T12:00:00Z"), 3);
    expect(w.map(x => x.start)).toEqual(["2026-11-02T05:00:00.000Z", "2026-10-26T04:00:00.000Z", "2026-10-19T04:00:00.000Z"]);
    expect(w[1]!.end).toBe("2026-11-02T05:00:00.000Z");
    // 23:30 on Sunday 1 Nov (EST) is still the week of 26 Oct; 00:00 Monday 2 Nov EST is the next week.
    const l = buildLedger({ ...empty, calls: [call("2026-11-02T04:30:00Z"), call("2026-11-02T05:00:00Z")] }, Date.parse("2026-11-04T12:00:00Z"), 3);
    expect(l[0]!.model.calls).toBe(1);
    expect(l[1]!.model.calls).toBe(1);
  });
  it("gives eight weeks newest first, and a week with no calls reads as zero", () => {
    const l = buildLedger(empty, Date.parse("2026-11-23T01:00:00Z"));
    expect(l).toHaveLength(8);
    expect(l[0]!.current).toBe(true);
    expect(l[0]!.start).toBe("2026-11-16T05:00:00.000Z");
    expect(l[3]!.model).toEqual({ calls: 0, failed: 0, tokens_in: 0, tokens_out: 0, usd: 0, by_kind: [] });
    expect(l[3]!.agent.line).toBe("not recorded");
    expect(l[3]!.cap.line).toBe("no cap set");
    expect(l[3]!.total_usd).toBe(0);
  });
  it("counts a failed call once as a call and once as a failure, and skips refused reservations", () => {
    const l = buildLedger({ ...empty, calls: [call("2026-11-20T12:00:00Z"), call("2026-11-20T12:01:00Z", { ok: false, state: "done" }), call("2026-11-20T12:02:00Z", { ok: false, state: "rejected", usd: 0 })] }, Date.parse("2026-11-23T01:00:00Z"));
    expect(l[0]!.model.calls).toBe(2);
    expect(l[0]!.model.failed).toBe(1);
    expect(l[0]!.model.by_kind).toEqual([{ kind: "vision", model: "m", calls: 2, failed: 1, tokens_in: 200, tokens_out: 20, usd: 0.02 }]);
  });
  it("unit costs with a zero base say so in words and never divide", () => {
    const l = buildLedger(empty, Date.parse("2026-11-23T01:00:00Z"));
    expect(l[0]!.per_story).toEqual({ value: null, count: 0, base: 0, line: "no stories published" });
    expect(l[0]!.per_capture.line).toBe("no captures read");
    expect(l[0]!.per_change.line).toBe("no changes shipped");
    expect(unitCost(1, 0, { unit: "usd", noBase: "none", of: "{n} x" }).value).toBeNull();
  });
  it("a story's cost is its writer texts plus its share of desk calls; a two-story call counts half against each", () => {
    const l = buildLedger({ ...empty, published: [{ story_id: "a", at: "2026-11-20T00:00:00Z" }, { story_id: "b", at: "2026-11-21T00:00:00Z" }, { story_id: "a", at: "2026-11-22T00:00:00Z" }],
      texts: [{ story_id: "a", usd: 0.03 }, { story_id: "b", usd: 0.01 }],
      deskCalls: [{ at: "2026-11-20T00:00:00Z", desk: "standards", purpose: "review", usd: 0.02, story_ids: ["a", "b"] }, { at: "2026-11-20T00:00:00Z", desk: "standards", purpose: "fixture", usd: 5, story_ids: ["a"] }] },
      Date.parse("2026-11-23T01:00:00Z"));
    expect(l[0]!.per_story.base).toBe(2);
    expect(l[0]!.per_story.count).toBe(0.06);
    expect(l[0]!.per_story.value).toBe(0.03);
  });
  it("dollars per capture read divide vision dollars by distinct captures read", () => {
    const l = buildLedger({ ...empty, calls: [call("2026-11-20T00:00:00Z", { snapshot_id: 1 }), call("2026-11-20T00:01:00Z", { snapshot_id: 1, ok: false }), call("2026-11-20T00:02:00Z", { snapshot_id: 2 })] }, Date.parse("2026-11-23T01:00:00Z"));
    expect(l[0]!.per_capture).toMatchObject({ count: 0.03, base: 2, value: 0.015 });
  });
  it("build credits are priced at the stated price and agent sessions are recorded by hand", () => {
    const l = buildLedger({ ...empty, builds: [{ at: "2026-11-22T12:00:00Z", credits: 300.3, queue_item: 5, what: "x" }], agents: [{ at: "2026-11-22T12:00:00Z", usd: 4, what: "brief", actor: "owner" }] }, Date.parse("2026-11-23T01:00:00Z"));
    expect(CREDIT_USD).toBe(0.3);
    expect(l[0]!.build).toEqual({ credits: 300.3, usd: 90.09, entries: 1 });
    expect(l[0]!.agent.line).toBe("$4.00 recorded by hand (1 session)");
    expect(l[0]!.total_usd).toBe(94.09);
  });
  it("shipped changes: moved to live in the week, or already live and passing a gate in the week; test items never", () => {
    const w = { start: "2026-11-16T05:00:00.000Z", end: "2026-11-23T05:00:00.000Z" };
    expect(shippedIn([
      { id: 1, test: false, moves: [{ status: "live", at: "2026-11-18T00:00:00Z" }], gates: [] },
      { id: 2, test: false, moves: [{ status: "live", at: "2026-11-10T00:00:00Z" }], gates: [{ at: "2026-11-19T00:00:00Z", pass: true }] },
      { id: 3, test: false, moves: [{ status: "built", at: "2026-11-18T00:00:00Z" }], gates: [{ at: "2026-11-19T00:00:00Z", pass: true }] },
      { id: 4, test: true, moves: [{ status: "live", at: "2026-11-18T00:00:00Z" }], gates: [] },
      { id: 5, test: false, moves: [{ status: "live", at: "2026-11-10T00:00:00Z" }], gates: [{ at: "2026-11-19T00:00:00Z", pass: false }] },
    ], w)).toEqual([1, 2]);
  });
  it("the cap line names model dollars and build credits when set", () => {
    const l = buildLedger({ ...empty, cap: { model_usd: 20, build_credits: 100, set_at: "x" }, builds: [{ at: "2026-11-22T12:00:00Z", credits: 10, queue_item: null, what: "x" }] }, Date.parse("2026-11-23T01:00:00Z"));
    expect(l[0]!.cap.line).toBe("model $0.00 of $20.00; build 10 of 100 credits");
  });
  it("the health line gives totals only", () => {
    expect(healthSpendLine({ model_usd: 1.5, build_credits: 10, agent_usd: 0 })).toBe("This week (Eastern time): model calls $1.50, build 10 credits ($3.00 at $0.30 a credit), agent sessions not recorded; $4.50 in all.");
  });
});
