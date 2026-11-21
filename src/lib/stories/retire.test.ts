import { describe, expect, it } from "vitest";
import { rereadRetire, storyChangeIds, type RereadCtx, type RereadVerdict } from "./retire";
describe("I3 · re-read retirements", () => {
  const v: Record<number, RereadVerdict> = { 3684: "reread", 4898: "pass", 4901: "reread", 1: "pass", 2: "pass", 3: "pass", 4: "reread", 7: "alternating" };
  const dom: Record<number, string> = { 3684: "1password.com", 4898: "together.ai", 4901: "glean.com", 1: "a.com", 2: "b.com", 3: "c.com", 4: "d.com", 7: "venmo.com" };
  const ctx: RereadCtx = { verdict: id => v[id] ?? null, domainOf: id => dom[id] ?? null, nameOf: d => ({ "1password.com": "1Password", "glean.com": "Glean", "together.ai": "Together AI", "venmo.com": "Venmo" } as Record<string, string>)[d] ?? d };
  it("No. 91: one of three brands left is not a roundup", () => expect(rereadRetire({ id: "roundup:all:aesthetic:corporate:2026-11-20", type: "roundup", source_ids: ["event:3684", "event:4898", "event:4901"] }, ctx)).toBe("Retired: on a second look one of three brands still passes; 1Password and Glean were AI re-reads with no measured change"));
  it("three brands still passing keep the roundup", () => expect(rereadRetire({ id: "roundup:x", type: "roundup", source_ids: ["event:1", "event:2", "event:3", "event:4"] }, ctx)).toBeNull());
  it("a story with no marked change is untouched", () => expect(rereadRetire({ id: "roundup:y", type: "roundup", source_ids: ["event:1", "event:7"] }, ctx)).toBeNull());
  it("names what failed for another reason too", () => expect(rereadRetire({ id: "against:2026-W47:measured", type: "roundup", source_ids: ["story:counter:1:aesthetic:x", "story:counter:4:aesthetic:y", "story:counter:7:aesthetic:z"] }, ctx)).toBe("Retired: on a second look one of three brands still passes; d.com was an AI re-read with no measured change; Venmo no longer passes the two-capture check"));
  it("a single-brand story on a re-read is retired", () => expect(rereadRetire({ id: "move:4901", type: "move", source_ids: [] }, ctx)).toMatch(/AI re-read of an unchanged page/));
  it("a corrected story is judged on the brands it shows now", () => expect(rereadRetire({ id: "against:w", type: "roundup", source_ids: ["event:1", "event:2", "event:3", "event:4"], members: ["a.com", "b.com", "d.com"] }, ctx)).toMatch(/two of three brands still pass; d\.com was an AI re-read/));
  it("finds counter-move event ids", () => expect(storyChangeIds({ id: "against:w", source_ids: ["story:counter:4765:aesthetic:editorial", "event:12", "story:move:9", "wire:5"] })).toEqual([4765, 12, 9]));
});
