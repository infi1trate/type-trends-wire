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

import { launchBox, votesOf } from "./launches";
import { queueHead, queueModel, type StoryRecord } from "./stories/view";
const NOW = Date.parse("2026-11-23T15:16:00Z");
const L = (id: string, votes: number | null, at = "2026-11-22T08:01:00Z", state = "published") => ({ id: `launch:${id}`, type: "launch", state, headline: `${id} — a tool`, deck: votes == null ? null : `${votes} upvotes`, happened_at: at });
describe("PH1 · New on the scene and the Terminal's LAUNCHES", () => {
  it("at most three, most votes first, with votes and launch day, never a number", () => {
    const rows = launchBox([L("a", 171), L("b", 1204), L("c", 268), L("d", 150)], NOW);
    expect(rows.map(r => [r.title, r.votesLine, r.dayLine])).toEqual([["b — a tool", "1,204 upvotes", "Launched 22 Nov"], ["c — a tool", "268 upvotes", "Launched 22 Nov"], ["a — a tool", "171 upvotes", "Launched 22 Nov"]]);
    expect(rows.every(r => !("number" in r))).toBe(true);
  });
  it("a held launch shows nowhere", () => {
    expect(launchBox([L("held", 900, undefined, "held"), L("killed", 900, undefined, "killed")], NOW)).toEqual([]);
  });
  it("only the newest recent launch day; a day with none over the line (or older than two days) has no box", () => {
    expect(launchBox([L("old", 500, "2026-11-21T08:01:00Z"), L("new", 160)], NOW).map(r => r.id)).toEqual(["launch:new"]);
    expect(launchBox([L("stale", 500, "2026-11-19T09:00:00Z")], NOW)).toEqual([]);
    expect(launchBox([], NOW)).toEqual([]);
  });
  it("votes are read from the launch deck", () => { expect(votesOf("412 upvotes")).toBe(412); expect(votesOf("Names x")).toBeNull(); });
  it("the Terminal list neither shows nor counts launches; they come apart", () => {
    const rec = (s: Record<string, unknown>) => ({ score: 10, kicker: "", reason: "", why_ran: null, components: {}, why_line: null, facts: [], edits: [], stored: { headline: "" }, domains: [], signal_keys: [], sector: null, evidence: "", basis: null, number: null, pinnedUntil: null, killReason: null, created_at: s["happened_at"], ...s }) as unknown as StoryRecord;
    const all = [rec({ id: "move:1", type: "move", state: "published", headline: "A move", deck: null, happened_at: "2026-11-23T09:00:00Z" }), rec(L("x", 300)), rec(L("h", 300, undefined, "held"))];
    const head = queueHead(queueModel(all, null, NOW));
    expect(head.published.map(r => r.id)).toEqual(["move:1"]);
    expect(head.held).toBe(0);
    expect(head.launches.map(r => r.id)).toEqual(["launch:x"]);
  });
});
