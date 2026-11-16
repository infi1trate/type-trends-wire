import { describe, expect, it } from "vitest";
import { label } from "../labels";
import type { EventRow } from "../agency/changes";
import type { SignalRow } from "../signals";
import { STORY_KINDS, STORY_TYPE_DEFS, type Candidate } from "./types";
import {
  allCandidates, breakoutCandidates, context, counterMoveCandidates, crossoverCandidates, firstSeenCandidates, isVisibleMove, moveCandidate, newsCandidates, newsMatcher,
  rebrandCandidate, roundupCandidates, shiftCandidates, traitDelta, whiteSpaceCandidates, noDollar, type BuildInput, type SiteNow,
} from "./candidates";
import { COMPONENT_MAX, DAILY_CAP, NEWS_DAILY_CAP, PUBLISH_MIN, WEIGHTS, brandComponent, lensScore, noveltyComponent, planStories, relevanceComponent, sizeComponent, total, type ScoreCtx } from "./score";
import { validateWhy, knownFrom, WHY_LINE_MAX, WHY_MAX_CHARS } from "./why";
import { applyEdits, foldedIds, overlay, type EditRow, type StoredStory } from "./edits";
import { runBuild, toRow, type StoryRowOut } from "./build.server";

const NOW = "2026-11-16T12:00:00.000Z";
const row = (key: string, scope: string, o: Partial<SignalRow> = {}): SignalRow => { const [dimension, value] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)]; return { dimension, value, scope, status: "ok", stage: "accelerating", momentum: 2, current_share: 0.3, next_wave_score: 1, sites: 20, ...o }; };
const SECTORS = ["fintech", "ai", "dev-tools"];
function sites(): SiteNow[] {
  const out: SiteNow[] = [];
  for (const s of SECTORS) for (let i = 0; i < 20; i++) out.push({ domain: `${s}${i}.com`, name: null, sector: s, captured: "2026-11-14T00:00:00Z", traits: [s === "fintech" ? "theme:light" : i < 8 ? "theme:dark" : "theme:light", ...(s !== "fintech" && i < 10 ? ["hero_media:video"] : [])] });
  return out;
}
const runRows = (stage: string, darkFintech = 0.02) => [
  row("theme:dark", "all", { stage }), row("hero_media:video", "all", { stage: "declining", momentum: -2 }), row("headline:serif", "all", { stage: "accelerating" }),
  ...SECTORS.map(s => row("theme:dark", s, { stage, current_share: s === "fintech" ? darkFintech : 0.4 })), ...SECTORS.map(s => row("hero_media:video", s, { stage: "declining", momentum: -2, current_share: 0.3 })),
  ...SECTORS.map(s => row("headline:serif", s, { current_share: 0.2 })),
];
const ev = (id: number, domain: string, sector: string, type: string, before: unknown, after: unknown, at = "2026-11-12T10:00:00Z"): EventRow => ({ id, domain, sector, type, before, after, detected_at: at, source: "live", page_type: "home", viewport: "desktop" });
const base = (o: Partial<BuildInput> = {}): BuildInput => ({
  now: NOW, events: [], rebrands: [], alerts: [], wire: [], launches: [], archive: [], trendsetters: [{ domain: "ai0.com", rank: 1 }, { domain: "fintech3.com", rank: 30 }],
  runs: [{ id: 8, at: "2026-11-01T00:00:00Z", rows: runRows("peaking") }, { id: 9, at: "2026-11-08T00:00:00Z", rows: runRows("peaking") }, { id: 13, at: "2026-11-15T00:00:00Z", rows: runRows("accelerating", 0.12) }],
  sites: sites(), ...o,
});
const hasDollar = (c: Candidate) => [c.headline, c.deck ?? "", ...c.facts.map(f => f.text)].some(t => t.includes("$"));
const sctx = (o: Partial<ScoreCtx> = {}): ScoreCtx => ({ tierOf: () => "headline", rankOf: () => null, tracked: () => true, covered: () => true, shareOf: () => 0.3, ...o });
const cand = (o: Partial<Candidate>): Candidate => ({ id: "x", type: "move", kicker: "Move", headline: "h", deck: null, facts: [], sector: "fintech", signalKeys: [], domains: ["a.com"], evidence: [], sourceIds: [], basis: "measured", happenedAt: "2026-11-12T00:00:00Z", magnitude: 2, ...o });

describe("story types", () => {
  it("defines all eleven types with a job, trigger, evidence and templates", () => {
    expect(STORY_KINDS).toHaveLength(11);
    for (const k of STORY_KINDS) { const d = STORY_TYPE_DEFS[k]; expect(["spot", "prove", "act"]).toContain(d.job); expect(d.trigger.length).toBeGreaterThan(10); expect(d.evidence.length).toBeGreaterThan(5); expect(d.headline).toBeTruthy(); }
    expect(STORY_TYPE_DEFS.white_space.job).toBe("act");
  });
  it("MOVE: visible events only, before → after facts, capture date", () => {
    expect(isVisibleMove({ type: "pricing_change", before: {}, after: {} })).toBe(false);
    expect(isVisibleMove({ type: "layout_change", before: { grid_max_cols: 2 }, after: { grid_max_cols: 3 } })).toBe(false);
    expect(isVisibleMove({ type: "layout_change", before: { hero_media: "image" }, after: { hero_media: "video" } })).toBe(true);
    const c = moveCandidate(ev(5, "linear.app", "dev-tools", "palette_shift", { accent: "#5E6AD2" }, { accent: "#0055FF" }));
    expect(c.id).toBe("move:5"); expect(c.headline).toBe("linear.app changed its accent");
    expect(c.facts.find(f => f.kind === "before")?.text).toMatch(/^Before: /); expect(c.facts.find(f => f.kind === "after")?.text).toMatch(/^After: /);
    expect(c.facts.find(f => f.kind === "date")?.text).toContain("12 Nov"); expect(c.facts.every(f => f.href)).toBe(true);
  });
  it("traitDelta reads gained and dropped traits from the measured fields", () => {
    expect(traitDelta(ev(1, "a.com", "ai", "theme_flip", { theme: "light" }, { theme: "dark" }))).toEqual({ gained: ["theme:dark"], dropped: [] });
    expect(traitDelta(ev(2, "a.com", "ai", "theme_flip", { theme: "dark" }, { theme: "light" }))).toEqual({ gained: [], dropped: ["theme:dark"] });
  });
  it("REBRAND folds the brand's moves around the confirmation", () => {
    const m = [ev(1, "a.com", "ai", "palette_shift", { accent: "#000000" }, { accent: "#FF0000" }, "2026-11-10T00:00:00Z"), ev(2, "b.com", "ai", "palette_shift", {}, {}, "2026-11-10T00:00:00Z")].map(e => ({ c: moveCandidate(e), e }));
    const r = rebrandCandidate({ domain: "a.com", sector: "ai", name: null, confirmed_at: "2026-11-11T00:00:00Z", read: "accent changed", reasons: ["accent", "font"] }, m);
    expect(r.members).toEqual(["move:1"]); expect(r.headline).toBe("a.com rebranded: new accent and font"); expect(r.sourceIds).toContain("story:move:1");
  });
  it("SHIFT: headline signal changed stage between two real runs, names from labels", () => {
    const s = shiftCandidates(context(base()));
    const dark = s.find(x => x.id === "shift:theme:dark:13")!;
    expect(dark.headline).toBe(`${label("theme:dark").name} moved from Peaking to Rising`);
    expect(dark.facts[0]!.text).toContain("run 9"); expect(s.some(x => x.id.endsWith(":9"))).toBe(false); // 8 → 9 had no change
  });
  it("BREAKOUT: only from breakout alerts on headline signals", () => {
    const ctx = context(base()), alerts = [
      { id: 1, title: "x", url: "https://x/?panel=brief&trait=theme:dark&alert=13-breakout", source: "alerts", source_kind: "alert", published_at: NOW, excerpt: null, ref: "theme:dark" },
      { id: 2, title: "x", url: "https://x/?panel=brief&trait=theme:dark&alert=13-saturation", source: "alerts", source_kind: "alert", published_at: NOW, excerpt: null, ref: "theme:dark" },
      { id: 3, title: "x", url: "https://x/?alert=13-breakout", source: "alerts", source_kind: "alert", published_at: NOW, excerpt: null, ref: "css:has" },
    ];
    const b = breakoutCandidates(ctx, alerts);
    expect(b.map(x => x.id)).toEqual(["breakout:theme:dark:all:13"]); expect(b[0]!.headline).toContain(label("theme:dark").name);
  });
  it("FIRST SEEN: library-wide 2 brands, or 1 brand on a headline signal; the archive must measure that kind of signal", () => {
    const one = base({ sites: [...sites(), { domain: "solo.com", name: null, sector: "fintech", captured: NOW, traits: ["headline:serif"] }] });
    const noHistory = firstSeenCandidates(context(one), []);
    expect(noHistory).toEqual([]); // nothing in the archive measures headline:* → no claim
    const arch = Array.from({ length: 8 }, (_, i) => ({ domain: `old${i}.com`, sector: "fintech", quarter: `2024Q${(i % 4) + 1}`, traits: ["headline:sans", "theme:light"], measured: ["headline", "theme"] }));
    const f = firstSeenCandidates(context(one), arch);
    expect(f.map(x => x.id)).toContain("first:headline:serif:all");
    expect(f.find(x => x.id === "first:headline:serif:all")!.firstSeen).toBe(true);
  });
  it("CROSSOVER: second sector passes the floor with brands named", () => {
    const x = crossoverCandidates(context(base({ sites: sites().map(s => (s.sector === "fintech" && s.domain === "fintech1.com" ? { ...s, traits: [...s.traits, "theme:dark"] } : s)) })));
    const c = x.find(y => y.id === "crossover:theme:dark:fintech:13")!;
    expect(c.headline).toBe(`${label("theme:dark").name} reaches fintech`); expect(c.domains).toEqual(["fintech1.com"]);
  });
  it("COUNTER-MOVE: adopting a Fading signal", () => {
    const e = ev(9, "ai3.com", "ai", "layout_change", { hero_media: "image" }, { hero_media: "video" });
    const c = counterMoveCandidates(context(base()), [{ c: moveCandidate(e), e }]);
    expect(c[0]!.id).toBe("counter:9:hero_media:video"); expect(c[0]!.headline).toContain("while it fades"); expect(c[0]!.members).toEqual(["move:9"]);
  });
  it("WHITE SPACE: rising elsewhere, almost unused in a covered sector, one per sector per week", () => {
    const w = whiteSpaceCandidates(context(base()));
    expect(w.map(x => x.id)).toEqual(["white:fintech:2026-W47"]);
    expect(w[0]!.headline).toBe(`Almost no fintech brand uses ${label("theme:dark").name.toLowerCase()}; it is rising everywhere else`);
    expect(STORY_TYPE_DEFS.white_space.job).toBe("act");
  });
  it("ROUNDUP: three brands, same kind, inside 14 days", () => {
    const evs = [1, 2, 3].map(i => ev(20 + i, `ai${i}.com`, "ai", "theme_flip", { theme: "light" }, { theme: "dark" }, `2026-11-1${i}T00:00:00Z`));
    const r = roundupCandidates(context(base()), evs.map(e => ({ c: moveCandidate(e), e })));
    expect(r[0]!.headline).toBe(`Three AI brands moved to ${label("theme:dark").name.toLowerCase()}`); expect(r[0]!.members).toHaveLength(3);
    expect(roundupCandidates(context(base()), evs.slice(0, 2).map(e => ({ c: moveCandidate(e), e })))).toEqual([]);
  });
  it("templates never carry a $", () => {
    const evs = [ev(1, "a.com", "ai", "message_pivot", { headline: "Pay $0 today" }, { headline: "Free for $5" })];
    const { candidates } = allCandidates(base({ events: evs }));
    expect(candidates.length).toBeGreaterThan(0); expect(candidates.some(hasDollar)).toBe(false);
    expect(noDollar("From $20 a month")).toBe("From USD 20 a month");
  });
});

describe("NEWS matching", () => {
  const m = newsMatcher([{ domain: "linear.app", name: null }, { domain: "stripe.com", name: null }, { domain: "figma.com", name: null }], ["headline:serif"]);
  const w = (id: number, title: string, url = "https://news.example/x") => ({ id, title, url, source: "Example", source_kind: "hn", published_at: NOW, excerpt: null });
  it("names a tracked brand by domain or name, word boundary, case-insensitive", () => {
    const { candidates, dropped } = newsCandidates(m, [w(1, "STRIPE ships a new checkout"), w(2, "Stripeless payments explained"), w(3, "Why linear gradients are back"), w(4, "linear.app raises a round"), w(5, "The return of serif headlines")]);
    expect(candidates.map(c => c.id)).toEqual(["news:1", "news:4", "news:5"]); expect(dropped).toBe(2);
    expect(candidates[0]!.domains).toEqual(["stripe.com"]); expect(candidates[2]!.signalKeys).toEqual(["headline:serif"]);
  });
  it("rejects a random architecture headline and a publication naming itself", () => {
    const own = newsMatcher([{ domain: "designboom.com", name: null }], []);
    expect(newsCandidates(m, [w(1, "sweeping concrete cutouts shape a sculptural art center")]).candidates).toEqual([]);
    expect(newsCandidates(own, [{ ...w(2, "a pavilion on designboom"), url: "https://www.designboom.com/x" }]).candidates).toEqual([]);
  });
});

describe("newsworthiness score", () => {
  it("each component is 0–25 and the total is the weighted sum", () => {
    expect(Object.values(WEIGHTS).every(w => w === 1)).toBe(true);
    const c = cand({ magnitude: 99 });
    const cs = { size: sizeComponent(c), brand: brandComponent(c, sctx({ rankOf: () => 1 })), novelty: noveltyComponent(c, null, sctx()), relevance: relevanceComponent(c, sctx()) };
    for (const v of Object.values(cs)) { expect(v.value).toBeGreaterThanOrEqual(0); expect(v.value).toBeLessThanOrEqual(COMPONENT_MAX); expect(v.why).toBeTruthy(); }
    expect(total(cs)).toBe(cs.size.value + cs.brand.value + cs.novelty.value + cs.relevance.value);
  });
  it("is monotonic in size, brand rank, novelty and tier", () => {
    expect(sizeComponent(cand({ magnitude: 3 })).value).toBeGreaterThan(sizeComponent(cand({ magnitude: 1 })).value);
    expect(sizeComponent(cand({ type: "roundup", magnitude: 5 })).value).toBeGreaterThan(sizeComponent(cand({ type: "roundup", magnitude: 3 })).value);
    expect(brandComponent(cand({}), sctx({ rankOf: () => 3 })).value).toBeGreaterThan(brandComponent(cand({}), sctx({ rankOf: () => 40 })).value);
    expect(brandComponent(cand({}), sctx({ rankOf: () => 40 })).value).toBeGreaterThan(brandComponent(cand({}), sctx()).value);
    expect(noveltyComponent(cand({}), 20, sctx()).value).toBeGreaterThan(noveltyComponent(cand({}), 1, sctx()).value);
    expect(noveltyComponent(cand({ firstSeen: true }), 1, sctx()).value).toBe(25);
    expect(relevanceComponent(cand({ signalKeys: ["k"] }), sctx({ tierOf: () => "headline" })).value).toBeGreaterThan(relevanceComponent(cand({ signalKeys: ["k"] }), sctx({ tierOf: () => "supporting" })).value);
    expect(relevanceComponent(cand({}), sctx({ covered: () => true })).value).toBeGreaterThan(relevanceComponent(cand({}), sctx({ covered: () => false })).value);
  });
  it("the lens boosts ordering only", () => {
    expect(lensScore({ score: 50, sector: "ai" }, "ai")).toBeGreaterThan(50); expect(lensScore({ score: 50, sector: "ai" }, "all")).toBe(50);
  });
});

describe("plan: threshold, dedupe, merge, caps, held reasons", () => {
  const strong = (o: Partial<Candidate>) => cand({ magnitude: 99, ...o });
  const ctx = sctx({ rankOf: () => 1 });
  it("holds low scores with the reason and keeps every story", () => {
    const p = planStories([cand({ id: "weak", type: "news", domains: [], magnitude: 0, sector: null })], [], sctx({ covered: () => false, tracked: () => false }));
    expect(p[0]!.status).toBe("held"); expect(p[0]!.reason).toMatch(new RegExp(`below the publish threshold of ${PUBLISH_MIN}`)); expect(p[0]!.whyRan).toContain("Score");
  });
  it("same brand + type within 7 days keeps the higher score", () => {
    const p = planStories([strong({ id: "a", magnitude: 99 }), cand({ id: "b", magnitude: 1, happenedAt: "2026-11-14T00:00:00Z" })], [], ctx);
    expect(p.find(x => x.id === "a")!.status).toBe("published"); expect(p.find(x => x.id === "b")!.reason).toContain("duplicate of a");
  });
  it("a story that already ran wins over a new one", () => {
    const p = planStories([strong({ id: "new" })], [{ id: "old", type: "move", status: "published", score: 50, happened_at: "2026-11-10T00:00:00Z", domains: ["a.com"], signal_keys: [], sector: "fintech" }], ctx);
    expect(p[0]!.status).toBe("held"); expect(p[0]!.reason).toContain("already ran");
  });
  it("SHIFT and BREAKOUT on the same signal in the same run merge", () => {
    const p = planStories([strong({ id: "shift:k:13", type: "shift", signalKeys: ["k"], domains: [], sector: null, runId: 13 }), strong({ id: "breakout:k:all:13", type: "breakout", signalKeys: ["k"], domains: [], sector: null, runId: 13, facts: [{ text: "Momentum +2", href: "/x", basis: "measured" }] })], [], ctx);
    expect(p.find(x => x.type === "breakout")!.reason).toBe("merged into shift:k:13");
    expect(p.find(x => x.type === "shift")!.facts.map(f => f.text)).toContain("Momentum +2");
  });
  it("members of a running roundup are held as told in it", () => {
    const members = [1, 2, 3].map(i => strong({ id: `move:${i}`, domains: [`b${i}.com`] }));
    const p = planStories([...members, strong({ id: "roundup:x", type: "roundup", domains: ["b1.com", "b2.com", "b3.com"], members: members.map(m => m.id), magnitude: 3 })], [], ctx);
    expect(p.filter(x => x.id.startsWith("move:")).every(x => x.reason === "told in roundup:x")).toBe(true);
  });
  it("caps 24 a day and 6 news a day", () => {
    const moves = Array.from({ length: 30 }, (_, i) => strong({ id: `m${i}`, domains: [`d${i}.com`] }));
    const news = Array.from({ length: 10 }, (_, i) => strong({ id: `n${i}`, type: "news", domains: [`n${i}.com`], sector: null, magnitude: 5, happenedAt: "2026-11-13T00:00:00Z" }));
    const p = planStories([...moves, ...news], [], ctx);
    const day12 = p.filter(x => x.happenedAt.startsWith("2026-11-12")), day13 = p.filter(x => x.happenedAt.startsWith("2026-11-13"));
    expect(day12.filter(x => x.status === "published")).toHaveLength(DAILY_CAP);
    expect(day12.filter(x => x.status === "held").every(x => x.reason === `over the daily cap of ${DAILY_CAP} stories`)).toBe(true);
    expect(day13.filter(x => x.status === "published")).toHaveLength(NEWS_DAILY_CAP);
    expect(day13.find(x => x.status === "held")!.reason).toBe(`over the daily cap of ${NEWS_DAILY_CAP} news stories`);
  });
  it("is idempotent against stored ids", () => {
    const c = [strong({ id: "a" })], first = planStories(c, [], ctx);
    expect(planStories(c, first.map(p => ({ id: p.id, type: p.type, status: p.status, score: p.score, happened_at: p.happenedAt, domains: p.domains, signal_keys: p.signalKeys, sector: p.sector })), ctx)).toEqual([]);
  });
});

describe("why-it-matters validator", () => {
  const story = { headline: "Three AI brands moved to dark mode", deck: "a.com, b.com and c.com", facts: [{ text: "On 30.0% of tracked homepages", href: "/s", basis: "measured" as const }], domains: ["a.com", "b.com", "c.com"], signalKeys: ["theme:dark"] };
  const known = knownFrom([{ domain: "a.com", name: null }, { domain: "stripe.com", name: null }], ["theme:dark", "headline:serif"]);
  it("accepts a line built from the facts", () => expect(validateWhy("Dark mode is on 30.0% of homepages; AI brands are early to it.", story, known)).toEqual({ ok: true, line: "Dark mode is on 30.0% of homepages; AI brands are early to it." }));
  it("rejects new numbers, unknown brands or signals, $, superlatives and over-length", () => {
    expect(validateWhy("Dark mode is on 45% of homepages.", story, known)).toMatchObject({ ok: false, reason: "number not in the facts: 45" });
    expect(validateWhy("Stripe will follow soon.", story, known)).toMatchObject({ ok: false, reason: "brand not in the facts: stripe.com" });
    expect(validateWhy("Serif headlines will be next.", story, known)).toMatchObject({ ok: false, reason: "signal not in the facts: Serif headlines" });
    expect(validateWhy("Worth $ to agencies.", story, known)).toMatchObject({ ok: false, reason: "contains $" });
    expect(validateWhy("A revolutionary moment for AI brands.", story, known)).toMatchObject({ ok: false, reason: "superlative: revolutionary" });
    expect(validateWhy("x".repeat(WHY_MAX_CHARS + 1), story, known)).toMatchObject({ ok: false });
    expect(validateWhy("x".repeat(WHY_LINE_MAX + 1), story, known)).toMatchObject({ ok: false, reason: `over ${WHY_LINE_MAX} characters` });
    expect(validateWhy(null, story, known)).toMatchObject({ ok: false });
  });
});

describe("editor overlay", () => {
  const s: StoredStory = { id: "s1", type: "move", status: "held", reason: "over cap", score: 50, components: {}, why_ran: "", kicker: "Move", headline: "Old", deck: "Deck", facts: [], why_line: null, why_model: null, why_at: null, sector: null, signal_keys: [], domains: [], evidence: [], source_ids: [], basis: null, happened_at: NOW, created_at: NOW };
  const e = (id: number, action: EditRow["action"], payload: Record<string, unknown>, at: string): EditRow => ({ id, story_id: "s1", action, payload, note: null, at });
  const now = Date.parse(NOW);
  it("pin runs a held story and expires; kill hides; restore brings back; correct replaces text; original untouched", () => {
    const pinned = applyEdits(s, [e(1, "pin", { until: "2026-11-17T00:00:00Z" }, "2026-11-16T01:00:00Z")], now);
    expect(pinned.state).toBe("published"); expect(pinned.pinnedUntil).toBe("2026-11-17T00:00:00Z");
    expect(applyEdits(s, [e(1, "pin", { until: "2026-11-16T00:00:00Z" }, "2026-11-15T01:00:00Z")], now).pinnedUntil).toBeNull();
    const killed = applyEdits({ ...s, status: "published" }, [e(2, "kill", { reason: "wrong" }, "2026-11-16T02:00:00Z")], now);
    expect(killed.state).toBe("killed"); expect(killed.killReason).toBe("wrong");
    expect(applyEdits({ ...s, status: "published" }, [e(2, "kill", { reason: "wrong" }, "2026-11-16T02:00:00Z"), e(3, "restore", {}, "2026-11-16T03:00:00Z")], now).state).toBe("published");
    const fixed = applyEdits(s, [e(4, "correct", { headline: "New", why_line: "Better line" }, "2026-11-16T04:00:00Z")], now);
    expect(fixed.headline).toBe("New"); expect(fixed.why_line).toBe("Better line"); expect(fixed.deck).toBe("Deck"); expect(fixed.correctedAt).toBe("2026-11-16T04:00:00Z");
    expect(fixed.stored.headline).toBe("Old"); expect(s.headline).toBe("Old");
  });
  it("folded members are hidden while the parent runs", () => {
    const shown = overlay([{ ...s, id: "r", status: "published", source_ids: ["story:s1"] }, s], [], now);
    expect(foldedIds(shown)).toEqual(new Set(["s1"]));
  });
});

describe("build", () => {
  const memory = () => {
    const rows = new Map<string, StoryRowOut>();
    return { rows, deps: {
      load: async () => base({ events: [ev(1, "ai1.com", "ai", "theme_flip", { theme: "light" }, { theme: "dark" })] }),
      existing: async () => [...rows.values()].map(r => ({ id: r.id, type: r.type as Candidate["type"], status: r.status, score: r.score, happened_at: r.happened_at, domains: r.domains, signal_keys: r.signal_keys, sector: r.sector })),
      insert: async (rs: StoryRowOut[]) => { let n = 0; for (const r of rs) if (!rows.has(r.id)) { rows.set(r.id, r); n++; } return n; },
      why: null,
    } };
  };
  it("running twice inserts nothing new", async () => {
    const m = memory(), a = await runBuild(m.deps), b = await runBuild(m.deps);
    expect(a.inserted).toBeGreaterThan(0); expect(b.inserted).toBe(0);
  });
  it("is skipped entirely in DEV runs", async () => {
    const m = memory(); let loaded = false;
    const r = await runBuild({ ...m.deps, load: async () => { loaded = true; return base(); } }, { dev: true });
    expect(r.skipped).toBe("dev"); expect(loaded).toBe(false); expect(m.rows.size).toBe(0);
  });
  it("stores AI lines only after validation, inside the per-build cap", async () => {
    const m = memory(); let calls = 0;
    const r = await runBuild({ ...m.deps, why: { used: async () => 0, write: async () => { calls++; return { line: calls === 1 ? "A revolutionary week." : "Worth watching for agencies.", model: "test-model" }; } } }, { aiPerBuild: 5 });
    expect(calls).toBeLessThanOrEqual(5);
    const withLine = [...m.rows.values()].filter(x => x.why_line);
    expect(withLine.every(x => x.why_line === "Worth watching for agencies." && x.why_model === "test-model")).toBe(true);
    expect(r.why_lines).toBe(withLine.length);
  });
  it("tops up lines for stored stories without one (separate table, stored rows untouched)", async () => {
    const m = memory(); await runBuild(m.deps);
    const before = JSON.stringify([...m.rows.values()]), saved: unknown[] = [];
    const stored = [...m.rows.values()].filter(r => r.status === "published").slice(0, 2).map(r => ({ id: r.id, type: r.type as Candidate["type"], headline: r.headline, deck: r.deck, facts: r.facts as Candidate["facts"], signalKeys: r.signal_keys, domains: r.domains }));
    const r = await runBuild({ ...m.deps, why: { used: async () => 0, write: async () => ({ line: "Worth watching for agencies.", model: "test-model" }) }, lineless: async n => stored.slice(0, n), insertLines: async rows => { saved.push(...rows); return rows.length; } });
    expect(r.inserted).toBe(0); expect(saved).toHaveLength(stored.length); expect(r.why_lines).toBe(stored.length);
    expect(JSON.stringify([...m.rows.values()])).toBe(before);
  });
  it("respects the daily AI cap", async () => {
    const m = memory(); let calls = 0;
    await runBuild({ ...m.deps, why: { used: async () => 10, write: async () => { calls++; return null; } } });
    expect(calls).toBe(0);
  });
  it("rows keep the four components and why-this-ran", async () => {
    const m = memory(); await runBuild(m.deps);
    const r = [...m.rows.values()][0]!;
    expect(Object.keys(r.components as object).sort()).toEqual(["brand", "novelty", "relevance", "size"]); expect(r.why_ran).toMatch(/Score \d+/);
    expect(toRow).toBeTypeOf("function");
  });
});

describe("move palette headline", () => {
  it("keeps the colour list out of the headline", () => {
    const c = moveCandidate({ id: 9, domain: "apple.com", sector: "hardware", type: "palette_shift", page_type: "home", viewport: "desktop", detected_at: "2026-11-12T14:44:00Z", effective_at: null, severity: 2, summary: null, before: { palette: ["#FFFFFF"] }, after: { palette: ["#F0F3F7", "#00224C", "#7A68BA"] } } as never);
    expect(c.headline).toBe("apple.com changed its palette");
    expect(c.deck?.startsWith("Now ")).toBe(true);
    expect(c.facts.some(f => f.kind === "after")).toBe(true);
  });
});
