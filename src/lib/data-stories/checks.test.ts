import { describe, expect, it } from "vitest";
import { BIG_TYPE, FINTECH_COLOUR, SECTOR_MINDS, SOFTWARE, bigTypeFigures, bigTypeVerdict, fintechFigures, fintechVerdict, sectorMindsFigures, sectorMindsVerdict, softwareFigures, softwareVerdict } from "./checks";
import { fxInput } from "./fixtures";

describe("is there a story? — thresholds on both sides", () => {
  it("a. software: needs 3 composites moving 5 points and 2 brands with 6 usable captures", () => {
    expect(SOFTWARE).toMatchObject({ movePts: 0.05, minMoved: 3, minCaptures: 6, minBrands: 2 });
    expect(softwareVerdict({ moved: 3, brandsWithCaptures: 2 }).pass).toBe(true);
    expect(softwareVerdict({ moved: 2, brandsWithCaptures: 9 })).toMatchObject({ pass: false });
    expect(softwareVerdict({ moved: 8, brandsWithCaptures: 1 }).reason).toMatch(/Only 1 brands have 6\+ usable captures/);
  });
  it("a. on fixtures: five quarters give each brand five usable captures, short of six", () => {
    const f = softwareFigures(fxInput());
    expect(f.quarters).toBe(5);
    expect(f.topBrands[0]!.captures).toBe(5);
    expect(f.brandsWithCaptures).toBe(0);
    expect(f.moved).toBeGreaterThanOrEqual(2); // Big type and motion move by design
    expect(softwareVerdict(f).pass).toBe(false);
    const six = softwareFigures(fxInput({ quarters: ["2021Q1", "2021Q2", "2022Q1", "2023Q1", "2024Q1", "2026Q4"] }));
    expect(six.brandsWithCaptures).toBe(40);
  });
  it("b. big type: needs 25 adopters with an established first quarter", () => {
    expect(BIG_TYPE.minEntries).toBe(25);
    expect(bigTypeVerdict({ entries: 25 }).pass).toBe(true);
    expect(bigTypeVerdict({ entries: 24 }).pass).toBe(false);
    // adoptAt = i % 6: indexes 1–4 are established, 0 is already there, 5 never → 40 of 60 established
    const f = bigTypeFigures(fxInput());
    expect(f).toMatchObject({ entries: 40, censored: 10, never: 10 });
    expect(bigTypeFigures(fxInput({ perSector: 3 })).entries).toBeLessThan(25);
  });
  it("b. a brand that already shows it in its first well-covered capture is not counted as established", () => {
    const f = bigTypeFigures(fxInput({ adoptAt: () => 0 }));
    expect(f).toMatchObject({ entries: 0, censored: 60 });
  });
  it("c. fintech colour: needs 8 well-covered quarters with palettes for 15 fintech brands", () => {
    expect(FINTECH_COLOUR).toMatchObject({ minQuarters: 8, minBrands: 15 });
    expect(fintechVerdict({ quarters: 8 }).pass).toBe(true);
    expect(fintechVerdict({ quarters: 7 }).pass).toBe(false);
    expect(fintechFigures(fxInput()).quarters).toBe(5);
    const nine = ["2021Q1", "2021Q3", "2022Q1", "2022Q3", "2023Q1", "2023Q3", "2024Q1", "2024Q3", "2026Q4"];
    expect(fintechFigures(fxInput({ quarters: nine })).quarters).toBe(9);
    expect(fintechFigures(fxInput({ quarters: nine, perSector: 14 })).quarters).toBe(0);
  });
  it("d. sector minds: needs 6 sectors with 10 dated events", () => {
    expect(SECTOR_MINDS).toMatchObject({ minEvents: 10, minSectors: 6 });
    expect(sectorMindsVerdict({ sectors: 6 }).pass).toBe(true);
    expect(sectorMindsVerdict({ sectors: 5 }).pass).toBe(false);
    const f = sectorMindsFigures(fxInput());
    expect(f.sectors).toBe(3); // the fixture has three sectors
    expect(f.perSector.filter(p => p.events >= 10).map(p => p.sector).sort()).toEqual(["dev-tools", "enterprise-saas", "fintech"]);
  });
});
