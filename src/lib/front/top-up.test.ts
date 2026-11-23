import { describe, expect, it } from "vitest";
import { gapsFor, topUpCount, TOP_UP_TOLERANCE_PX, type ColumnsIn } from "./top-up";

// D1b · Today's left column is topped up on the server (no measuring after load) so both columns end within 160 px at 1024–1440.
// The 23 Nov page: six story rows in two day groups, three studies, three editions; rail with chart, your sector, five explore rows and
// five collections; measured 473 / 470 / 453 px apart at 1024 / 1280 / 1440.
const NOV23: ColumnsIn = { storyRows: 6, groups: 2, studies: 3, editions: 3, chart: true, strip: true, explore: 5, collections: 5, available: 40 };

describe("Today's left-column top-up", () => {
  it("reproduces the measured gaps of 23 Nov within 20 px", () => {
    const g = gapsFor(NOV23, 0);
    expect(Math.abs(g[1024] - 473)).toBeLessThanOrEqual(20);
    expect(Math.abs(g[1280] - 470)).toBeLessThanOrEqual(20);
    expect(Math.abs(g[1440] - 453)).toBeLessThanOrEqual(20);
  });
  it("adds stories until both columns end within 160 px at 1024, 1280 and 1440", () => {
    const n = topUpCount(NOV23);
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(5);
    for (const gap of Object.values(gapsFor(NOV23, n))) expect(Math.abs(gap)).toBeLessThanOrEqual(TOP_UP_TOLERANCE_PX);
  });
  it("adds nothing when the columns already end within 160 px", () => {
    expect(topUpCount({ ...NOV23, storyRows: 11 })).toBe(0);
  });
  it("never adds more than five, nor more than there are", () => {
    expect(topUpCount({ ...NOV23, storyRows: 0, groups: 0 })).toBe(5);
    expect(topUpCount({ ...NOV23, available: 2 })).toBe(2);
    expect(topUpCount({ ...NOV23, available: 0 })).toBe(0);
  });
  it("adds nothing when the left column is the longer one", () => {
    expect(topUpCount({ ...NOV23, storyRows: 20, chart: false })).toBe(0);
  });
});
