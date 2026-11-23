import { describe, it, expect } from "vitest";
import { LAUNCH_BEAT_TOPICS, LAUNCH_VOTE_FLOOR, LAUNCH_VOTE_FLOOR_NO_TOPICS, launchVerdict, onTheLine, phRunLine, wireShown } from "./launches";

describe("PH1 · the floor and the beat", () => {
  it("the floor starts at 150, and 300 when topics cannot be read", () => {
    expect(LAUNCH_VOTE_FLOOR).toBe(150); expect(LAUNCH_VOTE_FLOOR_NO_TOPICS).toBe(300);
  });
  it("the beat is the eight topics, by slug", () => {
    expect([...LAUNCH_BEAT_TOPICS]).toEqual(["design-tools", "web-design", "branding", "typography", "user-experience", "no-code", "developer-tools", "website-builder"]);
  });
  it("needs both: votes at the floor and a beat topic", () => {
    expect(onTheLine({ votes: 150, topics: ["design-tools"] })).toBe(true);
    expect(launchVerdict({ votes: 149, topics: ["design-tools"] }).why).toBe("below_floor");
    expect(launchVerdict({ votes: 900, topics: ["marketing", "artificial-intelligence"] }).why).toBe("off_beat");
    expect(launchVerdict({ votes: 900, topics: [] }).why).toBe("off_beat");
  });
  it("without topics it keeps the floor only, raised to 300, and never guesses the beat", () => {
    expect(launchVerdict({ votes: 299, topics: null })).toEqual({ pass: false, floor: 300, why: "below_floor" });
    expect(onTheLine({ votes: 300, topics: null })).toBe(true);
  });
  it("a launch whose votes were never read (stored before PH1) is not a candidate", () => {
    expect(launchVerdict({ votes: null, topics: ["no-code"] }).why).toBe("no_votes");
  });
  it("readers see other sources as before and launches only over the line", () => {
    expect(wireShown({ source_kind: "rss" })).toBe(true);
    expect(wireShown({ source_kind: "producthunt", votes: 0, topics: null })).toBe(false);
    expect(wireShown({ source_kind: "producthunt", votes: 412, topics: ["web-design"] })).toBe(true);
  });
  it("the run row says what was fetched and what passed, in plain words", () => {
    expect(phRunLine({ day: "2026-11-22", fetched: 20, written: 20, updated: 0, topicsRead: true, passed: 3 })).toBe("20 fetched for 22 Nov (Pacific), 3 over the floor and on topic, 20 new");
    expect(phRunLine({ day: "2026-11-22", fetched: 20, written: 0, updated: 2, topicsRead: false, passed: 1 })).toBe("20 fetched for 22 Nov (Pacific), 1 over the 300-vote floor (topics not readable), 0 new, 2 brought up to the finished day");
  });
});
