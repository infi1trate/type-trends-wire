// Phase 14b: the gap rule, the first-seen archive rules, retirement, rewording and the tighter AI line.
import { describe, expect, it } from "vitest";
import { label } from "../labels";
import type { SignalRow } from "../signals";
import { comparisonPair, MIN_RUN_GAP_DAYS, nextComparison, realRunLine, realRuns } from "../run-gap";
import { archiveMeasured, context, crossoverCandidates, firstSeenCandidates, firstSeenEligible, moveCandidate, rebrandCandidate, rebrandDeck, shiftCandidates, type BuildInput, type SiteNow, type ArchiveRow } from "./candidates";
import { FIRST_SEEN_ARCHIVE_MIN_BRANDS, FIRST_SEEN_ARCHIVE_MIN_QUARTERS, FIRST_SEEN_DIMENSIONS } from "./types";
import { BANNED_PHRASES, knownFrom, validateWhy, whyAngle, WHY_SYSTEM } from "./why";
import { oneBrandFact, retireReason, reword, RETIRE, type RetireCtx } from "./retire";
import { applyEdits, type StoredStory } from "./edits";
import { liveModel, queueModel, type StoryRecord } from "./view";
import { storyRules, storyTypeList } from "./rules";

const NOW = "2026-11-16T12:00:00.000Z";
const row = (key: string, scope: string, o: Partial<SignalRow> = {}): SignalRow => ({ dimension: key.slice(0, key.indexOf(":")), value: key.slice(key.indexOf(":") + 1), scope, status: "ok", stage: "accelerating", momentum: 2, current_share: 0.3, next_wave_score: 1, sites: 20, ...o });
const SECTORS = ["fintech", "ai", "dev-tools"];
const sites = (): SiteNow[] => SECTORS.flatMap(s => Array.from({ length: 20 }, (_, i) => ({ domain: `${s}${i}.com`, name: null, sector: s, captured: "2026-11-14T00:00:00Z", traits: [s === "fintech" ? (i === 1 ? "theme:dark" : "theme:light") : i < 8 ? "theme:dark" : "theme:light"] })));
const rows = (stage: string, fintechDark = 0.02, extra: SignalRow[] = []) => [row("theme:dark", "all", { stage }), row("headline:serif", "all"), ...SECTORS.map(s => row("theme:dark", s, { stage, current_share: s === "fintech" ? fintechDark : 0.4 })), ...SECTORS.map(s => row("headline:serif", s, { current_share: 0.2 })), ...extra];
const input = (runs: BuildInput["runs"], o: Partial<BuildInput> = {}): BuildInput => ({ now: NOW, events: [], rebrands: [], alerts: [], wire: [], launches: [], archive: [], trendsetters: [], sites: sites(), runs, ...o });
const DAY = 864e5, at = (d: number) => new Date(Date.parse("2026-11-15T15:00:00Z") - d * DAY).toISOString();

describe("gap rule: SHIFT and CROSSOVER need runs at least MIN_RUN_GAP_DAYS apart", () => {
  it("is six days", () => expect(MIN_RUN_GAP_DAYS).toBe(6));
  it("two runs one day apart give zero shifts and crossovers", () => {
    const ctx = context(input([{ id: 9, at: at(1), rows: rows("peaking") }, { id: 13, at: at(0), rows: rows("accelerating", 0.12) }]));
    expect(ctx.pair).toBeNull(); expect(shiftCandidates(ctx)).toEqual([]); expect(crossoverCandidates(ctx)).toEqual([]);
  });
  it("two runs seven days apart give them", () => {
    const ctx = context(input([{ id: 9, at: at(7), rows: rows("peaking") }, { id: 13, at: at(0), rows: rows("accelerating", 0.12) }]));
    expect(shiftCandidates(ctx).map(c => c.id)).toContain("shift:theme:dark:13");
    expect(crossoverCandidates(ctx).map(c => c.id)).toContain("crossover:theme:dark:fintech:13");
  });
  it("compares the latest run with the most recent run at least six days older, skipping reruns in between", () => {
    const p = comparisonPair([{ id: 7, at: at(8) }, { id: 8, at: at(6.5) }, { id: 9, at: at(1) }, { id: 13, at: at(0) }]);
    expect(p?.latest.id).toBe(13); expect(p?.earlier.id).toBe(8);
  });
  it("a signal missing from the earlier run gives no shift or crossover", () => {
    const fresh = [row("tone:playful", "all", { stage: "emerging" }), row("tone:playful", "fintech", { current_share: 0.12 }), row("tone:playful", "ai", { current_share: 0.5 })];
    const ctx = context(input([{ id: 9, at: at(7), rows: rows("accelerating") }, { id: 13, at: at(0), rows: rows("accelerating", 0.02, fresh) }]));
    expect(shiftCandidates(ctx).some(c => c.signalKeys.includes("tone:playful"))).toBe(false);
    expect(crossoverCandidates(ctx).some(c => c.signalKeys.includes("tone:playful"))).toBe(false);
  });
  it("real runs come only from brief, chart or ledger references; the next comparison lands a weekly forecast day", () => {
    const ok = [{ id: 13, at: "2026-11-15T15:33:00Z" }, { id: 14, at: "2026-11-16T00:37:00Z" }, { id: 9, at: "2026-11-14T00:35:00Z" }];
    const real = realRuns(ok, [13, 9, null]);
    expect(real.map(r => r.id)).toEqual([9, 13]);
    const n = nextComparison(real, Date.parse("2026-11-16T03:00:00Z"))!;
    expect(n.earliest.slice(0, 10)).toBe("2026-11-20"); expect(n.expected).toBe("2026-11-22");
    expect(realRunLine({ real, pair: comparisonPair(real), next: n })).toMatch(/runs 9 and 13 as real.*no week-over-week comparison.*Sunday 22 Nov/);
  });
});

describe("FIRST SEEN needs an archive that could have seen it", () => {
  const deep = (sector: string, n = FIRST_SEEN_ARCHIVE_MIN_BRANDS, q = FIRST_SEEN_ARCHIVE_MIN_QUARTERS): ArchiveRow[] => Array.from({ length: n }, (_, i) => ({ domain: `${sector}-old${i}.com`, sector, quarter: `202${3 + Math.floor((i % q) / 4)}Q${(i % q % 4) + 1}`, traits: ["headline:sans"], measured: ["headline", "theme"] }));
  const withSerif = (n: number, sector = "fintech") => [...sites(), ...Array.from({ length: n }, (_, i) => ({ domain: `serif${i}.com`, name: null, sector, captured: NOW, traits: ["headline:serif", "css:starting_style"] }))];
  const run = [{ id: 13, at: at(0), rows: [...rows("accelerating"), row("css:starting_style", "all")] }];
  it("allowlists only dimensions measured from archived HTML/CSS", () => {
    expect(Object.keys(FIRST_SEEN_DIMENSIONS).sort()).toEqual(["font", "framework", "headline", "hero_media", "theme", "tracking"]);
    expect(firstSeenEligible("css:starting_style")).toBe(false); expect(firstSeenEligible("aesthetic:brutalist")).toBe(false); expect(firstSeenEligible("combo:dark_tech")).toBe(false);
    expect(archiveMeasured({ theme: "light", h1_family: "inter", webfont: false, h1_tracking: null, hero_media: null, frameworks: {} })).toEqual(["theme", "headline", "font"]);
  });
  it("css:starting_style is never first-seen, even with a deep archive and 2 brands", () => {
    const arch = [...deep("fintech"), ...deep("ai")].map(a => ({ ...a, traits: [...a.traits, "css:custom_properties"], measured: [...a.measured, "css"] }));
    const f = firstSeenCandidates(context(input(run, { sites: withSerif(2) })), arch);
    expect(f.some(c => c.signalKeys.includes("css:starting_style"))).toBe(false);
  });
  it("a 1-brand sector first-seen is rejected; 2 brands pass", () => {
    const arch = [...deep("fintech"), ...deep("ai").map(a => ({ ...a, traits: ["headline:serif"] }))]; // serif exists in AI's archive, never in fintech's
    expect(firstSeenCandidates(context(input(run, { sites: withSerif(1) })), arch).some(c => c.id === "first:headline:serif:fintech")).toBe(false);
    expect(firstSeenCandidates(context(input(run, { sites: withSerif(2) })), arch).map(c => c.id)).toContain("first:headline:serif:fintech");
  });
  it("a sector archive with fewer than 8 brands or 4 quarters is too thin", () => {
    const ai = deep("ai").map(a => ({ ...a, traits: ["headline:serif"] }));
    expect(firstSeenCandidates(context(input(run, { sites: withSerif(2) })), [...deep("fintech", 7), ...ai]).some(c => c.id === "first:headline:serif:fintech")).toBe(false);
    expect(firstSeenCandidates(context(input(run, { sites: withSerif(2) })), [...deep("fintech", 8, 3), ...ai]).some(c => c.id === "first:headline:serif:fintech")).toBe(false);
  });
});

describe("retiring stored stories", () => {
  const runAt: Record<number, string> = { 9: "2026-11-14T00:35:00Z", 13: "2026-11-15T15:33:00Z", 2: "2026-11-08T15:33:00Z" };
  const c: RetireCtx = { runAt: id => runAt[id] ?? null, depth: (s, cat) => (s === "health" ? { brands: 28, quarters: 3 } : cat === "headline" ? { brands: 20, quarters: 10 } : { brands: 0, quarters: 0 }) };
  const st = (o: Partial<Parameters<typeof retireReason>[0]>) => ({ id: "x", type: "shift", sector: null, signal_keys: ["theme:dark"], domains: [], source_ids: [], ...o });
  it("retires shifts and crossovers from runs under six days apart, keeps a week apart", () => {
    expect(retireReason(st({ source_ids: ["run:9", "run:13"] }), c)).toMatch(new RegExp(`^${RETIRE.gap} \\(runs 9 and 13, 39 hours apart\\)`));
    expect(retireReason(st({ type: "crossover", source_ids: ["run:2", "run:13"] }), c)).toBeNull();
    expect(retireReason(st({ source_ids: ["run:14", "run:13"] }), c)).toBe(RETIRE.unreal);
  });
  it("retires first-seen stories the archive can't measure, single-brand sector firsts and thin sector archives", () => {
    expect(retireReason(st({ type: "first_seen", signal_keys: ["css:starting_style"], sector: "ai", domains: ["a.com", "b.com"] }), c)).toBe(`${RETIRE.unmeasurable}.`);
    expect(retireReason(st({ type: "first_seen", signal_keys: ["color_mood:earthy"], sector: "studios", domains: ["a.com"] }), c)).toBe(`${RETIRE.unmeasurable}.`);
    expect(retireReason(st({ type: "first_seen", signal_keys: ["headline:serif"], sector: "studios", domains: ["a.com"] }), c)).toBe(`${RETIRE.oneBrand}.`);
    expect(retireReason(st({ type: "first_seen", signal_keys: ["headline:serif"], sector: "health", domains: ["a.com", "b.com"] }), c)).toMatch(/too thin/);
    expect(retireReason(st({ type: "first_seen", signal_keys: ["headline:serif"], sector: "media", domains: ["a.com", "b.com"] }), c)).toBeNull();
    expect(retireReason(st({ type: "move" }), c)).toBeNull();
  });
  it("killed stories leave the Live lead and stream and show under killed on the desk with the note", () => {
    const base: StoredStory = { id: "shift:a:13", type: "shift", status: "published", reason: "", score: 97, components: {}, why_ran: "", kicker: "Shift", headline: "A moved", deck: null, facts: [], why_line: null, why_model: null, why_at: null, sector: null, signal_keys: ["a"], domains: [], evidence: [], source_ids: ["run:9", "run:13"], basis: "measured", happened_at: "2026-11-15T15:33:00Z", created_at: NOW };
    const other: StoredStory = { ...base, id: "white:x", type: "white_space", score: 70, source_ids: [] };
    const note = `${RETIRE.gap} (runs 9 and 13, 39 hours apart).`;
    const all: StoryRecord[] = [applyEdits(base, [{ id: 1, story_id: base.id, action: "kill", payload: { reason: note }, note, at: NOW }], Date.parse(NOW)), applyEdits(other, [], Date.parse(NOW))];
    const live = liveModel(all, { sector: "all", page: 0, type: "all", now: Date.parse(NOW) });
    expect(live.lead?.id).toBe("white:x"); expect(live.stories.some(s => s.id === base.id)).toBe(false);
    const q = queueModel(all, null, Date.parse(NOW));
    expect(q.killed.map(k => [k.id, k.killReason])).toEqual([[base.id, note]]);
    expect(base.headline).toBe("A moved");
  });
});

describe("wording", () => {
  it("crossover reads '<signal> reaches <sector>'", () => {
    const ctx = context(input([{ id: 9, at: at(7), rows: rows("accelerating") }, { id: 13, at: at(0), rows: rows("accelerating", 0.12) }]));
    expect(crossoverCandidates(ctx)[0]!.headline).toBe(`${label("theme:dark").name} reaches fintech`);
  });
  it("layout moves say what changed in plain words, never raw field names or values", () => {
    const c = moveCandidate({ id: 4, domain: "x.com", sector: "ai", type: "layout_change", before: { hero_media: "video", grid_max_cols: 3 }, after: { hero_media: "image", grid_max_cols: 4 }, detected_at: "2026-11-13T00:00:00Z" });
    expect(c.headline).toBe("x.com changed its hero");
    expect(c.deck).toBe("Hero changed from video to image. Confirmed 13 Nov.");
    expect(c.facts.map(f => f.text)).toEqual([`Before: ${label("hero_media:video").name}`, `After: ${label("hero_media:image").name}`, "Hero changed from video to image", "Confirmed on a second capture, 13 Nov"]);
    expect(JSON.stringify(c)).not.toMatch(/hero_media|hero media|grid/);
  });
  it("rebrand decks are one templated sentence from the reasons and date", () => {
    expect(rebrandDeck({ reasons: ["font", "accent", "palette"], confirmed_at: "2026-11-12T08:00:00Z" })).toBe("Three identity changes confirmed together on 12 Nov: font, accent and palette.");
    expect(rebrandDeck({ reasons: ["palette"], confirmed_at: "2026-11-12T08:00:00Z" })).toBe("One identity change confirmed on 12 Nov: palette.");
    expect(rebrandCandidate({ domain: "a.com", sector: "ai", name: null, confirmed_at: "2026-11-12T08:00:00Z", read: "The desk's long read", reasons: ["palette"] }, []).deck).not.toContain("desk");
  });
  it("rewords stored stories through correct payloads: palette headlines, one-brand facts, rebrand decks; numbers come from the same event", () => {
    const e = { id: 214, domain: "apple.com", sector: "hardware", type: "palette_shift", before: { palette: ["#FFFFFF"] }, after: { palette: ["#F0F3F7", "#00224C"] }, detected_at: "2026-11-13T00:00:00Z" };
    const src = { move: (id: number) => (id === 214 ? moveCandidate(e) : null), rebrandDeck: () => "One identity change confirmed on 12 Nov: palette." };
    const stored = { id: "move:214", type: "move", sector: "hardware", signal_keys: [], domains: ["apple.com"], source_ids: ["event:214"], headline: "apple.com changed its palette to Off-white, Navy", deck: "Confirmed 13 Nov.", facts: [] };
    const w = reword(stored, src)!;
    expect(w.headline).toBe("apple.com changed its palette"); expect(w.deck?.startsWith("Now ")).toBe(true);
    expect(reword({ ...stored, ...w }, src)).toBeNull(); // idempotent
    expect(oneBrandFact("Seen on 1 tracked studios brand, including ragged-edge.com")).toBe("Seen on 1 tracked studios brand: ragged-edge.com");
    const reb = reword({ id: "rebrand:a.com:2026-11-12", type: "rebrand", sector: "ai", signal_keys: [], domains: ["a.com"], source_ids: ["rebrand:a.com:2026-11-12T08:00:00+00:00"], headline: "a.com rebranded: new palette", deck: "Desk text", facts: [] }, src)!;
    expect(reb.deck).toBe("One identity change confirmed on 12 Nov: palette.");
  });
  it("a correct row can replace the facts list; the stored row is untouched", () => {
    const s: StoredStory = { id: "s", type: "move", status: "published", reason: "", score: 50, components: {}, why_ran: "", kicker: "", headline: "h", deck: null, facts: [{ text: "old", href: null, basis: null }], why_line: null, why_model: null, why_at: null, sector: null, signal_keys: [], domains: [], evidence: [], source_ids: [], basis: null, happened_at: NOW, created_at: NOW };
    const r = applyEdits(s, [{ id: 1, story_id: "s", action: "correct", payload: { facts: [{ text: "new", href: null, basis: null }] }, note: null, at: NOW }], Date.parse(NOW));
    expect((r.facts as { text: string }[])[0]!.text).toBe("new"); expect((s.facts as { text: string }[])[0]!.text).toBe("old"); expect(r.correctedAt).toBe(NOW);
  });
});

describe("the AI line says what to do next, without hedging", () => {
  const story = { headline: "Almost no fintech brand uses dark mode", deck: "One of 30 fintech brands shows it.", facts: [{ text: "1 of 30 tracked fintech brands shows it", href: "/x", basis: "measured" as const }], domains: [], signalKeys: ["theme:dark"] };
  const known = knownFrom([], ["theme:dark"]);
  it("rejects every banned hedge", () => {
    for (const w of ["warrants", "monitoring", "signaling", "too early", "insufficient", "it remains to be seen", "landscape", "leverage"]) {
      expect(BANNED_PHRASES).toContain(w);
      expect(validateWhy(`Fintech leads should note this ${w} on dark mode.`, story, known)).toMatchObject({ ok: false, reason: `banned phrase: ${w}` });
    }
    expect(validateWhy("Test a dark homepage before another fintech brand claims it.", story, known)).toEqual({ ok: true, line: "Test a dark homepage before another fintech brand claims it." });
  });
  it("keeps the old checks: new numbers, unknown names and $ still fail", () => {
    expect(validateWhy("Test dark mode on 40% of pages.", story, known)).toMatchObject({ ok: false });
    expect(validateWhy("Spend $ on dark mode.", story, known)).toMatchObject({ ok: false, reason: "contains $" });
  });
  it("prompt asks for one concrete next step and varies the opening by story", () => {
    expect(WHY_SYSTEM).toMatch(/do or watch next/); expect(WHY_SYSTEM).toMatch(/160 characters/); for (const w of BANNED_PHRASES) expect(WHY_SYSTEM).toContain(w);
    expect(new Set(["move:1", "move:2", "move:3", "move:4", "move:5"].map(id => whyAngle("move", id))).size).toBeGreaterThan(1);
  });
});

describe("What makes a story", () => {
  it("is generated from the type definitions and constants", () => {
    expect(storyTypeList()).toHaveLength(11);
    const text = storyRules().map(r => r.text).join(" ");
    expect(text).toContain(`${MIN_RUN_GAP_DAYS} days older`); expect(text).toContain("24 stories run per UTC day, 6 of them news"); expect(text).toContain("8 brands and 4 quarters");
    expect(text).not.toMatch(/\$/);
  });
});
