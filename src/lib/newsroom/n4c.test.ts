import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { checklist, type ReviewInput } from "./standards";
import { recheckDue, RECHECKED, isChecklistHold } from "./review";
import { CHECKLIST_FILES, checklistFingerprint } from "./checklist-fp";
import { CHECKLIST_FINGERPRINT } from "./checklist-fp.gen";
import { REVIEW_ITEMS_MAX, REVIEW_MINUTES, REVIEW_PASS_MS, REVIEW_SCHEDULE, reviewBusy, reviewSlot } from "./review-pass";
import { bare, lineFailures, offBeat } from "./news";
import { doorPictures } from "./graphics";
import { deskBody } from "../stories/desk";
import { jobLines, pairRuns, runNote, runProblems, type RunRow } from "../jobs/runs";
import { JOBS, followUpsFact, freshness, freshnessLine } from "../freshness";

// 1 · the false hold: the deck cites the earlier run's share, which the stored facts carry and the rebuilt sheet replaced.
const sheetOf = (share: string) => ({ type: "crossover", kind: "Crossover", sector: "Media", brands: [], changes: [], copy: [], headline_call: null, dates: [], rebrand: false,
  numbers: [{ text: `Media: 5 of 28 tracked Media homepages in run 16 (${share}%)`, basis: "measured" }], lines: [] });
const story = (id: string, share: string, withFacts = true): ReviewInput => ({
  id, number: null, type: "crossover", basis: "measured", kicker: "Crossover", headline: "Media homepages took it up", deck: `It now shows on ${share}% of media homepages, up from 8.3%.`, body: [], howWeKnow: "Measured from homepage captures.",
  numbers: [], picture: null, facts: withFacts ? [{ text: `Media: 8.3% in run 13 → ${share}% in run 16`, kind: "number", basis: "measured", href: null }] : [], sheet: sheetOf(share) as never,
  domains: [], brands: [], news: null, quietEvent: null, sourceIds: [], written: true,
} as unknown as ReviewInput);
const numbersOf = (i: ReviewInput) => checklist(i).find(x => x.id === "numbers")!;

describe("N4c · checklist item 1 (numbers)", () => {
  it("passes crossover:tone:calm:media:16 (8.3% is on its stored facts)", () => expect(numbersOf(story("crossover:tone:calm:media:16", "17.9")).result).toBe("pass"));
  it("passes crossover:hero_layout:split_left_text:media:16", () => expect(numbersOf(story("crossover:hero_layout:split_left_text:media:16", "25.0")).result).toBe("pass"));
  it("still fails a number that is on neither the sheet nor the stored facts", () => expect(numbersOf(story("crossover:tone:calm:media:16", "17.9", false))).toMatchObject({ result: "fail", detail: "not on the facts sheet: 8.3" }));
});

describe("N4c · checklist holds clear themselves once after a checklist fix", () => {
  const hold = (id: number, story: string, fp: string | null) => ({ id, story_id: story, verdict: "hold", second_reader: "not run", at: "2026-11-22T10:45:00Z", fingerprint: fp });
  it("re-checks a checklist hold made under another fingerprint (or none), once", () => {
    expect(recheckDue([hold(1, "a", null), hold(2, "b", "old")], "new").sort()).toEqual(["a", "b"]);
    // After the re-check the newest review carries the new fingerprint: not due again, whatever it found.
    expect(recheckDue([hold(1, "a", null), { ...hold(3, "a", "new"), verdict: "pass", second_reader: "ran" }], "new")).toEqual([]);
    // A re-check that passed is offered to the editor in chief until it places it (the story stops being held by standards).
    expect(recheckDue([hold(1, "a", null), { ...hold(3, "a", "new"), verdict: "pass", second_reader: "ran", reason: RECHECKED }], "new")).toEqual(["a"]);
    expect(recheckDue([hold(1, "a", null), hold(3, "a", "new")], "new")).toEqual([]);
  });
  it("never re-checks a second-reader hold or a pass", () => {
    expect(isChecklistHold({ verdict: "hold", second_reader: "hold" })).toBe(false);
    expect(recheckDue([{ ...hold(1, "a", null), second_reader: "hold" }, { ...hold(2, "b", null), verdict: "pass" }], "new")).toEqual([]);
    expect(RECHECKED).toBe("Re-checked after a checklist fix.");
  });
  it("the generated fingerprint matches the checklist's files (run scripts/newsroom-docs.ts when it does not)", () =>
    expect(checklistFingerprint(CHECKLIST_FILES.map(f => readFileSync(f, "utf8")))).toBe(CHECKLIST_FINGERPRINT));
});

describe("N4c · the review pass's schedule", () => {
  it("runs every five minutes, never on :00, :15, :30 or :45, at most two stories, under 40 seconds", () => {
    expect(REVIEW_SCHEDULE).toMatchObject({ name: "review-passes", cron: "3-58/5 * * * *", path: "/api/public/jobs/review-passes" });
    expect([...REVIEW_MINUTES]).toEqual(Array.from({ length: 12 }, (_, i) => 3 + 5 * i));
    expect(REVIEW_MINUTES.some(m => m % 15 === 0)).toBe(false);
    expect(REVIEW_ITEMS_MAX).toBe(2); expect(REVIEW_PASS_MS).toBe(40_000);
  });
  it("its minutes are clear of the wire, AI worker and history refresh limits; :15 is not", () => {
    for (const m of REVIEW_MINUTES) for (const s of [0, 20, 45]) expect(reviewBusy(Date.parse(`2026-11-22T10:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}Z`))).toBeNull();
    expect(reviewBusy(Date.parse("2026-11-22T10:15:10Z"))).not.toBeNull();
    expect(reviewSlot(Date.parse("2026-11-22T10:08:31Z"))).toBe("review:2026-11-22T10:05");
  });
});

describe("N4c · the news desk's beat", () => {
  it("drops the jewellery shop interior and architecture; keeps identity, websites, type and design tools", () => {
    expect(offBeat({ title: "stone plinths and secret blue rooms shape bureau de change’s paris jewelry boutique", excerpt: "london-based architecture studio bureau de change has designed a boutique" })).toMatch(/^off the beat/);
    expect(offBeat({ title: "ZHA completes “secular” Théâtre Royal de Rabat in Morocco", excerpt: null })).toMatch(/^off the beat/);
    expect(offBeat({ title: "Eight furniture designs informed by life in New York City", excerpt: null })).toMatch(/^off the beat/);
    expect(offBeat({ title: "Pentagram rebrands the Whitney with a new wordmark", excerpt: "The museum's identity" })).toBeNull();
    expect(offBeat({ title: "A hotel chain's new website", excerpt: null })).toBeNull();
    expect(offBeat({ title: "Klim releases a new typeface", excerpt: null })).toBeNull();
    expect(offBeat({ title: "Figma launches a new design tool", excerpt: null })).toBeNull();
  });
  it("compares names with possessives and punctuation removed", () => {
    const item = { title: "Jony Ive and Margaret Calvert create posters to celebrate decade of Design Museum in Kensington", excerpt: null };
    expect(lineFailures("Ten designers made posters marking the Design Museum’s decade in Kensington.", item)).toEqual([]);
    expect(bare("Bureau de Change’s Paris boutique")).toBe("bureau de change paris boutique");
    expect(lineFailures("The Barbican made posters for the Design Museum.", item)).toContain("the name “Barbican” is not in the item");
  });
});

describe("N4c · the front page's top line", () => {
  // 22 Nov: forecast stored 09:30 UTC, follow-ups 09:35 to 10:00 UTC, read at 11:23 UTC.
  const now = Date.parse("2026-11-22T11:23:00Z");
  const facts = {
    wire: { ran: "2026-11-22T11:15:00Z", finished: "2026-11-22T11:15:24Z" },
    forecast: { ran: "2026-11-22T09:30:00Z", finished: "2026-11-22T09:30:41Z" },
    follow_ups: followUpsFact({ forecastAt: "2026-11-22T09:30:41Z", queuedAt: "2026-11-22T09:30:41Z", finishedAt: "2026-11-22T10:00:00Z", openSince: null, failed: false }),
  };
  it("follow-ups an hour after they finished are not late", () => {
    const rows = freshness(facts, now, JOBS.filter(j => ["wire", "forecast", "follow_ups"].includes(j.id)));
    expect(rows.find(r => r.id === "follow_ups")!.state).not.toBe("late");
    const line = freshnessLine(rows, now);
    expect(line.late).toBe(false);
    expect(line.text).not.toMatch(/Late|follow-ups/i);
  });
  it("follow-ups are late only when a forecast's steps have waited past their own interval", () => {
    const waiting = followUpsFact({ forecastAt: "2026-11-22T09:30:41Z", queuedAt: "2026-11-22T09:30:41Z", finishedAt: null, openSince: "2026-11-22T09:30:41Z", failed: false });
    expect(freshness({ follow_ups: waiting }, now, JOBS.filter(j => j.id === "follow_ups"))[0]!.state).toBe("late");
    expect(freshness({ follow_ups: waiting }, Date.parse("2026-11-22T09:40:00Z"), JOBS.filter(j => j.id === "follow_ups"))[0]!.state).not.toBe("late");
  });
});

describe("N4c · job runs", () => {
  const now = Date.parse("2026-11-22T12:00:00Z");
  const start = (id: number, job: string, at: string): RunRow => ({ id, at, job, phase: "start", start_id: null, ok: null, ms: null, note: null });
  const finish = (id: number, of: number, job: string, at: string, ms: number, ok = true): RunRow => ({ id, at, job, phase: "finish", start_id: of, ok, ms, note: "n" });
  it("a start with no finish after five minutes is a run that never finished, and is a health problem", () => {
    const runs = pairRuns([start(1, "story-build", "2026-11-22T11:45:00Z"), start(2, "story-build", "2026-11-22T11:58:00Z")], now);
    expect(runs.map(r => [r.id, r.unfinished])).toEqual([[2, false], [1, true]]);
    expect(runProblems("story-build", runs).map(p => p.key)).toEqual(["health:run-unfinished:story-build"]);
  });
  it("a run over three times its 14-day median is slow; one under it is not", () => {
    const rows: RunRow[] = [];
    for (let i = 0; i < 6; i++) { rows.push(start(10 + 2 * i, "ingest-wire", `2026-11-2${1}T0${i}:00:00Z`)); rows.push(finish(11 + 2 * i, 10 + 2 * i, "ingest-wire", `2026-11-21T0${i}:00:05Z`, 4000)); }
    const slow = [...rows, start(50, "ingest-wire", "2026-11-22T11:00:00Z"), finish(51, 50, "ingest-wire", "2026-11-22T11:00:20Z", 13_000)];
    expect(runProblems("ingest-wire", pairRuns(slow, now)).map(p => p.key)).toEqual(["health:run-slow:ingest-wire"]);
    const ok = [...rows, start(50, "ingest-wire", "2026-11-22T11:00:00Z"), finish(51, 50, "ingest-wire", "2026-11-22T11:00:20Z", 11_000)];
    expect(runProblems("ingest-wire", pairRuns(ok, now))).toEqual([]);
  });
  it("a note never carries a web address", () => expect(runNote("boom at https://x.example/?apikey=abc  now")).toBe("boom at [address] now"));
  it("/desk shows the last 24 hours as one line per job", () => {
    const lines = jobLines(pairRuns([start(1, "review-passes", "2026-11-22T11:03:00Z"), finish(2, 1, "review-passes", "2026-11-22T11:03:31Z", 31_000, false)], now), now);
    expect(lines.find(l => l.job === "review-passes")!.line).toBe("1 run · 1 failed · median 31 s · longest 31 s · last 11:03 UTC failed in 31 s (n)");
    expect(lines.find(l => l.job === "forecast")!.line).toBe("No runs in the last 24 hours.");
  });
});

describe("N4c · the picture check's answer reaches the door", () => {
  it("per-picture answers are sent as { asset, usable, why }, which the door accepts", () => {
    const per = [{ ref: "P1", usable: true, problem: "none" as const, why: "A clear first screen." }, { ref: "P2", usable: false, problem: "change not visible" as const, why: "The layout is cropped off." }];
    const mapped = doorPictures(per as never, [{ ref: "P1", asset: "surface:a.com:1" }, { ref: "P2", asset: "surface:b.com:2" }]);
    expect(mapped).toEqual([{ asset: "surface:a.com:1", usable: true, why: "A clear first screen." }, { asset: "surface:b.com:2", usable: false, why: "change not visible: The layout is cropped off." }]);
    const body = (per_picture: unknown) => ({ action: "picture", id: "crossover:tone:calm:media:16", choice: "rule", reason: "Kept the rule's picture.", verdict: "keep", per_picture });
    expect(deskBody.safeParse(body(mapped)).success).toBe(true);
    expect(deskBody.safeParse(body(per)).success).toBe(false);
  });
});
