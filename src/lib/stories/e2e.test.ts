// E2e · a correction may drop members of a gathered story whose changes failed the integrity check, and can never add one.
import { describe, expect, it, vi } from "vitest";
// P2 · these tests build whole story days from fixtures (1.5 to 4 s alone); under the full suite's load they ran past vitest's 5 s default.
vi.setConfig({ testTimeout: 30_000 });
import { applyEdits, type EditRow, type StoredStory } from "./edits";

const story: StoredStory = {
  id: "against:2026-W47:measured", type: "roundup", status: "published", reason: "", score: 1, components: {}, why_ran: "", kicker: "Roundup · Against the grain",
  headline: "13 brands moved against the grain", deck: "Vuori, On and Rothy's…", facts: [], why_line: null, why_model: null, why_at: null, sector: null, signal_keys: [],
  domains: ["netlify.com", "vuoriclothing.com", "on.com", "rothys.com"], evidence: [{ label: "Vuori", href: "/brands/vuoriclothing.com" }],
  source_ids: ["story:counter:4765:aesthetic:editorial", "story:counter:3414:hero_media:video", "story:counter:3348:hero_media:video", "story:counter:4829:hero_media:video"],
  basis: "ai", happened_at: "2026-11-20T09:00:00Z", created_at: "2026-11-20T10:00:00Z",
};
const edit = (payload: Record<string, unknown>): EditRow => ({ id: 1, story_id: story.id, action: "correct", payload, note: "Corrected", at: "2026-11-20T16:00:00Z" });

describe("E2e · narrowing a gathered story", () => {
  it("keeps only the passing members (Netlify, On), with the corrected headline and evidence", () => {
    const s = applyEdits(story, [edit({ headline: "Two brands moved against the grain", domains: ["netlify.com", "on.com"], source_ids: ["story:counter:4765:aesthetic:editorial", "story:counter:3348:hero_media:video"], evidence: [{ label: "On", href: "/brands/on.com" }] })], Date.now());
    expect(s.domains).toEqual(["netlify.com", "on.com"]);
    expect(s.source_ids).toEqual(["story:counter:4765:aesthetic:editorial", "story:counter:3348:hero_media:video"]);
    expect(s.evidence).toEqual([{ label: "On", href: "/brands/on.com" }]);
    expect(s.headline).toBe("Two brands moved against the grain");
  });
  it("never adds a brand or a source the stored story did not have", () => {
    const s = applyEdits(story, [edit({ domains: ["on.com", "cursor.com"], source_ids: ["story:counter:4799:aesthetic:editorial"] })], Date.now());
    expect(s.domains).toEqual(["on.com"]);
    expect(s.source_ids).toEqual([]);
  });
  it("a correction without member lists leaves the members as stored", () => {
    const s = applyEdits(story, [edit({ headline: "x" })], Date.now());
    expect(s.domains).toEqual(story.domains);
    expect(s.source_ids).toEqual(story.source_ids);
  });
  it("I3b · a correction's dated line is kept for readers, and later corrections without one keep it", () => {
    const note = "Corrected 21 Nov: an earlier version named Ragged Edge. The site we had on file under that name was a different business.";
    const s = applyEdits(story, [edit({ domains: ["on.com"], correction: note }), { ...edit({ headline: "y" }), id: 2, at: "2026-11-21T16:00:00Z" }], Date.now());
    expect(s.correctionNotes).toEqual([note]);
    expect(applyEdits(story, [edit({ headline: "x" })], Date.now()).correctionNotes).toEqual([]);
  });
});

import type { Check } from "../integrity";
import type { BuildInput } from "./candidates";
import { runBuild, type BuildDeps } from "./build.server";
import { goldenChecks, goldenInput } from "./golden/run";

describe("E2e · the build stores the verdicts first and plans only what passes", () => {
  const NETLIFY = [4756, 4757, 4758, 4759];
  const seenOnce: Check = { verdict: "seen_once", pass: [], fields: { h1: { verdict: "seen_once", failed: ["two_before"], before: 1, after: 7, beforeHours: 0, afterHours: 9.5, transitions: 1 } } };
  const build = async (checks: Record<number, Check> | undefined) => {
    const recorded: Record<number, Check>[] = [], inserted: string[] = [];
    const input = { ...goldenInput(), checks } as BuildInput;
    const deps: BuildDeps = { load: async () => input, existing: async () => [], insert: async rows => (inserted.push(...rows.filter(r => r.status === "published").map(r => r.id)), rows.length), recordChecks: async c => (recorded.push(c), Object.keys(c).length) };
    const res = await runBuild(deps, { now: () => Date.parse(input.now) });
    return { recorded, inserted, res };
  };
  it("Netlify (20 Nov) passes and runs; the verdicts are stored before planning", async () => {
    const { recorded, inserted, res } = await build(goldenChecks);
    expect(recorded).toEqual([goldenChecks]);
    expect(res.ok && "checks_recorded" in res ? res.checks_recorded : null).toBe(Object.keys(goldenChecks).length);
    expect(inserted.some(id => id.startsWith("brand:netlify.com"))).toBe(true);
  });
  it("the same Netlify changes seen once before make no story", async () => {
    const checks = { ...goldenChecks, ...Object.fromEntries(NETLIFY.map(id => [id, seenOnce])) };
    expect((await build(checks)).inserted.some(id => id.includes("netlify.com"))).toBe(false);
  });
  it("a live change with no verdict yet is not planned (fail closed)", async () => {
    const checks = Object.fromEntries(Object.entries(goldenChecks).filter(([k]) => !NETLIFY.includes(Number(k))));
    expect((await build(checks)).inserted.some(id => id.includes("netlify.com"))).toBe(false);
  });
});
