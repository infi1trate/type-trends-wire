import { describe, expect, it } from "vitest";
import { LEAD_COVERAGE, leadFigure } from "./front";
import { isNewIssue } from "../digest/week";

describe("lead evidence slot", () => {
  it("a series fills the slot: the number with unit and date, the trail, the coverage caption", () => {
    const f = leadFigure({ kind: "spark", key: "css:has", name: "CSS :has()", points: [0.12, 0.2, 0.31], quarters: ["2026Q2", "2026Q3", "2026Q4"] })!;
    expect(f).toMatchObject({ value: "31.0%", unit: "of tracked homepages", date: "Q4 2026", caption: LEAD_COVERAGE });
    expect(f.trail).toEqual([{ x: "2026Q2", y: 0.12 }, { x: "2026Q3", y: 0.2 }, { x: "2026Q4", y: 0.31 }]);
  });
  it("one point: the number alone, no trail", () => {
    const f = leadFigure({ kind: "spark", key: "k", name: "K", points: [0.4] })!;
    expect(f.value).toBe("40.0%"); expect(f.trail).toBeNull(); expect(f.date).toBeNull();
  });
  it("no series or crops: no figure", () => {
    expect(leadFigure(null)).toBeNull();
    expect(leadFigure({ kind: "spark", key: "k", name: "K", points: [] })).toBeNull();
  });
});

describe("Digest 'New' sticker", () => {
  it("shows for seven days after the issue's week ends", () => {
    expect(isNewIssue("2026-W46", Date.parse("2026-11-15T12:00:00Z"))).toBe(false);
    expect(isNewIssue("2026-W46", Date.parse("2026-11-17T12:00:00Z"))).toBe(true);
    expect(isNewIssue("2026-W46", Date.parse("2026-11-30T12:00:00Z"))).toBe(false);
  });
});
