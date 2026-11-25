// Story candidates from what already exists: library events, rebrands, real forecast runs, alerts, wire items, launches,
// the current library sample and its archive. Pure and deterministic: same rows in, same candidates (and ids) out.
import { basis, canonical, label, storySectorName as sectorName, stageName, untick, type Basis } from "../labels";
import type { Check } from "../integrity";
import { eventSentence, EVENT_KIND, REBRAND_WORDS, type EventRow, type RebrandRow } from "../agency/changes";
import { siteTraits, type SiteRow } from "../forecast-signals";
import { runBase, sampleQuarter, whiteSpaceHeadline, type SampleRow } from "./sheet";
import { brandPath, patternPath, signalPath } from "../ia";
import { pct } from "../digest/copy";
import { isoWeek } from "../digest/week";
import { rowKey, tiersFrom, type SignalRow } from "../signals";
import { SECTOR_COVERAGE_MIN } from "../sector-lens";
import type { Tier } from "../tiers";
import { comparisonPair } from "../run-gap";
import { isAiField, notSteadyReason, unsteadyKey, type AiField, type NotSteady, type Unsteady } from "./steady";
import { SEASONAL_HELD_EVENTS, SEASONAL_REASON, seasonalEventIds } from "../promo";
import { changedWhat, isRebrand, rebrandDimensions } from "../rebrand-rule";
import { REVERSED_REASON, reversalIds } from "../reversal";
import {
  AI_EVENTS, ALREADY_THERE_REASON, CROSSOVER_FLOOR, CROSSOVER_HISTORY_QUARTERS, CROSSOVER_LEAD_MIN, MORE_READ_REASON, NO_EARLIER_READING_REASON, READ_GROWTH_MIN_BASE, READ_GROWTH_MIN_RATIO, FIRST_SEEN_MIN_BRANDS, MOVE_EVENTS, MOVE_LAYOUT_FIELDS, NEWS_ALIASES, NEWS_NAME_MIN, NEWS_NAME_STOPWORDS, NEWS_SIGNAL_MIN,
  REBRAND_FOLD_AFTER_DAYS, REBRAND_FOLD_BEFORE_DAYS, FIRST_SEEN_DIMENSIONS, FIRST_SEEN_ARCHIVE_MIN_BRANDS, FIRST_SEEN_ARCHIVE_MIN_QUARTERS, STORY_TYPE_DEFS, WHITE_SPACE_MAX_SHARE, WHITE_SPACE_MIN_ELSEWHERE,
  WHITE_SPACE_MIN_SECTOR_SITES, FIRST_SEEN_MAX_BRANDS, WHITE_SPACE_SKIP_CATEGORIES, WHITE_SPACE_NOT_APPLICABLE, countWord, COUNTER_HELD_REASON, ESTIMATE_ONLY_REASON, NEWS_SUBJECT_TERMS, type Candidate, type Fact, type NewsDropReason,
} from "./types";

export type RunRows = { id: number; at: string; rows: SignalRow[] };
export type WireIn = { id: number; title: string; url: string; source: string; source_kind: string; published_at: string; excerpt: string | null; ref?: string | null };
export type SiteNow = { domain: string; name: string | null; sector: string; captured: string | null; traits: string[]; /** Site kind (brand-names.ts); absent reads the seed. */ kind?: string | null };
/** One archive capture: its traits and the kinds of signal (categories) the capture actually measured, positive or not. */
export type ArchiveRow = { domain: string; sector: string; quarter: string; traits: string[]; measured: string[] };
/** Categories an archive capture measured: a field that was read at all (light theme and sans headlines count as measured). */
export function archiveMeasured(r: Pick<SiteRow, "theme" | "h1_family" | "webfont" | "h1_tracking" | "hero_media" | "frameworks">): string[] {
  const out: string[] = [];
  if (r.theme) out.push("theme");
  if (r.h1_family) out.push("headline");
  if (typeof r.webfont === "boolean") out.push("font");
  if (typeof r.h1_tracking === "number") out.push("tracking");
  if (r.hero_media) out.push("hero_media");
  if (r.frameworks && typeof r.frameworks === "object" && Object.keys(r.frameworks as object).length) out.push("framework");
  return out;
}
export type BuildInput = {
  now: string;
  /** E2e · measurement-integrity verdicts per live change (integrity.ts). When present, only the passing part of each change is a tape
   *  line or can feed a story; the rest is the Data view's unconfirmed list. Absent only in older rule tests. */
  checks?: Record<number, Check>;
  /** W3a Part E · AI-read fields whose reading was not steady between the build's two runs, per scope (absent: none known). */
  unsteady?: Unsteady[];
  events: EventRow[]; rebrands: RebrandRow[];
  /** Real (non-dev) forecast runs, oldest first. */
  runs: RunRows[];
  alerts: WireIn[]; wire: WireIn[]; launches: WireIn[];
  sites: SiteNow[]; archive: ArchiveRow[];
  trendsetters: { domain: string; rank: number }[];
  /** Headline, sub-headline and button texts per library snapshot id, for the seasonal check (promo.ts). */
  texts?: Record<number, string[]>;
  /** Live events from REVERSAL_DAYS before the window onwards (a superset of `events`), so a change back inside the window finds the change it reverses. */
  history?: EventRow[];
  /** The editor's headline calls per library event id (headline-call.ts); a headline change without one is not counted yet. */
  calls?: Record<number, { call: string; reason: string }>;
  /** E2c · snapshot ids whose first screen is a carousel (`layout.hero_carousel`); their headline and hero changes are rotations (carousel.ts). */
  carousel?: number[];
  /** E2g · the census: the last eight days of live desktop home captures and the stored counts behind published census stories (census.ts). */
  census?: import("../census").CensusInput | null;
  /** W1b · the quiet change: confirmed icon/card changes, the addresses of the captures non-home changes cite, and the wire from 14 days before the window (quiet.ts). */
  quiet?: import("./quiet").QuietInput | null;
};

const day = 864e5;
const STAGE_ORDER: Record<string, number> = { Emerging: 0, Rising: 1, Steady: 1.5, Peaking: 2, Fading: 3 };
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const shortDate = (iso: string) => { const d = new Date(iso); return Number.isNaN(+d) ? iso : `${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`; };
/** A label used mid-sentence: lower-case the first letter unless it starts an acronym ("Serif headlines" → "serif headlines", "AI" stays). */
export const inline = (name: string) => (/^[A-Z][a-z]/.test(name) ? name[0]!.toLowerCase() + name.slice(1) : name);
const listOf = (xs: string[], n = 3) => (xs.length <= 1 ? xs.join("") : xs.length <= n ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : `${xs.slice(0, n).join(", ")} and ${xs.length - n} more`);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const where = (sector: string | null) => (!sector || sector === "all" ? "across all sectors" : `in ${inline(sectorName(sector))}`);
const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}`;
/** Our own words never carry a "$": a price reads as "USD 20", anything else drops the sign. E3: a quotation is exact, so text inside
 *  quotation marks (“…”, ‘…’, "…") is the captured text unchanged and keeps its "$". */
const QUOTED = /“[^”]*”|‘[^’]*’|"[^"]*"/g;
const ownDollar = (s: string) => s.replace(/\$\s?(?=\d)/g, "USD ").replace(/\$/g, "");
export const noDollar = (s: string) => { let out = "", at = 0; for (const m of s.matchAll(QUOTED)) { out += ownDollar(s.slice(at, m.index)) + m[0]; at = m.index + m[0].length; } return out + ownDollar(s.slice(at)); };
/** "A, B, B" → "A, B": palette sentences can repeat a colour name for near-identical swatches. */
export const dedupeList = (s: string) => s.replace(/(?<=\b(?:to|:)\s)([^:;.]+)/g, list => [...new Set(list.split(", "))].join(", "));
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Everything the builders share: tiers from the latest real run, row lookups, sector membership and trendsetter ranks. */
export type Ctx = ReturnType<typeof context>;
export function context(input: BuildInput) {
  const runs = [...input.runs].sort((a, b) => a.id - b.id), cur = runs.at(-1) ?? null;
  const prevStages = new Map<string, (string | null)[]>();
  [runs.at(-2), runs.at(-3)].forEach((r, i) => { for (const x of r?.rows ?? []) if (x.scope === "all") { const k = rowKey(x), a = prevStages.get(k) ?? [null, null]; a[i] = x.stage; prevStages.set(k, a); } });
  const tierMap = cur ? tiersFrom(cur.rows, prevStages) : new Map();
  const tiers = new Map<string, Tier>([...tierMap.values()].map(t => [t.key, t.tier]));
  const index = new Map<number, Map<string, SignalRow>>(runs.map(r => [r.id, new Map(r.rows.map(x => [`${rowKey(x)}|${x.scope}`, x]))]));
  const row = (run: RunRows | null | undefined, key: string, scope = "all") => (run ? index.get(run.id)?.get(`${key}|${scope}`) ?? null : null);
  const headline = new Set([...tiers].filter(([, t]) => t === "headline").map(([k]) => k));
  const sites = input.sites.filter(s => s.traits.length), bySector = new Map<string, SiteNow[]>();
  for (const s of sites) bySector.set(s.sector, [...(bySector.get(s.sector) ?? []), s]);
  const rank = new Map(input.trendsetters.map(t => [t.domain, t.rank]));
  const byRank = (a: string, b: string) => (rank.get(a) ?? 999) - (rank.get(b) ?? 999) || a.localeCompare(b);
  const showing = (key: string, sector?: string | null) => (sector ? bySector.get(sector) ?? [] : sites).filter(s => s.traits.includes(key)).map(s => s.domain).sort(byRank);
  /** A sector is covered when at least half the headline signals have an ok forecast row there (the sector lens rule). */
  const covered = (sector: string | null) => {
    if (!sector || sector === "all") return true;
    if (!cur || !headline.size) return false;
    let n = 0; for (const k of headline) if (row(cur, k, sector)?.status === "ok") n++;
    return n / headline.size >= SECTOR_COVERAGE_MIN;
  };
  /** Stage for a brand's sector when covered, else all sectors. */
  const stageFor = (key: string, sector: string | null) => { const s = sector && covered(sector) ? row(cur, key, sector) : null; return s?.status === "ok" ? { stage: s.stage, scope: sector! } : { stage: row(cur, key)?.stage ?? null, scope: "all" }; };
  /** The one valid run-to-run comparison (latest real run vs the most recent real run at least MIN_RUN_GAP_DAYS older), or null. */
  const pair = comparisonPair(runs);
  const unsteadyMap = new Map((input.unsteady ?? []).map(u => [unsteadyKey(u.field, u.scope), u]));
  /** W3a · the not-steady verdict for a signal key's field in a scope (null for measured fields or a steady reading). */
  const unsteadyOf = (key: string, scope: string) => { const f = key.split(":")[0]!; return isAiField(f) ? unsteadyMap.get(unsteadyKey(f, scope)) ?? null : null; };
  return { runs, cur, pair, tiers, headline, row, sites, bySector, rank, byRank, showing, covered, stageFor, unsteadyOf, now: input.now };
}
const tierOf = (ctx: Ctx, key: string): Tier | null => ctx.tiers.get(canonical(key)) ?? null;
const shown = (ctx: Ctx, key: string) => { const t = tierOf(ctx, key); return t === "headline" || t === "supporting"; };
const brandFact = (domains: string[], total: number, sector: string | null, key: string): Fact => ({
  text: `Seen on ${total} tracked ${sector ? `${inline(sectorName(sector))} ` : ""}brand${total === 1 ? "" : "s"}${domains.length ? `${total === 1 ? ":" : ", including"} ${listOf(domains.slice(0, 3))}` : ""}`,
  href: patternPath(key), basis: basis(key), kind: "brand",
});

// MOVE ---------------------------------------------------------------------------------------------
/** A visible move: the event type is a visitor-facing change (layout only when the hero changed). */
export function isVisibleMove(e: Pick<EventRow, "type" | "after" | "before">): boolean {
  if (!MOVE_EVENTS.has(e.type)) return false;
  if (e.type !== "layout_change") return true;
  const keys = Object.keys({ ...(e.before as object ?? {}), ...(e.after as object ?? {}) });
  return keys.some(k => MOVE_LAYOUT_FIELDS.has(k));
}
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
/** Traits a move gained and dropped (only the fields this event measured). */
export function traitDelta(e: Pick<EventRow, "type" | "before" | "after" | "domain" | "sector">): { gained: string[]; dropped: string[] } {
  const side = (v: unknown): SiteRow => {
    const o = obj(v), r: SiteRow = { domain: e.domain, quarter: "", sector: e.sector ?? "" };
    if (e.type === "type_change" && typeof o["h1"] === "string") r.h1_family = o["h1"];
    if (e.type === "theme_flip" && typeof o["theme"] === "string") r.theme = o["theme"];
    if (e.type === "layout_change" && typeof o["hero_media"] === "string") r.hero_media = o["hero_media"];
    if (AI_EVENTS.has(e.type)) { const dim = e.type === "imagery_shift" ? "imagery" : "aesthetic"; r.ai_tags = { [dim]: o[dim] }; }
    return r;
  };
  const b = new Set(siteTraits(side(e.before))), a = new Set(siteTraits(side(e.after)));
  return { gained: [...a].filter(k => !b.has(k)).sort(), dropped: [...b].filter(k => !a.has(k)).sort() };
}
/** Layout fields in plain words through labels.ts: "Video hero" → "video", "Left-aligned headlines" → "left-aligned". */
const LAYOUT_WHAT: Record<string, string> = { hero_media: "Hero", h1_align: "Headlines" };
const layoutValue = (field: string, v: unknown) => {
  if (v == null || v === "" || v === "none") return field === "hero_media" ? "no media" : "none";
  const name = label(`${field}:${String(v)}`).name;
  return field === "hero_media" ? (/^No hero media$/i.test(name) ? "no media" : inline(name.replace(/ hero$/i, ""))) : inline(name.replace(/ headlines$/i, ""));
};
const layoutName = (field: string, v: unknown) => (v == null || v === "" ? (field === "hero_media" ? "No hero media" : "No alignment") : label(`${field}:${String(v)}`).name);
function layoutMove(e: EventRow): Candidate {
  const b = obj(e.before), a = obj(e.after), fields = [...MOVE_LAYOUT_FIELDS].filter(f => f in a || f in b);
  const lines = fields.map(f => `${LAYOUT_WHAT[f]} changed from ${layoutValue(f, b[f])} to ${layoutValue(f, a[f])}`), brand = brandPath(e.domain);
  const facts: Fact[] = [
    ...(fields.length === 1 ? [{ text: `Before: ${layoutName(fields[0]!, b[fields[0]!])}`, href: brand, basis: "measured" as const, kind: "before" as const }, { text: `After: ${layoutName(fields[0]!, a[fields[0]!])}`, href: brand, basis: "measured" as const, kind: "after" as const }] : []),
    ...lines.map(t => ({ text: t, href: brand, basis: "measured" as const })),
    { text: `Confirmed on a second capture, ${shortDate(e.detected_at)}`, href: `${brand}?view=data`, basis: "measured", kind: "date" },
  ];
  const what = fields.includes("hero_media") ? (fields.length > 1 ? "hero and headline alignment" : "hero") : "headline alignment";
  return { id: `move:${e.id}`, type: "move", kicker: `Move · ${EVENT_KIND[e.type] ?? "Change"}${e.sector ? ` · ${sectorName(e.sector)}` : ""}`, headline: `${e.domain} changed its ${what}`,
    deck: `${lines.join("; ")}. Confirmed ${shortDate(e.detected_at)}.`, facts, sector: e.sector ?? null, signalKeys: [], domains: [e.domain],
    evidence: [{ label: "Brand page", href: brand }, { label: "Library record", href: `${brand}?view=data` }], sourceIds: [`event:${e.id}`], basis: "measured", happenedAt: e.detected_at,
    magnitude: Math.max(1, fields.length) };
}
export function moveCandidate(e: EventRow): Candidate {
  if (e.type === "layout_change") return layoutMove(e);
  const sentence = dedupeList(untick(eventSentence(e))), cut = sentence.indexOf(": ");
  // "x.com changed its palette to A, B, C" keeps the headline short and moves the list into the after line.
  const to = cut > 0 ? null : /^(.+? changed its [a-z ]+?) to (.+)$/.exec(sentence);
  const head = to ? to[1]! : cut > 0 ? sentence.slice(0, cut) : sentence, detail = to ? `→ ${to[2]}` : cut > 0 ? sentence.slice(cut + 2) : "";
  const parts = detail ? detail.split("; ") : [], arrow = parts.length === 1 ? parts[0]!.split(/ ?→ /) : [];
  const b: Basis = AI_EVENTS.has(e.type) ? "ai" : "measured", brand = brandPath(e.domain);
  const facts: Fact[] = [
    ...(arrow.length === 2 ? [...(arrow[0] ? [{ text: `Before: ${arrow[0]}`, href: brand, basis: b, kind: "before" as const }] : []), { text: `After: ${arrow[1]}`, href: brand, basis: b, kind: "after" as const }] : parts.map(p => ({ text: p, href: brand, basis: b }))),
    { text: `Confirmed on a second capture, ${shortDate(e.detected_at)}`, href: `${brand}?view=data`, basis: b, kind: "date" },
  ];
  const fields = Object.keys(obj(e.after)).length;
  return { id: `move:${e.id}`, type: "move", kicker: `Move · ${EVENT_KIND[e.type] ?? "Change"}${e.sector ? ` · ${sectorName(e.sector)}` : ""}`, headline: head,
    deck: `${to ? `Now ${to[2]}. ` : detail ? `${detail}. ` : ""}Confirmed ${shortDate(e.detected_at)}.`, facts, sector: e.sector ?? null, signalKeys: [], domains: [e.domain],
    evidence: [{ label: "Brand page", href: brand }, { label: "Library record", href: `${brand}?view=data` }], sourceIds: [`event:${e.id}`], basis: b, happenedAt: e.detected_at,
    magnitude: e.type === "redesign" ? 99 : Math.max(1, fields) };
}

// REBRAND ------------------------------------------------------------------------------------------
/** One templated sentence from the reasons and the date (never the rebrand desk's stored read). */
export const rebrandDeck = (r: Pick<RebrandRow, "reasons" | "confirmed_at">) => {
  const reasons = r.reasons.map(x => REBRAND_WORDS[x] ?? x), n = reasons.length;
  return n ? `${countWord(n)} identity change${n === 1 ? "" : "s"} confirmed ${n === 1 ? "" : "together "}on ${shortDate(r.confirmed_at)}: ${listOf(reasons, 5)}.` : `Identity change confirmed on ${shortDate(r.confirmed_at)}.`;
};
export function rebrandCandidate(r: RebrandRow, moves: { c: Candidate; e: EventRow }[]): Candidate {
  const at = Date.parse(r.confirmed_at), reasons = r.reasons.map(x => REBRAND_WORDS[x] ?? x);
  const members = moves.filter(m => m.e.domain === r.domain && Date.parse(m.e.detected_at) >= at - REBRAND_FOLD_BEFORE_DAYS * day && Date.parse(m.e.detected_at) <= at + REBRAND_FOLD_AFTER_DAYS * day).map(m => m.c);
  if (!isRebrand(r)) return identityMove(r, members);
  const brand = brandPath(r.domain);
  return { id: `rebrand:${r.domain}:${r.confirmed_at.slice(0, 10)}`, type: "rebrand", kicker: `Rebrand · ${sectorName(r.sector)}`,
    headline: `${r.domain} rebranded: new ${listOf(reasons, 4) || "identity"}`, deck: rebrandDeck(r),
    facts: [{ text: `Changed: ${listOf(reasons, 5) || "identity"}`, href: brand, basis: "measured" }, { text: `Confirmed ${shortDate(r.confirmed_at)}`, href: `/brands?tab=moves`, basis: "measured", kind: "date" },
      ...members.map(m => ({ text: m.headline, href: brand, basis: m.basis, kind: "member" as const }))],
    sector: r.sector, signalKeys: [], domains: [r.domain], evidence: [{ label: "Brand page", href: brand }, { label: "Rebrand desk", href: "/brands?tab=moves" }],
    sourceIds: [`rebrand:${r.domain}:${r.confirmed_at}`, ...members.map(m => `story:${m.id}`)], basis: "measured", happenedAt: r.confirmed_at, magnitude: Math.max(1, r.reasons.length), members: members.map(m => m.id) };
}

/**
 * A rebrand-desk change that does not earn "rebrand" (fewer than three dimensions, or a seasonal capture): an ordinary move with plain wording.
 * One member move lends its own headline ("x changed its headline font: A → B"); otherwise "x changed its font and palette". Scored and capped as a move.
 */
export function identityMove(r: RebrandRow, all: Candidate[]): Candidate {
  // One line per distinct change: two captures of "changed its headline" read once.
  const members = all.filter((m, i) => all.findIndex(x => x.headline === m.headline) === i);
  const brand = brandPath(r.domain), one = members.length === 1 ? members[0]! : null, dims = Math.max(1, rebrandDimensions(r.reasons).length);
  // "x.com changed its palette" → "palette"; any other member sentence keeps its verb ("switched to a light theme (was dark)").
  const strip = (h: string) => (h.startsWith(`${r.domain} `) ? h.slice(r.domain.length + 1) : h);
  const changed = [...new Set(members.map(m => strip(m.headline)).filter(h => h.startsWith("changed its ")).map(h => h.slice(12)))];
  const others = [...new Set(members.map(m => strip(m.headline)).filter(h => !h.startsWith("changed its ")))];
  const said = [...(changed.length ? [`changed its ${listOf(changed, 6)}`] : []), ...others].join("; ");
  const date = { text: `Confirmed on a second capture, ${shortDate(r.confirmed_at)}`, href: `${brand}?view=data`, basis: "measured" as const, kind: "date" as const };
  return { id: `rebrand:${r.domain}:${r.confirmed_at.slice(0, 10)}`, type: "move", kicker: one ? one.kicker : `Move · Identity${r.sector ? ` · ${sectorName(r.sector)}` : ""}`,
    headline: one ? one.headline : `${r.domain} changed its ${changedWhat(r.reasons)}`,
    deck: one ? one.deck : `${said ? `${said[0]!.toUpperCase()}${said.slice(1)}. ` : ""}Confirmed ${shortDate(r.confirmed_at)}.`,
    facts: one ? one.facts : [{ text: `Changed: ${changedWhat(r.reasons)}`, href: brand, basis: "measured" }, ...members.map(m => ({ text: m.headline, href: brand, basis: m.basis, kind: "member" as const })), date],
    sector: r.sector, signalKeys: [], domains: [r.domain], evidence: [{ label: "Brand page", href: brand }, { label: "Library record", href: `${brand}?view=data` }],
    sourceIds: [`rebrand:${r.domain}:${r.confirmed_at}`, ...members.map(m => `story:${m.id}`)], basis: one ? one.basis : "measured", happenedAt: r.confirmed_at, magnitude: dims, members: members.map(m => m.id),
    ...(r.seasonal ? { holdReason: SEASONAL_REASON } : {}) };
}

// P2 · LIKE WITH LIKE ----------------------------------------------------------------------------------
/** Homepages read behind a row's share in its run: its latest stored quarter's base (n), or null when not stored. */
export const homepagesRead = (r: SampleRow | null | undefined): number | null => {
  const x = r?.sample && typeof r.sample === "object" ? (r.sample as { n?: unknown }) : null;
  return x && typeof x.n === "number" && Number.isFinite(x.n) && x.n > 0 ? x.n : null;
};
/** A refused comparison: the story that would have been built and the homepages read in each run. */
export type ReadGrowth = { id: string; reason: typeof MORE_READ_REASON; earlier: { run: number; read: number | null }; later: { run: number; read: number | null } };
/** Whether two runs' rows for one signal and scope read comparable samples: the earlier run read at least READ_GROWTH_MIN_RATIO of the
 *  later run's homepages and at least READ_GROWTH_MIN_BASE. An unknown count is not comparable (fail closed). */
export function readComparable(earlier: SampleRow | null | undefined, later: SampleRow | null | undefined): boolean {
  const a = homepagesRead(earlier), b = homepagesRead(later);
  return a != null && b != null && a >= READ_GROWTH_MIN_BASE && a >= READ_GROWTH_MIN_RATIO * b;
}
const growth = (id: string, prev: { id: number }, cur: { id: number }, a: SampleRow | null | undefined, b: SampleRow | null | undefined): ReadGrowth =>
  ({ id, reason: MORE_READ_REASON, earlier: { run: prev.id, read: homepagesRead(a) }, later: { run: cur.id, read: homepagesRead(b) } });

// SHIFT --------------------------------------------------------------------------------------------
export const stageDistance = (from: string | null, to: string | null) => { const a = stageName(from), b = stageName(to); return a && b ? Math.abs(STAGE_ORDER[a]! - STAGE_ORDER[b]!) : 1; };
export function shiftCandidates(ctx: Ctx, refused?: ReadGrowth[], notSteady?: NotSteady[]): Candidate[] {
  const out: Candidate[] = [];
  // Only the latest real run against the most recent real run at least MIN_RUN_GAP_DAYS older; closer runs are reruns.
  if (ctx.pair) {
    const prev = ctx.pair.earlier, cur = ctx.pair.latest;
    for (const r of cur.rows) {
      const key = rowKey(r);
      if (r.scope !== "all" || !ctx.headline.has(key)) continue;
      const was = ctx.row(prev, key); if (!was) continue; // a signal new since the earlier run is not a shift
      const before = stageName(was.stage), after = stageName(r.stage);
      if (!before || !after || before === after) continue;
      // P2 · a stage that moved only because many more homepages were read is not a change.
      if (!readComparable(was, r)) { refused?.push(growth(`shift:${key}:${cur.id}`, prev, cur, was, r)); continue; }
      // W3a · nor one whose AI-read field changed on too many homepages read in both runs (the reading follows the day's page).
      const u = ctx.unsteadyOf(key, "all");
      if (u) { notSteady?.push(steadyRefusal(`shift:${key}:${cur.id}`, u)); continue; }
      const l = label(key), ex = ctx.showing(key);
      out.push({ id: `shift:${key}:${cur.id}`, type: "shift", kicker: `Shift · ${l.dimension}`, headline: `${l.name} moved from ${before} to ${after}`,
        deck: `${r.current_share != null ? `On ${pct(r.current_share, 1)} of tracked homepages` : "Share not measured"}${ex.length ? `, including ${listOf(ex.slice(0, 3))}` : ""}. Forecast run ${cur.id}.`,
        facts: [
          { text: `Stage ${before} in forecast run ${prev.id}, ${after} in run ${cur.id}`, href: signalPath(key), basis: basis(key), kind: "stage" },
          ...(r.current_share != null ? [{ text: `On ${pct(r.current_share, 1)} of tracked homepages`, href: signalPath(key), basis: basis(key), kind: "share" as const }] : []),
          ...(ex.length ? [brandFact(ex, ex.length, null, key)] : []),
        ],
        sector: null, signalKeys: [key], domains: ex.slice(0, 3), evidence: [{ label: "Signal page", href: signalPath(key) }, { label: "Forecast ledger", href: "/ledger" }],
        sourceIds: [`run:${prev.id}`, `run:${cur.id}`], basis: basis(key), happenedAt: cur.at, magnitude: stageDistance(before, after), runId: cur.id, stage: r.stage });
    }
  }
  return out;
}

// BREAKOUT -----------------------------------------------------------------------------------------
const ALERT_RE = /[?&]alert=(\d+)-([a-z_]+)/;
export function breakoutCandidates(ctx: Ctx, alerts: WireIn[]): Candidate[] {
  const out: Candidate[] = [];
  for (const a of alerts) {
    const m = ALERT_RE.exec(a.url); if (!m || m[2] !== "breakout" || !a.ref) continue;
    const key = canonical(a.ref); if (!ctx.headline.has(key)) continue;
    const runId = Number(m[1]), scope = /[?&]sector=([a-z-]+)/.exec(a.url)?.[1] ?? "all", run = ctx.runs.find(r => r.id === runId), r = ctx.row(run, key, scope);
    const l = label(key), ex = ctx.showing(key, scope === "all" ? null : scope);
    out.push({ id: `breakout:${key}:${scope}:${runId}`, type: "breakout", kicker: `Breakout · ${l.dimension}${scope !== "all" ? ` · ${sectorName(scope)}` : ""}`,
      headline: `${l.name}: breaking out ${where(scope)}`,
      deck: [r?.momentum != null ? `Momentum ${signed(r.momentum)} points a quarter` : null, r?.current_share != null ? `on ${pct(r.current_share, 1)} of tracked ${scope !== "all" ? `${inline(sectorName(scope))} ` : ""}homepages` : null].filter(Boolean).join(", ").replace(/^./, c => c.toUpperCase()) + `. Forecast run ${runId}.`,
      facts: [
        ...(r?.momentum != null ? [{ text: `Momentum ${signed(r.momentum)} points a quarter, in the top tenth of all fitted signals`, href: signalPath(key), basis: basis(key), kind: "share" as const }] : []),
        ...(r?.current_share != null ? [{ text: `On ${pct(r.current_share, 1)} of tracked ${scope !== "all" ? `${inline(sectorName(scope))} ` : ""}homepages`, href: signalPath(key), basis: basis(key), kind: "share" as const }] : []),
        ...(ex.length ? [brandFact(ex, ex.length, scope === "all" ? null : scope, key)] : []),
        { text: `Alert fired by forecast run ${runId}`, href: a.url.replace(/^https?:\/\/[^/]+/, ""), basis: basis(key), kind: "source" },
      ],
      sector: scope === "all" ? null : scope, signalKeys: [key], domains: ex.slice(0, 3), evidence: [{ label: "Signal page", href: signalPath(key) }],
      sourceIds: [`wire:${a.id}`, `run:${runId}`], basis: basis(key), happenedAt: a.published_at, magnitude: r?.momentum ?? 1, runId, stage: r?.stage ?? null });
  }
  return out;
}

// FIRST SEEN ---------------------------------------------------------------------------------------
const category = (k: string) => k.slice(0, Math.max(0, k.indexOf(":")));
/** Can this kind of signal be first-seen at all? Only categories the archive measures from stored HTML/CSS (FIRST_SEEN_DIMENSIONS). */
export const firstSeenEligible = (key: string) => Object.hasOwn(FIRST_SEEN_DIMENSIONS, category(key));
/** Archive depth per sector ("all" = library-wide) and category: brands and distinct quarters where the category was measured. */
export function archiveDepth(archive: ArchiveRow[]) {
  const m = new Map<string, { brands: Set<string>; quarters: Set<string> }>();
  for (const a of archive) for (const c of a.measured) for (const scope of [a.sector, "all"]) {
    const k = `${scope}|${c}`, x = m.get(k) ?? { brands: new Set(), quarters: new Set() }; x.brands.add(a.domain); x.quarters.add(a.quarter); m.set(k, x);
  }
  return (sector: string | null, cat: string) => { const x = m.get(`${sector ?? "all"}|${cat}`); return { brands: x?.brands.size ?? 0, quarters: x?.quarters.size ?? 0 }; };
}
export const deepEnough = (d: { brands: number; quarters: number }) => d.brands >= FIRST_SEEN_ARCHIVE_MIN_BRANDS && d.quarters >= FIRST_SEEN_ARCHIVE_MIN_QUARTERS;
export function firstSeenCandidates(ctx: Ctx, archive: ArchiveRow[]): Candidate[] {
  const out: Candidate[] = [], all = new Set<string>(), bySector = new Map<string, Set<string>>(), depth = archiveDepth(archive);
  for (const a of archive) { const s = bySector.get(a.sector) ?? new Set(); for (const t of a.traits) { all.add(t); s.add(t); } bySector.set(a.sector, s); }
  const keys = [...new Set(ctx.sites.flatMap(s => s.traits))].filter(k => shown(ctx, k) && firstSeenEligible(k)).sort();
  const make = (key: string, sector: string | null, domains: string[]): Candidate => {
    const l = label(key), at = ctx.sites.filter(s => domains.includes(s.domain)).map(s => s.captured ?? ctx.now).sort()[0] ?? ctx.now;
    const w = sector ? `in ${inline(sectorName(sector))}` : "in the library";
    return { id: `first:${key}:${sector ?? "all"}`, type: "first_seen", kicker: `First seen · ${l.dimension}${sector ? ` · ${sectorName(sector)}` : ""}`, headline: `First seen ${w}: ${inline(l.name)}`,
      deck: `${countWord(domains.length)} tracked brand${domains.length === 1 ? " shows" : "s show"} it now (${listOf(domains)}); no earlier archive capture ${sector ? `in ${inline(sectorName(sector))} ` : ""}had it.`,
      facts: [brandFact(domains, domains.length, sector, key), { text: `Archive captures checked: none ${sector ? `in ${inline(sectorName(sector))} ` : ""}carried it before`, href: signalPath(key), basis: basis(key), kind: "count" }],
      sector, signalKeys: [key], domains: domains.slice(0, 6), evidence: [{ label: "Signal page", href: signalPath(key) }, { label: "Pattern", href: patternPath(key) }],
      sourceIds: domains.map(d => `site:${d}`), basis: basis(key), happenedAt: at, magnitude: domains.length, firstSeen: true, stage: ctx.row(ctx.cur, key)?.stage ?? null };
  };
  // E2a: at least FIRST_SEEN_MIN_BRANDS brands everywhere (one brand is a fluke or a single choice, not an arrival).
  const enoughAll = (_key: string, n: number) => n <= FIRST_SEEN_MAX_BRANDS && n >= FIRST_SEEN_MIN_BRANDS;
  const enoughSector = (n: number) => n <= FIRST_SEEN_MAX_BRANDS && n >= FIRST_SEEN_MIN_BRANDS;
  for (const key of keys) {
    // The archive must have measured this kind of signal deeply enough, or "first" would only mean "unmeasured".
    if (!deepEnough(depth(null, category(key)))) continue;
    if (!all.has(key)) { const d = ctx.showing(key); if (enoughAll(key, d.length)) out.push(make(key, null, d)); continue; }
    for (const [sector, traits] of [...bySector].sort(([a], [b]) => a.localeCompare(b))) {
      if (traits.has(key) || !deepEnough(depth(sector, category(key)))) continue;
      const d = ctx.showing(key, sector); if (enoughSector(d.length)) out.push(make(key, sector, d));
    }
  }
  return out;
}

// CROSSOVER ----------------------------------------------------------------------------------------
/** One stored quarter of a forecast row's evidence: its quarter, homepages read and share. */
export type StoredQuarter = { q: string; n: number; s: number };
/** "2026Q1" → "2026 Q1". */
export const quarterName = (q: string) => q.replace(/^(\d{4})Q([1-4])$/, "$1 Q$2");
/** A row's stored quarters ({ q, n, s }), oldest first; anything malformed is dropped. */
export function storedQuarters(v: unknown): StoredQuarter[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap(x => {
    const o = x && typeof x === "object" ? (x as Record<string, unknown>) : null;
    return o && typeof o["q"] === "string" && typeof o["n"] === "number" && Number.isFinite(o["n"]) && typeof o["s"] === "number" && Number.isFinite(o["s"]) ? [{ q: o["q"], n: o["n"], s: o["s"] }] : [];
  });
}
/** P2b · whether a crossover is new to the sector, from the later run's own stored quarters for the signal there: the last
 *  CROSSOVER_HISTORY_QUARTERS quarters, of which the last is "now". Every well-read quarter before it (READ_GROWTH_MIN_BASE homepages or
 *  more) must sit below CROSSOVER_FLOOR, or it was already there; the "up from" figure is the most recent of them, and with none there is
 *  no earlier reading to compare. A refusal names the most recent well-read quarter at or above the floor. Pure. */
export function sectorHistory(stored: unknown): { ok: true; earlier: StoredQuarter; latest: StoredQuarter | null } | { ok: false; reason: typeof ALREADY_THERE_REASON | typeof NO_EARLIER_READING_REASON; quarter: StoredQuarter | null } {
  const raw = Array.isArray(stored) ? stored.slice(-CROSSOVER_HISTORY_QUARTERS) : [];
  const latestRaw = raw.at(-1), latest = storedQuarters(latestRaw == null ? [] : [latestRaw])[0] ?? null;
  const earlier = storedQuarters(raw.slice(0, -1)).filter(x => x.n >= READ_GROWTH_MIN_BASE);
  const there = [...earlier].reverse().find(x => x.s >= CROSSOVER_FLOOR - 1e-9);
  if (there) return { ok: false, reason: ALREADY_THERE_REASON, quarter: there };
  const last = earlier.at(-1);
  return last ? { ok: true, earlier: last, latest } : { ok: false, reason: NO_EARLIER_READING_REASON, quarter: null };
}
/** A crossover refused by its sector's own history: the story id, the reason, and the quarter (share and homepages read) that refuses it. */
export type NotNew = { id: string; reason: typeof ALREADY_THERE_REASON | typeof NO_EARLIER_READING_REASON; quarter: { q: string; share: number; read: number } | null };
/** The sector rows that pass every row check of a crossover (lead, floors, the earlier run, like with like); only these need their stored
 *  quarters, so the story build reads quarters for these rows alone (forecast-rows.server.ts `forecastRowQuarters`). */
function crossoverPairs(ctx: Ctx) {
  const out: { key: string; lead: SignalRow; r: SignalRow; was: SignalRow | null; before: number; comparable: boolean }[] = [];
  if (!ctx.pair) return out;
  const prev = ctx.pair.earlier, cur = ctx.pair.latest, bySignal = new Map<string, SignalRow[]>();
  for (const r of cur.rows) if (r.scope !== "all" && r.status === "ok" && r.current_share != null && shown(ctx, rowKey(r))) bySignal.set(rowKey(r), [...(bySignal.get(rowKey(r)) ?? []), r]);
  for (const [key, rows] of bySignal) {
    const lead = [...rows].sort((a, b) => b.current_share! - a.current_share! || a.scope.localeCompare(b.scope))[0]!;
    if (lead.current_share! < CROSSOVER_LEAD_MIN) continue;
    for (const r of rows) {
      if (r.scope === lead.scope) continue;
      if (!ctx.row(prev, key)) continue; // the signal did not exist in the earlier run
      const was = ctx.row(prev, key, r.scope), before = was?.current_share;
      if (before == null || before >= CROSSOVER_FLOOR || r.current_share! < CROSSOVER_FLOOR) continue;
      out.push({ key, lead, r, was, before, comparable: readComparable(was, r) });
    }
  }
  return out;
}
/** The rows (run, signal, sector) whose stored quarters the crossover rule reads. */
export const crossoverQuarterNeeds = (ctx: Ctx): { run: number; key: string; scope: string }[] =>
  ctx.pair ? crossoverPairs(ctx).filter(p => p.comparable).map(p => ({ run: ctx.pair!.latest.id, key: p.key, scope: p.r.scope })) : [];
const steadyRefusal = (id: string, u: Unsteady): NotSteady => ({ id, field: u.field, scope: u.scope, changed: u.changed, both: u.both, reason: notSteadyReason(u.changed, u.both) });
/** W3a · the (AI field, scope) pairs whose steadiness the build must read: crossovers passing every row check, and stage changes. */
export function steadyNeeds(ctx: Ctx): { field: AiField; scope: string }[] {
  if (!ctx.pair) return [];
  const prev = ctx.pair.earlier, out = new Map<string, { field: AiField; scope: string }>();
  const add = (key: string, scope: string) => { const f = key.split(":")[0]!; if (isAiField(f)) out.set(unsteadyKey(f, scope), { field: f, scope }); };
  for (const p of crossoverPairs(ctx)) if (p.comparable) add(p.key, p.r.scope);
  for (const r of ctx.pair.latest.rows) { const key = rowKey(r); if (r.scope !== "all" || !ctx.headline.has(key)) continue; const was = ctx.row(prev, key); if (was && stageName(was.stage) && stageName(r.stage) && stageName(was.stage) !== stageName(r.stage)) add(key, "all"); }
  return [...out.values()].sort((a, b) => a.field.localeCompare(b.field) || a.scope.localeCompare(b.scope));
}
export function crossoverCandidates(ctx: Ctx, refused?: ReadGrowth[], notNew?: NotNew[], notSteady?: NotSteady[]): Candidate[] {
  const out: Candidate[] = [];
  if (!ctx.pair) return out;
  const prev = ctx.pair.earlier, cur = ctx.pair.latest;
  for (const { key, lead, r, was, comparable } of crossoverPairs(ctx)) {
    const d = ctx.showing(key, r.scope); if (!d.length) continue;
    const id = `crossover:${key}:${r.scope}:${cur.id}`;
    // P2 · a share that "rose" because the sector's homepages read rose (12 → 28) is not a crossover.
    if (!comparable) { refused?.push(growth(id, prev, cur, was, r)); continue; }
    // W3a · nor a share whose AI-read field changed on more than a quarter of the sector's homepages read in both runs.
    const u = ctx.unsteadyOf(key, r.scope);
    if (u) { notSteady?.push(steadyRefusal(id, u)); continue; }
    // P2b · nor is a share that was already over the floor in a well-read earlier quarter of the later run's own history.
    const h = sectorHistory(r.quarters);
    if (!h.ok) { notNew?.push({ id, reason: h.reason, quarter: h.quarter ? { q: h.quarter.q, share: h.quarter.s, read: h.quarter.n } : null }); continue; }
    const l = label(key), s = inline(sectorName(r.scope)), from = `${pct(h.earlier.s, 1)} in ${quarterName(h.earlier.q)}`;
    out.push({ id, type: "crossover", kicker: `Crossover · ${l.dimension} · ${sectorName(r.scope)}`, headline: `${l.name} reaches ${s}`,
      deck: `Led by ${inline(sectorName(lead.scope))} at ${pct(lead.current_share, 1)}, it now sits on ${pct(r.current_share, 1)} of ${s} homepages, up from ${from}.`,
      facts: [
        { text: `${sectorName(lead.scope)}: ${pct(lead.current_share, 1)} of homepages (the leading sector)`, href: signalPath(key), basis: basis(key), kind: "share" },
        { text: `${sectorName(r.scope)}: ${pct(h.earlier.s, 1)} of ${h.earlier.n} homepages read in ${quarterName(h.earlier.q)} → ${pct(r.current_share, 1)}${h.latest ? ` of ${h.latest.n} in ${quarterName(h.latest.q)}` : ""} (forecast run ${cur.id})`, href: signalPath(key), basis: basis(key), kind: "share" },
        brandFact(d, d.length, r.scope, key),
      ],
      sector: r.scope, signalKeys: [key], domains: d.slice(0, 6), evidence: [{ label: "Signal page", href: signalPath(key) }], sourceIds: [`run:${prev.id}`, `run:${cur.id}`],
      basis: basis(key), happenedAt: cur.at, magnitude: (r.current_share! - CROSSOVER_FLOOR) * 100, runId: cur.id, stage: r.stage });
  }
  return out;
}

// COUNTER-MOVE -------------------------------------------------------------------------------------
const RISING = new Set(["Rising", "Emerging"]);
export function counterMoveCandidates(ctx: Ctx, moves: { c: Candidate; e: EventRow }[]): Candidate[] {
  const out: Candidate[] = [];
  for (const { c, e } of moves) {
    const { gained, dropped } = traitDelta(e);
    const hit = [...gained.map(k => ({ k, adopt: true })), ...dropped.map(k => ({ k, adopt: false }))].find(({ k, adopt }) => {
      if (!shown(ctx, k)) return false; const st = stageName(ctx.stageFor(k, e.sector ?? null).stage);
      return adopt ? st === "Fading" : !!st && RISING.has(st);
    });
    if (!hit) continue;
    const { stage, scope } = ctx.stageFor(hit.k, e.sector ?? null), st = stageName(stage)!, l = label(hit.k), w = scope === "all" ? "across all sectors" : `in ${inline(sectorName(scope))}`;
    out.push({ id: `counter:${e.id}:${hit.k}`, type: "counter_move", kicker: `Counter-move${e.sector ? ` · ${sectorName(e.sector)}` : ""}`,
      headline: hit.adopt ? `${e.domain} adopts ${inline(l.name)} while it fades ${w}` : `${e.domain} drops ${inline(l.name)} while it is ${st.toLowerCase()} ${w}`,
      deck: `${c.headline}${c.deck ? `: ${c.deck}` : "."}`,
      facts: [...c.facts, { text: `${l.name} is ${st} ${w}`, href: signalPath(hit.k), basis: basis(hit.k), kind: "stage" }],
      sector: e.sector ?? null, signalKeys: [hit.k], domains: [e.domain], evidence: [...c.evidence, { label: "Signal page", href: signalPath(hit.k) }],
      sourceIds: [`event:${e.id}`, `story:${c.id}`], basis: c.basis === "ai" || basis(hit.k) === "ai" ? "ai" : "measured", happenedAt: e.detected_at, magnitude: 1, members: [c.id], stage });
  }
  return out;
}

// WHITE SPACE --------------------------------------------------------------------------------------
/** A weekly story's time: the start of its ISO week (Monday 00:00 UTC), or the forecast run behind it when that came later. */
export const weekOpen = (now: string, runAt: string) => { const d = new Date(now), monday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return new Date(Math.max(monday, Date.parse(runAt) || 0)).toISOString(); };
/** U2b · a white space judged on the run's own sample: the sector row's latest-quarter count and base, and the share of every other
 *  sector's homepages in the same quarter (library-wide count minus the sector's). Null when either sample is missing, the quarters
 *  differ, or the gap misses WHITE_SPACE_MAX_SHARE / WHITE_SPACE_MIN_ELSEWHERE. Pure, exported for tests. */
export function whiteSpaceGap(all: SampleRow | null | undefined, sec: SampleRow | null | undefined): { k: number; n: number; elsewhere: number } | null {
  const a = runBase(all), b = runBase(sec);
  if (!a || !b || sampleQuarter(all) !== sampleQuarter(sec) || a.base <= b.base) return null;
  const elsewhere = Math.max(0, a.count - b.count) / (a.base - b.base);
  return b.count / b.base <= WHITE_SPACE_MAX_SHARE && elsewhere >= WHITE_SPACE_MIN_ELSEWHERE ? { k: b.count, n: b.base, elsewhere } : null;
}
/** A white space's words from its run numbers: the headline (wording follows the count), the deck and the two count lines. Pure; the
 *  candidate and the U2b recheck of stored stories share it. */
export function whiteSpaceText(key: string, sector: string, g: { k: number; n: number; elsewhere: number }, stage: string): { headline: string; deck: string; counts: Fact[] } {
  const l = label(key), s = inline(sectorName(sector)), read = basis(key) === "ai" ? "with an AI read" : "in the latest quarter", show = g.k === 1 ? "shows" : "show";
  return {
    headline: whiteSpaceHeadline({ count: g.k, base: g.n, sector: s, signal: inline(l.name), stage: stage.toLowerCase() }),
    deck: `${countWord(g.k)} of ${g.n} tracked ${s} homepages ${read} ${show} it, against ${pct(g.elsewhere, 0)} of homepages in other sectors.`,
    counts: [
      { text: `${g.k} of ${g.n} tracked ${s} homepages ${read} ${show} it`, href: `/patterns/${encodeURIComponent(key)}?sector=${sector}`, basis: basis(key), kind: "count" },
      { text: `${pct(g.elsewhere, 0)} of homepages in other sectors show it`, href: patternPath(key), basis: basis(key), kind: "share" },
    ],
  };
}
export function whiteSpaceCandidates(ctx: Ctx): Candidate[] {
  if (!ctx.cur) return [];
  const out: Candidate[] = [], week = isoWeek(new Date(ctx.now));
  for (const [sector, list] of [...ctx.bySector].sort(([a], [b]) => a.localeCompare(b))) {
    if (list.length < WHITE_SPACE_MIN_SECTOR_SITES || !ctx.covered(sector)) continue;
    // U2b · one count per claim: the sector's count and base and the share elsewhere come from the forecast run's latest-quarter sample
    // (the sample that gives the signal its stage), not from current site traits, and the thresholds are judged on those numbers.
    // A gap that could not be filled (WHITE_SPACE_NOT_APPLICABLE) is refused: no media brand will add product screenshots.
    const opts = [...ctx.headline].filter(key => !WHITE_SPACE_SKIP_CATEGORIES.has(category(key)) && !WHITE_SPACE_NOT_APPLICABLE[sector]?.[key]).flatMap(key => {
      const r = ctx.row(ctx.cur, key), st = stageName(r?.stage);
      if (r?.status !== "ok" || !st || !RISING.has(st)) return [];
      const g = whiteSpaceGap(r, ctx.row(ctx.cur, key, sector)); if (!g) return [];
      return [{ key, ...g, st, momentum: r.momentum ?? 0 }];
    }).sort((a, b) => b.elsewhere - a.elsewhere || b.momentum - a.momentum || a.key.localeCompare(b.key));
    const best = opts[0]; if (!best) continue;
    const l = label(best.key), s = inline(sectorName(sector)), ex = ctx.showing(best.key).filter(d => !list.some(x => x.domain === d));
    const t = whiteSpaceText(best.key, sector, best, best.st);
    out.push({ id: `white:${sector}:${week}`, type: "white_space", kicker: `White space · ${sectorName(sector)}`,
      headline: t.headline, deck: t.deck,
      facts: [
        ...t.counts,
        { text: `${l.name} is ${best.st} across all sectors (forecast run ${ctx.cur.id})`, href: signalPath(best.key), basis: basis(best.key), kind: "stage" },
        ...(ex.length ? [{ text: `Using it elsewhere: ${listOf(ex.slice(0, 4), 4)}`, href: patternPath(best.key), basis: basis(best.key), kind: "brand" as const }] : []),
      ],
      sector, signalKeys: [best.key], domains: ex.slice(0, 4), evidence: [{ label: "Signal page", href: signalPath(best.key) }, { label: "Pattern", href: patternPath(best.key) }],
      sourceIds: [`run:${ctx.cur.id}`, `week:${week}`], basis: basis(best.key), happenedAt: weekOpen(ctx.now, ctx.cur.at), magnitude: (best.elsewhere - best.k / best.n) * 100, runId: ctx.cur.id, stage: ctx.row(ctx.cur, best.key)?.stage ?? null });
  }
  return out;
}

// NEWS + LAUNCH ------------------------------------------------------------------------------------
export type NewsMatcher = { brands: { domain: string; domainRe: RegExp; names: RegExp[]; aliases: RegExp[] }[]; signals: { key: string; name: string; re: RegExp }[] };
const bound = (s: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(s)}(?![\\p{L}\\p{N}])`, "iu");
const boundAll = (s: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(s)}(?![\\p{L}\\p{N}])`, "giu");
/** I3 · 0.2 — tracked brands match by whole name, alias or domain. A name that is an ordinary word (NEWS_NAME_STOPWORDS) needs the domain
 *  or an alias in the item; a name inside a longer capitalised name ("Mother Design") is a different name unless that name is an alias.
 *  Headline signals match by label. */
export function newsMatcher(sites: { domain: string; name: string | null }[], headline: Iterable<string>): NewsMatcher {
  return {
    brands: sites.map(s => {
      const names = new Set([s.name, s.domain.split(".")[0]].filter((x): x is string => !!x && x.length >= NEWS_NAME_MIN && !NEWS_NAME_STOPWORDS.has(x.toLowerCase())));
      return { domain: s.domain, domainRe: new RegExp(`(?<![\\p{L}\\p{N}.-])${escape(s.domain)}(?![\\p{L}\\p{N}-])`, "iu"), names: [...names].map(boundAll), aliases: (NEWS_ALIASES[s.domain] ?? []).map(bound) };
    }),
    signals: [...headline].map(key => ({ key, name: label(key).name })).filter(x => x.name.length >= NEWS_SIGNAL_MIN).map(x => ({ ...x, re: bound(x.name) })),
  };
}
/** Links, @handles and bare hosts ("webflow.sysdig.com", "instagram.com") are not names: they are removed before a title is matched. */
export const titleWithoutHosts = (t: string) => t.replace(/https?:\/\/\S+/giu, " ").replace(/(?<![\p{L}\p{N}])@[\p{L}\p{N}_.-]+/gu, " ").replace(/(?<![\p{L}\p{N}@])[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.[a-z]{2,24}(?![\p{L}\p{N}])/giu, " ");
/** A title in title case says nothing about where names end (every word is capitalised). */
export const titleCase = (t: string) => { const ws = t.split(/\s+/).filter(w => /^\p{L}{4,}/u.test(w)); return ws.length >= 3 && ws.filter(w => /^\p{Lu}/u.test(w)).length / ws.length >= 0.7; };
const CAP_WORD = /^\s+(\p{Lu}[\p{L}\p{N}&'’-]*)/u, CAP_BEFORE = /[\p{L}\p{N},;)'’]\s+(\p{Lu}[\p{L}\p{N}&'’-]*)\s+$/u; // a capitalised word that does not open the sentence
/** Each place a name stands in a text: alone, or as part of a longer capitalised name (with that name). */
export function nameUses(re: RegExp, text: string): { longer: string | null }[] {
  const out: { longer: string | null }[] = [];
  for (const m of text.matchAll(new RegExp(re.source, "giu"))) {
    const i = m.index ?? 0, end = i + m[0].length, next = CAP_WORD.exec(text.slice(end)), prevText = text.slice(0, i);
    const prev = CAP_BEFORE.exec(prevText);
    out.push({ longer: next ? `${m[0]} ${next[1]}` : prev ? `${prev[1]} ${m[0]}` : null });
  }
  return out;
}
/** Brands and signals an item names: names in the title (by name; hosts removed), aliases and domains in the title or excerpt. */
export function newsMatches(m: NewsMatcher, title: string, excerpt: string | null = null) {
  const t = titleWithoutHosts(title), ex = excerpt ? titleWithoutHosts(excerpt) : "", tc = titleCase(t), both = `${title}\n${excerpt ?? ""}`;
  const named = (b: NewsMatcher["brands"][number]) => {
    if (b.domainRe.test(both) || b.aliases.some(r => r.test(both))) return true;
    return b.names.some(r => {
      const inTitle = nameUses(r, t);
      if (!inTitle.length) return false;
      // Title case hides where a name ends: the excerpt decides when it names the brand; otherwise the title is taken at its word.
      const uses = tc ? (nameUses(r, ex).length ? nameUses(r, ex) : inTitle.map(() => ({ longer: null }))) : inTitle;
      return uses.some(u => u.longer == null);
    });
  };
  return { domains: m.brands.filter(named).map(b => b.domain).sort(), signals: m.signals.filter(s => s.re.test(t)).map(s => s.key).sort() };
}
/** The longer capitalised name an item uses instead of the tracked brand's name ("Mother Design"), for the retirement note; else null. */
export function longerNameOf(m: NewsMatcher, domain: string, title: string, excerpt: string | null, name?: string | null): string | null {
  const b = m.brands.find(x => x.domain === domain); if (!b) return null;
  const re = [...(name ? [bound(name)] : []), ...b.names, bound(domain.split(".")[0]!)];
  for (const r of re) for (const text of [excerpt ? titleWithoutHosts(excerpt) : "", titleWithoutHosts(title)]) { const u = nameUses(r, text).find(x => x.longer); if (u) return u.longer; }
  return null;
}
const SUBJECT_RES = NEWS_SUBJECT_TERMS.map(t => new RegExp(`(?<![\\p{L}\\p{N}])${escape(t).replace(/ /g, "\\s+")}(?![\\p{L}\\p{N}])`, "iu"));
/** The first design subject term in a text, or null. */
export const newsSubject = (text: string) => { const i = SUBJECT_RES.findIndex(r => r.test(text)); return i < 0 ? null : NEWS_SUBJECT_TERMS[i]!; };
/** RSS sign-off lines ("The post … appeared first on X.") name the publisher, not the story. */
export const NEWS_BOILERPLATE = /\s*The post .*? appeared first on .*$/is;
const hostOf = (u: string) => { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; } };
export type NewsDrops = Record<NewsDropReason, number>;
/** Why one outside item would not run, or null when it becomes a candidate (with the brands and signals its title names). */
export function newsVerdict(m: NewsMatcher, w: Pick<WireIn, "title" | "url" | "source" | "source_kind" | "excerpt">): { drop: NewsDropReason } | { drop: null; domains: string[]; signals: string[]; excerpt: string | null; title: string } {
  if (w.source_kind === "bluesky") return { drop: "bluesky" };
  const title = untick(w.title), excerpt = w.source_kind === "rss" && w.excerpt ? untick(w.excerpt).replace(NEWS_BOILERPLATE, "").trim() || null : null;
  const host = hostOf(w.url), found = newsMatches(m, title, excerpt);
  // A publication naming itself is not news about that brand (designboom's feed always says "designboom").
  const domains = found.domains.filter(d => !(host === d || host.endsWith(`.${d}`) || w.source.toLowerCase().replace(/\s+/g, "") === d.split(".")[0]));
  if (!domains.length && !found.signals.length) return { drop: "no_name" };
  if (!newsSubject(`${title}\n${excerpt ?? ""}`)) return { drop: "no_subject" };
  // I3 · 0.2: the item must say something about how a named brand looks, sounds or is built: a design term in the same sentence as it.
  if (domains.length && !found.signals.length && !claimAbout(m, domains, title, excerpt)) return { drop: "no_subject" };
  return { drop: null, domains, signals: found.signals, excerpt, title };
}
const sentences = (t: string) => t.split(/(?<=[.!?])\s+|\n+/u).map(x => x.trim()).filter(Boolean);
/** A brand named as the tool something was made in ("Figma designs", "Webflow templates") is not the subject of the sentence. */
const AS_TOOL = /(\p{Lu}[\p{L}\p{N}.]*)\s+(?:designs?|files?|plugins?|templates?|prototypes?|mockups?|integrations?|api|sdk|accounts?|community|users?|workflows?|boards?)(?![\p{L}\p{N}])/gu;
/** True when a sentence of the title or excerpt names one of these brands as its subject (not as a tool) and carries a design term. */
export function claimAbout(m: NewsMatcher, domains: string[], title: string, excerpt: string | null): boolean {
  return [title, ...sentences(excerpt ?? "")].some(sn => { const own = sn.replace(AS_TOOL, " "); return !!newsSubject(own) && newsMatches(m, own, own).domains.some(d => domains.includes(d)); });
}
export function newsCandidates(m: NewsMatcher, wire: WireIn[]): { candidates: Candidate[]; dropped: number; drops: NewsDrops } {
  const out: Candidate[] = [], drops: NewsDrops = { bluesky: 0, no_name: 0, no_subject: 0 };
  for (const w of wire) {
    const v = newsVerdict(m, w);
    if (v.drop) { drops[v.drop]++; continue; }
    const hit = { domains: v.domains, signals: v.signals }, title = v.title, excerpt = v.excerpt;
    const names = [...hit.domains, ...hit.signals.map(k => label(k).name)];
    out.push({ id: `news:${w.id}`, type: "news", kicker: `News · ${w.source}`, headline: clip(title, 160), deck: excerpt ? clip(excerpt, 180) : `Names ${listOf(names, 4)}.`,
      facts: [{ text: `Source: ${w.source}, ${shortDate(w.published_at)}`, href: w.url, basis: null, kind: "source" },
        // I3 · 0.2: the item itself (title and excerpt, verbatim) is what the writer reports; Read lists never show these lines.
        { text: `Item title: “${title}”`, href: w.url, basis: null, kind: "line" as const },
        ...(excerpt ? [{ text: `Item excerpt: “${clip(excerpt, 600)}”`, href: w.url, basis: null, kind: "line" as const }] : []),
        ...hit.domains.map(d => ({ text: `Names ${d}, a tracked brand`, href: brandPath(d), basis: null, kind: "brand" as const })),
        ...hit.signals.map(k => ({ text: `Mentions ${label(k).name}, a headline signal`, href: signalPath(k), basis: basis(k) }))],
      sector: null, signalKeys: hit.signals, domains: hit.domains, evidence: [{ label: `Read at ${w.source}`, href: w.url }], sourceIds: [`wire:${w.id}`], basis: null,
      happenedAt: w.published_at, magnitude: hit.domains.length + hit.signals.length });
  }
  return { candidates: out, dropped: drops.bluesky + drops.no_name + drops.no_subject, drops };
}
export function launchCandidate(w: WireIn & { votes?: number | null }): Candidate {
  // PH1 · the deck is the finished day's vote count ("412 upvotes"), which the launch box reads.
  return { id: `launch:${w.id}`, type: "launch", kicker: "Launch · Product Hunt", headline: clip(untick(w.title), 160), deck: w.votes != null ? `${w.votes} upvotes` : w.excerpt ? clip(untick(w.excerpt), 180) : null,
    facts: [{ text: `Product Hunt, ${shortDate(w.published_at)}`, href: w.url, basis: null, kind: "source" }], sector: null, signalKeys: [], domains: [],
    evidence: [{ label: "Product Hunt", href: w.url }], sourceIds: [`wire:${w.id}`], basis: null, happenedAt: w.published_at, magnitude: 1 };
}

/** Every candidate for one build (E2a, editor.ts): the tiers, grouping and weekly gatherings live there. */
export { allCandidates } from "./editor";
export const soWhatFor = (c: Pick<Candidate, "type" | "signalKeys" | "stage">) => STORY_TYPE_DEFS[c.type].soWhat;
