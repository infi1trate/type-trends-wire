import { describe, expect, it } from "vitest";
import { CARRY_MAX_AGE_DAYS, carriedLine, carryDecision, LEADING_GROUP, sectionsAt, type CarryInput } from "./vision-carry";

const P = "2026-11-14T12:00:00Z", N = "2026-11-21T12:00:00Z", now = Date.parse("2026-11-21T12:05:00Z");
const same = [{ section: "hero", hash: "a", first_seen_at: "2026-11-01T12:00:00Z", last_seen_at: "2026-11-21T12:02:00Z" }, { section: "footer", hash: "f", first_seen_at: "2026-11-01T12:00:00Z", last_seen_at: "2026-11-21T12:02:00Z" }];
const base: CarryInput = { source: "live", captured_at: N, previous: { captured_at: P, carried_from: null, usable: true }, crops: same, leading: false, now };

describe("T2 picture reads carried forward", () => {
  it("carries the reading when every section's crop is the same as at the previous capture with a reading", () => {
    expect(carryDecision(base)).toEqual({ carry: true, from: P });
    expect(carriedLine(P)).toBe("carried from 14 Nov 2026");
  });
  it("reads again when a section's crop changed, appeared or is not stored", () => {
    const changed = [same[0]!, { section: "footer", hash: "f", first_seen_at: "2026-11-01T12:00:00Z", last_seen_at: "2026-11-18T00:00:00Z" }, { section: "footer", hash: "g", first_seen_at: "2026-11-21T12:01:00Z", last_seen_at: "2026-11-21T12:01:00Z" }];
    expect(carryDecision({ ...base, crops: changed })).toEqual({ carry: false, reason: "crops changed" });
    expect(carryDecision({ ...base, crops: [...same, { section: "cta", hash: "c", first_seen_at: N, last_seen_at: N }] })).toEqual({ carry: false, reason: "crops changed" });
    expect(carryDecision({ ...base, crops: [] })).toEqual({ carry: false, reason: "crops not stored" });
    // This capture's crops not in yet: the newest version was last seen days before it.
    expect(carryDecision({ ...base, crops: same.map(c => ({ ...c, last_seen_at: "2026-11-15T00:00:00Z" })) })).toEqual({ carry: false, reason: "crops not stored" });
  });
  it(`reads again when the reading is older than ${CARRY_MAX_AGE_DAYS} days, counted from the fresh read a carried chain began with`, () => {
    expect(CARRY_MAX_AGE_DAYS).toBe(28);
    expect(carryDecision({ ...base, previous: { captured_at: P, carried_from: "2026-10-20T00:00:00Z", usable: true } })).toEqual({ carry: false, reason: "reading older than 28 days" });
    expect(carryDecision({ ...base, previous: { captured_at: P, carried_from: "2026-10-25T00:00:00Z", usable: true } })).toEqual({ carry: true, from: "2026-10-25T00:00:00Z" });
  });
  it("reads again after a low-confidence reading, for the leading group of 30, and for archive captures", () => {
    expect(LEADING_GROUP).toBe(30);
    expect(carryDecision({ ...base, previous: { captured_at: P, carried_from: null, usable: false } })).toEqual({ carry: false, reason: "earlier reading low confidence" });
    expect(carryDecision({ ...base, leading: true })).toEqual({ carry: false, reason: "leading group" });
    expect(carryDecision({ ...base, source: "wayback" })).toEqual({ carry: false, reason: "archive capture" });
    expect(carryDecision({ ...base, previous: null })).toEqual({ carry: false, reason: "no earlier reading" });
  });
  it("a crop version covers a capture from its first sighting to its last", () => {
    expect([...sectionsAt(same, Date.parse(P))]).toEqual([["hero", "a"], ["footer", "f"]]);
    expect(sectionsAt(same, Date.parse("2026-10-01T00:00:00Z")).size).toBe(0);
  });
});
