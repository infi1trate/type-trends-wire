import { describe, expect, it } from "vitest";
import { computeBand, type RankPoint } from "./bands";

const d = (offset: number) => new Date(Date.UTC(2026, 0, 1) + offset * 86_400_000).toISOString().slice(0, 10);
const pt = (offset: number, pop: number, trnd: number): RankPoint => ({ captured_on: d(offset), popularity_rank: pop, trending_rank: trnd });

describe("computeBand", () => {
  it("is BASELINE under 42 days of history", () => {
    const r = computeBand([pt(0, 100, 50), pt(30, 50, 10)]);
    expect(r.band).toBe("BASELINE");
    expect(r.reason).toBe("Collecting history: 30 of 42 days");
  });
  it("is RISING on a 28d climb ≥ max(5,5%) with trending ≤ 200", () => {
    expect(computeBand([pt(0, 200, 300), pt(22, 200, 300), pt(50, 190, 200)]).band).toBe("RISING");
  });
  it("is not RISING when trending > 200", () => {
    expect(computeBand([pt(0, 200, 300), pt(22, 200, 300), pt(50, 190, 201)]).band).toBe("STEADY");
  });
  it("is PEAKING for top-100 with trending worsened ≥ 50", () => {
    expect(computeBand([pt(0, 50, 10), pt(22, 50, 10), pt(50, 50, 60)]).band).toBe("PEAKING");
  });
  it("is RETURNING when down 28d but up both recent weeks", () => {
    const r = computeBand([pt(0, 100, 500), pt(22, 100, 500), pt(36, 130, 500), pt(43, 125, 500), pt(50, 120, 500)]);
    expect(r.band).toBe("RETURNING");
  });
  it("is FADING when down 28d ≥ threshold", () => {
    expect(computeBand([pt(0, 100, 500), pt(22, 100, 500), pt(50, 106, 500)]).band).toBe("FADING");
  });
  it("delta is old rank minus new rank", () => {
    expect(computeBand([pt(0, 84, 3), pt(7, 72, 3)]).delta7).toBe(12);
  });
});
