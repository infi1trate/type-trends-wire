// Phase E0b · close the gaps: seasonal on either capture, changes reversed within seven days, the pattern-first front lead,
// the self-recovering AI worker, and the same rules applied to stories already published.
import { describe, expect, it } from "vitest";
import type { EventRow } from "../agency/changes";
import { seasonalChange } from "../promo";
import { REVERSED_REASON, reversalMarks } from "../reversal";
import { allCandidates, type BuildInput } from "./candidates";
import { storyRules } from "./rules";
import { E0_RETIRE, e0Verdict, reversedStory, type E0Ctx, type E0Story } from "./retire";
import { runBuild, type BuildDeps } from "./build.server";
import { pickLead } from "../front/front";
import { D, H, NOW, iso, st } from "../front/fixtures";
import { nextProbeAt, pauseNote, probeStep, PROBE_EVERY_MS, type ProbeControl, type ProbeDeps } from "../ai-probe";
import { buildHealth } from "../health";

const T0 = Date.parse("2026-11-11T12:00:00Z");
const at = (days: number) => new Date(T0 + days * D).toISOString();
const ev = (id: number, type: string, before: Record<string, unknown>, after: Record<string, unknown>, days: number, o: Partial<EventRow> = {}): EventRow =>
  ({ id, domain: "tiktok.com", sector: "media", type, before, after, detected_at: at(days), source: "live", page_type: "home", viewport: "desktop", ...o });

describe("1 · seasonal means sale wording on either capture", () => {
  it("promo on the after capture only, the before only, or both is seasonal; neither is not", () => {
    expect(seasonalChange(["UP TO $200 OFF TOP CAMERAS"], ["Be a hero"])).toBe(true);
    expect(seasonalChange(["Be a hero"], ["Shop Deals"])).toBe(true);
    expect(seasonalChange(["25% Off Sitewide Black Friday Sale"], ["The Gift Guide's Here!"])).toBe(true);
    expect(seasonalChange(["Reach new peaks"], ["Be a hero"])).toBe(false);
  });
});

describe("2 · a change that reverses within seven days is not a move", () => {
  const dark = { theme: "dark" }, light = { theme: "light" };
  it("A→B then B→A inside 7 days marks both", () => {
    const m = reversalMarks([ev(1, "theme_flip", dark, light, 0), ev(2, "theme_flip", light, dark, 2)]);
    expect(m.get(1)).toMatchObject({ reversed: true, reversal: false }); expect(m.get(2)).toMatchObject({ reversed: false, reversal: true });
  });
  it("8 days apart marks neither", () => expect(reversalMarks([ev(1, "theme_flip", dark, light, 0), ev(2, "theme_flip", light, dark, 8)]).size).toBe(0));
  it("A→B then B→C marks neither", () => {
    const m = reversalMarks([ev(1, "layout_change", { hero_media: "image" }, { hero_media: "video" }, 0), ev(2, "layout_change", { hero_media: "video" }, { hero_media: "canvas" }, 1)]);
    expect(m.size).toBe(0);
  });
  it("three flips mark all three", () => {
    const img = { hero_media: "image" }, vid = { hero_media: "video" };
    const m = reversalMarks([ev(1, "layout_change", img, vid, 0, { domain: "neon.com" }), ev(2, "layout_change", vid, img, 2, { domain: "neon.com" }), ev(3, "layout_change", img, vid, 3, { domain: "neon.com" })]);
    expect([...m.keys()].sort()).toEqual([1, 2, 3]);
    expect(m.get(2)).toMatchObject({ reversed: true, reversal: true });
  });
  it("another page type or viewport is not a reversal", () => expect(reversalMarks([ev(1, "theme_flip", dark, light, 0), ev(2, "theme_flip", light, dark, 1, { viewport: "mobile" })]).size).toBe(0));
  const input = (events: EventRow[], o: Partial<BuildInput> = {}): BuildInput => ({ now: at(3), events, rebrands: [], alerts: [], wire: [], launches: [], archive: [], trendsetters: [], runs: [], sites: [], ...o });
  it("both changes are tape lines marked Reversed; a change back finds an earlier change kept in history", () => {
    const a = ev(1, "theme_flip", dark, light, 0), b = ev(2, "theme_flip", light, dark, 2);
    const r = allCandidates(input([a, b]));
    expect(r.candidates.some(c => c.sourceIds.includes("event:1") || c.sourceIds.includes("event:2"))).toBe(false);
    expect(r.tape[1]).toMatch(/· Reversed$/); expect(r.tape[2]).toMatch(/· Reversed$/);
    expect(REVERSED_REASON).toBe("Reversed within seven days");
    const late = allCandidates(input([b], { history: [a, b] }));
    expect(late.tape[2]).toMatch(/· Reversed$/); expect(late.reversed).toEqual([1, 2]);
  });
  it("an identity change made only of reversed changes is no story, judged by its own events", () => {
    const a = ev(1, "palette_shift", { accent: "#FF5128" }, { accent: "#FFAE02" }, 0, { domain: "mistral.ai" }), b = ev(2, "palette_shift", { accent: "#FFAE02" }, { accent: "#FF5127" }, 3, { domain: "mistral.ai" });
    const r = allCandidates(input([a, b], { rebrands: [{ domain: "mistral.ai", sector: "ai", name: "Mistral", confirmed_at: at(0), read: "", reasons: ["accent"], event_ids: [1] }] }));
    expect(r.candidates.filter(x => x.domains.includes("mistral.ai"))).toEqual([]);
  });
  it("a build that sees the reversal asks to retire the story that ran on the first change", async () => {
    const a = ev(1, "theme_flip", dark, light, 0), b = ev(2, "theme_flip", light, dark, 2), asked: number[][] = [];
    const deps: BuildDeps = { load: async () => input([b], { history: [a, b] }), existing: async () => [], insert: async rows => rows.length, retireReversed: async ids => { asked.push(ids); return 1; } };
    const res = await runBuild(deps, { now: () => Date.parse(at(3)) });
    expect(asked).toEqual([[1, 2]]); expect(res.retired_reversed).toBe(1);
    expect(reversedStory({ id: "move:1", type: "move", source_ids: ["event:1"] }, new Set([1, 2]))).toBe(true);
    expect(reversedStory({ id: "move:9", type: "move", source_ids: ["event:9"] }, new Set([1, 2]))).toBe(false);
    expect(reversedStory({ id: "rebrand:x.com:2026-11-11", type: "rebrand", source_ids: ["story:move:1"] }, new Set([1]))).toBe(false);
  });
  it("the cleanup retires a published move on a reversed change with the plain reason", () => {
    const e = ev(1, "theme_flip", dark, light, 0);
    const ctx: E0Ctx = { event: id => (id === 1 ? e : null), seasonal: () => false, rebrand: () => null, news: () => null, reversed: id => id === 1 };
    const s: E0Story = { id: "move:1", type: "move", sector: "media", signal_keys: [], domains: ["tiktok.com"], source_ids: ["event:1"], kicker: "Move", headline: "tiktok.com switched to a light theme", deck: null, facts: [] };
    const v = e0Verdict(s, ctx);
    expect(v).toEqual({ kill: "reversed" }); expect(E0_RETIRE.reversed).toBe("Retired: reversed within seven days");
  });
  it("/what-we-show states the reversal rule and the either-capture seasonal rule", () => {
    const text = storyRules().map(r => r.text).join(" ");
    expect(text).toMatch(/changed back within 7 days/); expect(text).toMatch(/either capture/);
  });
});

describe("3 · the front page lead is a pattern when there is one", () => {
  it("a pattern story from the last 72 hours beats a higher-scoring single-brand move", () => {
    const l = pickLead([st("move:big", { score: 95, happened_at: iso(NOW - 2 * H) }), st("roundup:x", { type: "roundup", score: 50, happened_at: iso(NOW - 60 * H) })], "all", NOW);
    expect(l?.story.id).toBe("roundup:x");
  });
  it("with no pattern story, the best single-brand story from the last 24 hours leads", () => {
    const l = pickLead([st("move:a", { score: 60, happened_at: iso(NOW - 3 * H) }), st("move:b", { score: 70, happened_at: iso(NOW - 20 * H) }), st("move:old", { score: 99, happened_at: iso(NOW - 30 * H) }), st("ws:old", { type: "white_space", score: 99, happened_at: iso(NOW - 4 * D) })], "all", NOW);
    expect(l?.story.id).toBe("move:b");
  });
  it("a pin beats both", () => {
    const l = pickLead([st("roundup:x", { type: "roundup", score: 90 }), st("move:best", { score: 99 }), st("move:pin", { score: 10, pinnedUntil: iso(NOW + D) })], "all", NOW);
    expect(l?.story.id).toBe("move:pin"); expect(l?.label).toBe("Pinned by the editor");
  });
});

describe("5 · the AI worker recovers by itself", () => {
  const PAUSED_AT = Date.parse("2026-11-19T12:10:00Z");
  const world = (model: () => "ok" | "workspace_credits") => {
    const c: ProbeControl & { lease: boolean } = { paused: true, reason: "workspace_credits", paused_at: new Date(PAUSED_AT).toISOString(), probed_at: null, lease: false };
    let calls = 0, clock = PAUSED_AT;
    const deps: ProbeDeps = {
      control: async () => ({ paused: c.paused, reason: c.reason, paused_at: c.paused_at, probed_at: c.probed_at }),
      // Mirrors library_ai_probe_acquire: still paused for a probe reason, no live lease, nothing in the last hour.
      acquire: async () => { const due = nextProbeAt(c); if (c.lease || due == null || due > clock) return false; c.lease = true; c.probed_at = new Date(clock).toISOString(); c.paused = false; return true; },
      runOne: async () => { calls++; const r = model(); return r === "ok" ? { called: true, ok: true, code: null } : { called: true, ok: false, code: r }; },
      settle: async (_t, ok, reason) => { c.lease = false; if (ok) { c.paused = false; c.reason = null; c.paused_at = null; } else { c.paused = true; c.reason = reason ?? c.reason; } },
    };
    return { c, deps, calls: () => calls, at: (t: number) => { clock = t; return probeStep(deps, t, "tok"); } };
  };
  it("a paused worker does not call the model more than once inside an hour", async () => {
    const w = world(() => "workspace_credits");
    for (const min of [5, 30, 59]) expect((await w.at(PAUSED_AT + min * 6e4)).state).toBe("waiting");
    expect(w.calls()).toBe(0);
    for (const min of [61, 70, 90, 120]) await w.at(PAUSED_AT + min * 6e4);
    expect(w.calls()).toBe(1);
    await w.at(PAUSED_AT + 122 * 6e4);
    expect(w.calls()).toBe(2);
  });
  it("a successful probe clears the pause", async () => {
    const w = world(() => "ok");
    expect(await w.at(PAUSED_AT + PROBE_EVERY_MS)).toEqual({ state: "probed", ok: true, code: null });
    expect(w.c).toMatchObject({ paused: false, reason: null, paused_at: null });
  });
  it("a failed probe keeps the pause and records the try", async () => {
    const w = world(() => "workspace_credits"), t = PAUSED_AT + 2 * PROBE_EVERY_MS;
    expect(await w.at(t)).toEqual({ state: "probed", ok: false, code: "workspace_credits" });
    expect(w.c).toMatchObject({ paused: true, reason: "workspace_credits", probed_at: new Date(t).toISOString() });
  });
  it("health and the status page say the reason and when the next probe is due, through the existing note", () => {
    const h = buildHealth({ ai_jobs: { pending: 4, paused: true }, ai_pause: { paused: true, reason: "workspace_credits", paused_at: "2026-11-19T12:10:00Z", probed_at: null } }, new Date("2026-11-19T12:40:00Z"));
    const j = h.jobs.find(x => x.job === "library_ai")!;
    expect(j.last_status).toBe("paused");
    expect(j.note).toContain("ran out of credits"); expect(j.note).toContain("13:10 UTC 19 Nov");
    expect(pauseNote({ paused: true, reason: "provider_or_policy_denied", paused_at: null, probed_at: null }, NOW)).toContain("needs a person");
  });
});
