// NEWSWORTHINESS — a 0–100 score from four named 0–25 components, then the publish threshold, dedupe, merges,
// folding and the daily caps. Pure: same candidates and stored stories in, same plan out. Nothing is thrown away:
// everything that doesn't run is kept as "held" with its reason.
import { label, sectorName } from "../labels";
import type { Tier } from "../tiers";
import type { Candidate, StoryKind } from "./types";
import { STORY_TYPE_DEFS } from "./types";

/** Weights per component (each component is already 0–25, so weight 1 keeps the total 0–100). */
export const WEIGHTS = { size: 1, brand: 1, novelty: 1, relevance: 1 } as const;
export type ComponentId = keyof typeof WEIGHTS;
export const COMPONENT_MAX = 25;
/** A story needs at least this score to run: roughly "two components clearly above the middle". */
export const PUBLISH_MIN = 45;
/** Same brand (or same signal) and same type within 7 days: only the higher score runs. */
export const DEDUPE_DAYS = 7;
/** At most 8 published stories per UTC day, at most 3 of them outside news. */
export const DAILY_CAP = 8, NEWS_DAILY_CAP = 3;
/** Under a sector lens, that sector's stories get this many points in ordering only (the stored score never changes). */
export const LENS_BOOST = 15;
/** Lead story window: the best of the last 48 hours. */
export const LEAD_WINDOW_HOURS = 48;

export type Component = { value: number; why: string };
export type Components = Record<ComponentId, Component>;
export type ScoreCtx = {
  tierOf: (key: string) => Tier | null;
  /** Trendsetter rank in the latest real forecast run (1 = leads most traits). */
  rankOf: (domain: string) => number | null;
  tracked: (domain: string) => boolean;
  covered: (sector: string | null) => boolean;
  /** Library-wide share of a signal in the latest real run (rarity). */
  shareOf: (key: string) => number | null;
};
export type Existing = { id: string; type: StoryKind; status: "published" | "held"; score: number; happened_at: string; domains: string[]; signal_keys: string[]; sector: string | null };
export type Planned = Candidate & { status: "published" | "held"; reason: string; score: number; components: Components; whyRan: string };

const clamp = (v: number) => Math.max(0, Math.min(COMPONENT_MAX, Math.round(v)));
const dayMs = 864e5;

/** SIZE — how big the change is, by type. */
export const SIZE_RULES: Record<StoryKind, { f: (m: number) => number; why: (m: number) => string }> = {
  move: { f: m => (m >= 99 ? 25 : 8 + 5 * m), why: m => (m >= 99 ? "a full redesign" : `${m} field${m === 1 ? "" : "s"} changed`) },
  rebrand: { f: m => 12 + 4 * m, why: m => `${m} identity part${m === 1 ? "" : "s"} changed` },
  shift: { f: m => 10 + 8 * m, why: m => `a ${m}-step stage change` },
  breakout: { f: m => 10 + 3 * Math.abs(m), why: m => `momentum ${m.toFixed(1)} points a quarter` },
  first_seen: { f: m => 6 + 4 * m, why: m => `${m} brand${m === 1 ? "" : "s"} showing it` },
  crossover: { f: m => 12 + m, why: m => `${m.toFixed(1)} points past the crossover floor` },
  counter_move: { f: () => 15, why: () => "a move against the sector's direction" },
  white_space: { f: m => 5 + m / 2, why: m => `a ${m.toFixed(0)}-point gap to other sectors` },
  roundup: { f: m => 5 + 5 * m, why: m => `${m} brands making the same move` },
  launch: { f: () => 10, why: () => "a launch" },
  news: { f: m => 6 + 4 * m, why: m => `names ${m} thing${m === 1 ? "" : "s"} we track` },
};

/** BRAND WEIGHT — trendsetter rank in the latest real forecast run (top 50 are ranked); any other tracked brand counts 10; no brand named counts 6. Extra brands add 1 each, up to 4. Watchlist counts are not used (the table is private and a count would leak which brands clients watch). */
export function brandComponent(c: Pick<Candidate, "domains">, ctx: ScoreCtx): Component {
  const ranks = c.domains.map(d => ctx.rankOf(d)).filter((r): r is number => r != null).sort((a, b) => a - b), best = ranks[0] ?? null;
  const base = best != null ? (best <= 10 ? 25 : best <= 25 ? 20 : 15) : c.domains.some(ctx.tracked) ? 10 : 6;
  const extra = Math.min(4, Math.max(0, c.domains.length - 1));
  return { value: clamp(base + extra), why: best != null ? `trendsetter #${best}${extra ? ` plus ${extra} more brand${extra === 1 ? "" : "s"}` : ""}` : c.domains.length ? `tracked brand${c.domains.length > 1 ? "s" : ""}, not a ranked trendsetter` : "names no single brand" };
}
/** NOVELTY — first time seen scores full; otherwise days since the last story on the same signal or brand, plus rarity of the signal. */
export function noveltyComponent(c: Pick<Candidate, "firstSeen" | "signalKeys">, lastDays: number | null, ctx: ScoreCtx): Component {
  if (c.firstSeen) return { value: 25, why: "first time seen" };
  const base = lastDays == null ? 18 : lastDays >= 14 ? 14 : lastDays >= 7 ? 10 : lastDays >= 2 ? 6 : 2;
  const shares = c.signalKeys.map(ctx.shareOf).filter((s): s is number => s != null), rare = shares.length ? Math.min(...shares) : null;
  const bonus = rare == null ? 0 : rare < 0.1 ? 7 : rare < 0.2 ? 4 : 0;
  return { value: clamp(base + bonus), why: `${lastDays == null ? "no story on it in 30 days" : `last story on it ${Math.round(lastDays)} day${Math.round(lastDays) === 1 ? "" : "s"} earlier`}${bonus ? `, a rare signal (${Math.round(rare! * 100)}% share)` : ""}` };
}
/** SECTOR RELEVANCE — headline-tier signals and covered sectors score higher. */
export function relevanceComponent(c: Pick<Candidate, "signalKeys" | "sector" | "type">, ctx: ScoreCtx): Component {
  const tiers = c.signalKeys.map(ctx.tierOf);
  const [t, tw] = tiers.includes("headline") ? [15, "headline signal"] : tiers.includes("supporting") ? [9, "supporting signal"] : c.signalKeys.length ? [2, "archive-tier signal"] : c.type === "news" ? [4, "outside news"] : [10, "a brand's own move"];
  const [s, sw] = !c.sector ? [7, "all sectors"] : ctx.covered(c.sector) ? [10, `${sectorName(c.sector)} has coverage`] : [3, `${sectorName(c.sector)} is thinly covered`];
  return { value: clamp(Number(t) + Number(s)), why: `${tw}, ${sw}` };
}
export function sizeComponent(c: Pick<Candidate, "type" | "magnitude">): Component { const r = SIZE_RULES[c.type]; return { value: clamp(r.f(c.magnitude)), why: r.why(c.magnitude) }; }

export const total = (cs: Components) => Math.round((Object.keys(WEIGHTS) as ComponentId[]).reduce((s, k) => s + cs[k].value * WEIGHTS[k], 0));
export const COMPONENT_LABEL: Record<ComponentId, string> = { size: "Size", brand: "Brand weight", novelty: "Novelty", relevance: "Sector relevance" };
/** One line: the two strongest components, then the total against the threshold. */
export function whyRan(cs: Components, score: number): string {
  const top = (Object.keys(WEIGHTS) as ComponentId[]).sort((a, b) => cs[b].value - cs[a].value || a.localeCompare(b)).slice(0, 2);
  return `${top.map(k => `${COMPONENT_LABEL[k]} ${cs[k].value}/25 (${cs[k].why})`).join("; ")}. Score ${score} against a threshold of ${PUBLISH_MIN}.`;
}

/** One first-seen story per sector per week keeps the front page from becoming a list of new tags. */
export const FIRST_SEEN_PER_SECTOR_DAYS = DEDUPE_DAYS;
const keysOf = (c: { type: string; domains: string[]; signal_keys?: string[]; signalKeys?: string[]; sector: string | null }) => {
  const sig = c.signalKeys ?? c.signal_keys ?? [];
  if (c.type === "first_seen") return [`${c.type}|x|${c.sector ?? "all"}`];
  // Brand stories dedupe by their brand; signal stories by their signal(s); a roundup by its first signal or brands.
  return c.domains.length === 1 || !sig.length ? c.domains.map(d => `${c.type}|d|${d}`) : sig.map(k => `${c.type}|s|${k}`);
};
const what = (k: string) => (k.includes("|d|") ? "brand" : k.includes("|x|") ? "sector" : "signal");
const utcDay = (iso: string) => iso.slice(0, 10);

/** Score, merge, dedupe, threshold, fold and cap. Candidates already stored are dropped first (idempotent). */
export function planStories(candidates: Candidate[], existing: Existing[], ctx: ScoreCtx): Planned[] {
  const stored = new Set(existing.map(e => e.id));
  const fresh = [...new Map(candidates.filter(c => !stored.has(c.id)).map(c => [c.id, c])).values()];
  // Last story on the same brand or signal (stored published stories and this batch), for novelty.
  const times = new Map<string, { t: number; id: string }[]>();
  const note = (keys: string[], t: number, id: string) => { for (const k of keys) times.set(k, [...(times.get(k) ?? []), { t, id }]); };
  const refs = (c: { domains: string[]; signalKeys?: string[]; signal_keys?: string[] }) => [...c.domains.map(d => `d|${d}`), ...(c.signalKeys ?? c.signal_keys ?? []).map(k => `s|${k}`)];
  for (const e of existing) if (e.status === "published") note(refs(e), Date.parse(e.happened_at), e.id);
  for (const c of fresh) note(refs(c), Date.parse(c.happenedAt), c.id);
  const plan: Planned[] = fresh.map(c => {
    // Earlier stories on the same brand or signal, not counting the stories this one tells (its members).
    const t = Date.parse(c.happenedAt), skip = new Set([c.id, ...(c.members ?? [])]);
    const before = refs(c).flatMap(k => times.get(k) ?? []).filter(x => !skip.has(x.id) && x.t < t - 1 && x.t > t - 30 * dayMs).map(x => x.t);
    const last = before.length ? (t - Math.max(...before)) / dayMs : null;
    const components: Components = { size: sizeComponent(c), brand: brandComponent(c, ctx), novelty: noveltyComponent(c, last, ctx), relevance: relevanceComponent(c, ctx) };
    const score = total(components);
    return { ...c, components, score, status: "published", reason: "ran", whyRan: whyRan(components, score) };
  });
  const hold = (p: Planned, reason: string) => { if (p.status === "published") { p.status = "held"; p.reason = reason; } };
  const live = () => plan.filter(p => p.status === "published");
  // 0) Rule holds decided before scoring (seasonal skins, estimate-only moves, counter-moves waiting for their roundup).
  for (const p of plan) if (p.holdReason) hold(p, p.holdReason);
  const byScore = (a: Planned, b: Planned) => b.score - a.score || b.happenedAt.localeCompare(a.happenedAt) || a.id.localeCompare(b.id);

  // Launches never rank: they only appear in New on the scene.
  for (const p of plan) if (p.type === "launch") p.reason = "launch: shown only in New on the scene";
  const ranked = () => live().filter(p => p.type !== "launch");

  // 1) A SHIFT and a BREAKOUT on the same signal in the same run merge into the shift.
  for (const b of plan.filter(p => p.type === "breakout" && p.runId != null && !p.sector)) {
    const s = plan.find(p => p.type === "shift" && p.runId === b.runId && p.signalKeys[0] === b.signalKeys[0]);
    if (!s) continue;
    s.facts = [...s.facts, ...b.facts.filter(f => f.kind !== "brand")]; s.sourceIds = [...new Set([...s.sourceIds, ...b.sourceIds])]; s.kicker = `${s.kicker} · Breakout`;
    hold(b, `merged into ${s.id}`);
  }
  // 2) Dedupe: same brand or signal + type within 7 days. A story that already ran wins; in this batch the higher score wins.
  const ran = new Map<string, number[]>();
  for (const e of existing) if (e.status === "published") for (const k of keysOf(e)) ran.set(k, [...(ran.get(k) ?? []), Date.parse(e.happened_at)]);
  const taken = new Map<string, Planned[]>();
  for (const p of ranked().sort(byScore)) {
    const t = Date.parse(p.happenedAt), ks = keysOf(p);
    const prior = ks.find(k => (ran.get(k) ?? []).some(x => Math.abs(x - t) < DEDUPE_DAYS * dayMs));
    if (prior) { hold(p, `same ${what(prior)} and type already ran within ${DEDUPE_DAYS} days`); continue; }
    const winner = ks.flatMap(k => taken.get(k) ?? []).find(w => Math.abs(Date.parse(w.happenedAt) - t) < DEDUPE_DAYS * dayMs);
    if (winner) { hold(p, `duplicate of ${winner.id} (higher score, same ${what(ks[0]!)} and type within ${DEDUPE_DAYS} days)`); continue; }
    for (const k of ks) taken.set(k, [...(taken.get(k) ?? []), p]);
  }
  // 3) Threshold.
  for (const p of ranked()) if (p.score < PUBLISH_MIN) hold(p, `score ${p.score} below the publish threshold of ${PUBLISH_MIN}`);
  // 4) Fold: members of a running roundup, rebrand or counter-move stop running as separate stories.
  for (const parent of ranked().filter(p => p.members?.length)) for (const id of parent.members!) { const m = plan.find(p => p.id === id); if (m) hold(m, `told in ${parent.id}`); }
  // 5) Daily caps by UTC day of happened_at, counting stories that already ran that day.
  const counts = new Map<string, { all: number; news: number }>();
  for (const e of existing) if (e.status === "published" && e.type !== "launch") { const d = counts.get(utcDay(e.happened_at)) ?? { all: 0, news: 0 }; d.all++; if (e.type === "news") d.news++; counts.set(utcDay(e.happened_at), d); }
  for (const p of ranked().sort(byScore)) {
    const d = counts.get(utcDay(p.happenedAt)) ?? { all: 0, news: 0 };
    if (d.all >= DAILY_CAP) { hold(p, `over the daily cap of ${DAILY_CAP} stories`); continue; }
    if (p.type === "news" && d.news >= NEWS_DAILY_CAP) { hold(p, `over the daily cap of ${NEWS_DAILY_CAP} news stories`); continue; }
    d.all++; if (p.type === "news") d.news++; counts.set(utcDay(p.happenedAt), d);
  }
  return plan.sort((a, b) => a.happenedAt.localeCompare(b.happenedAt) || a.id.localeCompare(b.id));
}

/** Read-time ordering under a sector lens: that sector's stories get LENS_BOOST points; stored scores are untouched. */
export const lensScore = (s: { score: number; sector: string | null }, sector: string) => s.score + (sector !== "all" && s.sector === sector ? LENS_BOOST : 0);
export const typeName = (t: StoryKind) => STORY_TYPE_DEFS[t].kicker;
export const signalName = (k: string) => label(k).name;
