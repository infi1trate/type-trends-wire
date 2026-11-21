// U2b · one count per claim: the run's sample is the one count; the sheet and the page list share it.
import { describe, expect, it } from "vitest";
import { almostNone, factCovers, runBase, sheetFacts, sheetNumbers, uncovered, whiteSpaceHeadline, type SampleRow } from "./sheet";
import { whiteSpaceGap } from "./candidates";
import type { Fact } from "./types";

const row = (share: number, n: number, q = "2026Q4"): SampleRow => ({ current_share: share, stage: "flat", momentum: 0.4, sample: { q, n, s: share } });

describe("the run's own count", () => {
  it("counts the latest-quarter sample: 4 of 29 health homepages", () => expect(runBase(row(4 / 29, 29))).toEqual({ count: 4, base: 29 }));
  it("refuses a sample that is not the row's share", () => expect(runBase({ current_share: 0.2, sample: { q: "2026Q4", n: 29, s: 0.1 } })).toBeNull());
});

describe("white space on the run's numbers (No. 84 case)", () => {
  const all = row(145 / 281, 281);
  it("4 of 29 (13.8%) is not a white space, whatever current site traits say", () => expect(whiteSpaceGap(all, row(4 / 29, 29))).toBeNull());
  it("1 of 30 with 131 of 251 elsewhere is one, with the run's count", () => {
    const g = whiteSpaceGap(row(132 / 281, 281), row(1 / 30, 30))!;
    expect(g.k).toBe(1); expect(g.n).toBe(30); expect(g.elsewhere).toBeCloseTo(131 / 251, 9);
  });
  it("samples from different quarters are not compared", () => expect(whiteSpaceGap(all, row(0, 24, "2026Q3"))).toBeNull());
});

describe("headline follows the count", () => {
  it("Almost no at most two brands or at most 5%", () => {
    expect(almostNone(2, 10)).toBe(true); expect(almostNone(1, 30)).toBe(true); expect(almostNone(3, 60)).toBe(true); expect(almostNone(3, 30)).toBe(false);
  });
  it("Few above that", () => expect(whiteSpaceHeadline({ count: 3, base: 30, sector: "health", signal: "technical voice", stage: "rising" })).toBe("Few health brands use technical voice; it is rising everywhere else"));
  it("Almost no at one", () => expect(whiteSpaceHeadline({ count: 1, base: 30, sector: "health", signal: "technical voice", stage: "rising" })).toBe("Almost no health brand uses technical voice; it is rising everywhere else"));
});

describe("one sheet, one list", () => {
  const rows = new Map<string, SampleRow>([["tone:technical|all", row(145 / 281, 281)], ["tone:technical|health", row(4 / 29, 29)]]);
  const numbers = sheetNumbers((k, s) => rows.get(`${k}|${s}`), ["tone:technical"], "health");
  const stored: Fact[] = [
    { text: "1 of 30 tracked health brands shows it", href: "/patterns/tone%3Atechnical?sector=health", basis: "ai", kind: "count" },
    { text: "50% of brands in other sectors show it", href: "/patterns/tone%3Atechnical", basis: "ai", kind: "share" },
    { text: "Technical voice is Rising across all sectors", href: "/signals/tone%3Atechnical", basis: "ai", kind: "stage" },
  ];
  it("numbers carry the run's count with its base", () => expect(numbers.map(n => n.text)).toEqual([
    expect.stringContaining("145 of 281 tracked homepages"), expect.stringContaining("4 of 29 tracked Health homepages"),
  ]));
  it("a stored count for the same signal and scope is dropped from the sheet; the elsewhere share and the stage stay", () => {
    expect(factCovers(stored[0]!, "health")).toEqual({ key: "tone:technical", scope: "health" });
    expect(factCovers(stored[1]!, "health")).toBeNull();
    expect(uncovered(stored, numbers, "health").map(f => f.text)).toEqual([stored[1]!.text, stored[2]!.text]);
  });
  it("the page list is the sheet: no second count for one thing", () => {
    const list = sheetFacts(stored, numbers, "health").map(f => f.text);
    expect(list.some(t => t.includes("1 of 30"))).toBe(false);
    expect(list.filter(t => t.includes("4 of 29"))).toHaveLength(1);
  });
});
