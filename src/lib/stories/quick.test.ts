import { describe, expect, it } from "vitest";
import { FULL_BUILD_EVERY_MS, printOf, quickDecision, type BuildPrint } from "./quick";

const P: BuildPrint = { events: 9120, wire: 4410, runs: 88, stories: "2026-11-23T02:00:00Z", edits: 1500 };
const now = Date.parse("2026-11-23T13:31:00Z");
describe("D1c · a story build with nothing to do is short", () => {
  it("skips the full build when nothing moved since a full build under two hours ago", () => {
    const d = quickDecision({ print: P, at: "2026-11-23T12:31:00Z" }, { ...P }, now);
    expect(d.skip).toBe(true);
    expect(d.why).toBe("nothing new since the full build at 12:31 UTC");
  });
  it("builds in full when one new change arrived", () => {
    expect(quickDecision({ print: P, at: "2026-11-23T12:31:00Z" }, { ...P, events: 9121 }, now)).toEqual({ skip: false, why: "new since the last full build: events" });
  });
  it("builds in full every two hours even when nothing moved", () => {
    expect(quickDecision({ print: P, at: new Date(now - FULL_BUILD_EVERY_MS).toISOString() }, P, now).skip).toBe(false);
  });
  it("builds in full when a newest id cannot be read, or no full build is on record", () => {
    expect(quickDecision({ print: P, at: "2026-11-23T12:31:00Z" }, { ...P, edits: null }, now).skip).toBe(false);
    expect(quickDecision(null, P, now).skip).toBe(false);
    expect(quickDecision({ print: P, at: "2026-11-23T12:31:00Z" }, null, now).skip).toBe(false);
  });
  it("reads a stored print back from a finish row", () => {
    expect(printOf({ print: P, full: true })).toEqual(P);
    expect(printOf({ why: "x" })).toBeNull();
  });
});
