import { describe, expect, it } from "vitest";
import { CONFIDENCE, DIRECTION_CUTS, confidence, directionWord, momentumIndex } from "./momentum";
import { MOVES_DEADBAND_PTS } from "./tiers";

describe("momentum index", () => {
  it("is the percentile rank of the stored next-wave score in its cohort, 0–100", () => {
    const cohort = [-1, 0, 1, 2, 3];
    expect(momentumIndex(3, cohort)).toBe(100);
    expect(momentumIndex(-1, cohort)).toBe(0);
    expect(momentumIndex(1, cohort)).toBe(50);
  });
  it("edge cases: no score → null; alone → 50; ties share the midpoint; nulls ignored", () => {
    expect(momentumIndex(null, [1, 2])).toBeNull();
    expect(momentumIndex(Number.NaN, [1, 2])).toBeNull();
    expect(momentumIndex(0.4, [])).toBe(50);
    expect(momentumIndex(1, [1, 1, null, 0])).toBe(75);
    expect(momentumIndex(5, [1, 2])).toBe(100); // a score outside the cohort is ranked against it
  });
});

describe("direction word", () => {
  it("uses stored momentum with the forecast's flat dead-band", () => {
    expect(DIRECTION_CUTS.flat).toBe(MOVES_DEADBAND_PTS);
    expect(directionWord(2)).toBe("Rising fast");
    expect(directionWord(1.9)).toBe("Rising");
    expect(directionWord(0.5)).toBe("Flat");
    expect(directionWord(-0.5)).toBe("Flat");
    expect(directionWord(-0.6)).toBe("Falling");
    expect(directionWord(null)).toBeNull();
  });
});

describe("confidence", () => {
  it("High needs every High minimum", () => {
    expect(confidence({ key: "theme:dark", components: 3, sites: 30, quarters: 5 })).toEqual({ level: "High", reason: "High: 3 of 7 components, 30 sites, 5 quarters" });
    expect(confidence({ key: "theme:dark", components: 3, sites: 29, quarters: 9 }).level).toBe("Medium");
  });
  it("Medium needs the Medium minimums; otherwise Low", () => {
    expect(confidence({ key: "theme:dark", components: CONFIDENCE.Medium.components, sites: 10, quarters: 4 }).level).toBe("Medium");
    expect(confidence({ key: "theme:dark", components: 1, sites: 300, quarters: 9 }).level).toBe("Low");
    expect(confidence({ key: "theme:dark", components: 4, sites: null, quarters: null })).toEqual({ level: "Low", reason: "Low: 4 of 7 components, 0 sites, 0 quarters" });
  });
  it("AI estimates cap at Medium and say so", () => {
    expect(confidence({ key: "aesthetic:minimal", components: 5, sites: 200, quarters: 9 })).toEqual({ level: "Medium", reason: "Medium: 5 of 7 components, 200 sites, 9 quarters, AI estimate (capped at Medium)" });
    expect(confidence({ key: "combo:dark_tech", components: 5, sites: 200, quarters: 9 }).level).toBe("Medium");
    expect(confidence({ key: "aesthetic:minimal", components: 1, sites: 2, quarters: 1 }).level).toBe("Low");
  });
});
