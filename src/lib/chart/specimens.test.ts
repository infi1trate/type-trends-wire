// L2 · the proposed forms' specimen models: slope rows at two well-covered quarters, dots with next quarter's range.
import { describe, expect, it } from "vitest";
import { dotRangeModel, nextQuarter, slopeModel } from "./specimens";

const q = (q: string, s: number, n = 30, c = 1) => ({ q, s, n, c });
describe("slopeModel", () => {
  it("uses the oldest and newest quarters most sectors cover well and marks the row that moved most", () => {
    const m = slopeModel("font:serif", [
      { scope: "fintech", quarters: [q("2021Q1", 0.1), q("2026Q4", 0.3)] },
      { scope: "media", quarters: [q("2021Q1", 0.2), q("2026Q4", 0.25)] },
      { scope: "health", quarters: [q("2021Q1", 0.05, 4), q("2026Q4", 0.1)] }, // 2021Q1 too thin: dropped
    ])!;
    expect([m.from, m.to]).toEqual(["2021Q1", "2026Q4"]);
    expect(m.rows.map(r => r.id)).toEqual(["fintech", "media"]);
    expect(m.moved).toBe("fintech");
  });
  it("is null with fewer than two rows", () => {
    expect(slopeModel("font:serif", [{ scope: "fintech", quarters: [q("2021Q1", 0.1), q("2026Q4", 0.3)] }])).toBeNull();
  });
});
describe("dotRangeModel", () => {
  it("keeps at most twelve rows with a range, sorted by share, and finds the widest", () => {
    const rows = Array.from({ length: 15 }, (_, i) => ({ dimension: "font", value: `f${i}`, current_share: i / 20, proj_q1_lo: i / 20 - 0.01, proj_q1_hi: i / 20 + (i === 3 ? 0.2 : 0.01) }));
    const m = dotRangeModel([...rows, { dimension: "font", value: "none", current_share: 0.9, proj_q1_lo: null, proj_q1_hi: null }], k => k !== "font:f14", "2027Q1");
    expect(m.rows).toHaveLength(12);
    expect(m.rows[0]!.id).toBe("font:f13");
    expect(m.widest).toBe("font:f3");
  });
  it("next quarter", () => { expect(nextQuarter("2026Q4")).toBe("2027Q1"); expect(nextQuarter("2026Q2")).toBe("2026Q3"); });
});
