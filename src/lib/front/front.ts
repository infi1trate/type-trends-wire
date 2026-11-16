// THE FRONT PAGE MODEL (/): one pure function from stored stories, signals and editions to everything the page shows. No I/O, no AI.
// The page renders this model and nothing else; /front.json serves its changeable parts. Every item shows when it happened: nothing is
// restamped to look new (an item's `at` is always its stored time).
import { isKind, soWhatOf, storyPath, streamOf, type StoryRecord } from "../stories/view";
import { lensScore } from "../stories/score";
import { STORY_TYPE_DEFS } from "../stories/types";
import { label, sectorName, type StageName } from "../labels";
import { SECTORS } from "../library";
import type { LensResult } from "../sector-lens";
import type { Signal } from "../signals";
import type { Crop } from "../crops";
import { isoWeek, longDate } from "../digest/week";
import { NO_COMPARISON_TEXT } from "../run-gap";
import { storyFormat, shows, surfaceShows, type Format, type FormatFilter } from "./formats";
import { chartOfDay, type ChartInput } from "./chart-day";

const MIN = 6e4, HOUR = 36e5, DAY = 864e5;

// PAGE STATE ---------------------------------------------------------------------------------------
/** BUSY: at least this many stories in the last BUSY_HOURS. QUIET: none in the last QUIET_HOURS. STEADY otherwise. */
export const BUSY_MIN_STORIES = 3, BUSY_HOURS = 6, QUIET_HOURS = 24;
/** The live column covers the last week; older stories live in the Morning Line archive and the Digest. */
export const COLUMN_DAYS = 7, COLUMN_MAX = 40;
export type PageState = "busy" | "steady" | "quiet";
const within = (iso: string, now: number, ms: number) => { const d = now - Date.parse(iso); return d < ms; };
export function pageState(times: string[], now: number): PageState {
  if (times.filter(t => within(t, now, BUSY_HOURS * HOUR)).length >= BUSY_MIN_STORIES) return "busy";
  return times.some(t => within(t, now, QUIET_HOURS * HOUR)) ? "steady" : "quiet";
}

// ITEMS --------------------------------------------------------------------------------------------
export type FrontStory = {
  id: string; number: number | null; type: string; typeName: string; kicker: string; headline: string; line: string | null;
  basis: "measured" | "ai" | null; at: string; href: string; format: Format; sector: string | null; sectorName: string | null; score: number; corrected: string | null;
};
type Numbered = StoryRecord & { number?: number | null };
const oneLine = (s: string | null | undefined, n = 180) => { if (!s) return null; const t = s.trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
export function toFront(s: Numbered): FrontStory {
  const type = isKind(s.type) ? s.type : "news";
  return { id: s.id, number: s.state === "published" ? s.number ?? null : null, type, typeName: STORY_TYPE_DEFS[type].kicker, kicker: s.kicker, headline: s.headline, line: oneLine(s.deck),
    basis: s.basis === "measured" || s.basis === "ai" ? s.basis : null, at: s.happened_at, href: storyPath(s.id), format: storyFormat(type), sector: s.sector, sectorName: s.sector ? sectorName(s.sector) : null,
    score: s.score, corrected: s.correctedAt };
}
/** "just now", "12 min ago", "3 h ago", "2 days ago". Never in the future: a clock ahead of the server reads as just now. */
export function relTime(iso: string, now: number): string {
  const d = Math.max(0, now - Date.parse(iso));
  if (d < MIN) return "just now";
  if (d < HOUR) return `${Math.floor(d / MIN)} min ago`;
  if (d < DAY) return `${Math.floor(d / HOUR)} h ago`;
  const n = Math.floor(d / DAY); return n === 1 ? "1 day ago" : `${n} days ago`;
}

// LEAD ---------------------------------------------------------------------------------------------
/** Lead windows in order; the label says which one the lead came from. Past the week, the most recent story leads with its date. */
export const LEAD_WINDOWS = [{ hours: 24, label: "Today" }, { hours: 72, label: "This week" }, { hours: 24 * 7, label: "This week" }] as const;
export type LeadLabel = "Today" | "This week" | "Latest story" | "Pinned by the editor";
export function pickLead(ranked: StoryRecord[], sector: string, now: number): { story: StoryRecord; label: LeadLabel } | null {
  const pinned = ranked.filter(s => s.pinnedUntil).sort((a, b) => (b.edits.at(-1)?.at ?? "").localeCompare(a.edits.at(-1)?.at ?? ""))[0];
  if (pinned) return { story: pinned, label: "Pinned by the editor" };
  const best = (xs: StoryRecord[]) => [...xs].sort((a, b) => lensScore(b, sector) - lensScore(a, sector) || b.happened_at.localeCompare(a.happened_at) || a.id.localeCompare(b.id))[0];
  for (const w of LEAD_WINDOWS) { const s = best(ranked.filter(x => within(x.happened_at, now, w.hours * HOUR))); if (s) return { story: s, label: w.label }; }
  const latest = [...ranked].sort((a, b) => b.happened_at.localeCompare(a.happened_at))[0];
  return latest ? { story: latest, label: "Latest story" } : null;
}
export type LeadEvidence =
  | { kind: "crops"; section: string; before: Crop; after: Crop }
  | { kind: "spark"; key: string; name: string; points: number[]; quarters?: string[] | undefined };

// LIVE COLUMN --------------------------------------------------------------------------------------
export const TIME_GROUPS = [{ id: "hour", title: "Last hour" }, { id: "today", title: "Today" }, { id: "yesterday", title: "Yesterday" }, { id: "week", title: "Earlier this week" }] as const;
export type GroupId = (typeof TIME_GROUPS)[number]["id"];
const utcDay = (t: number) => new Date(t).toISOString().slice(0, 10);
/** Which heading an item sits under, by its stored time (UTC days); null when older than the column's week. */
export function groupOf(iso: string, now: number): GroupId | null {
  const t = Date.parse(iso), d = now - t;
  if (d >= COLUMN_DAYS * DAY) return null;
  if (d < HOUR) return "hour";
  const day = utcDay(t);
  if (day >= utcDay(now)) return "today";
  if (day === utcDay(now - DAY)) return "yesterday";
  return "week";
}
export type ColumnGroup = { id: GroupId; title: string; items: FrontStory[] };
/** Headings in order, newest first inside each; under a sector lens that sector's stories come first in each group. QUIET puts the whole week under "Earlier this week". */
export function groupColumn(items: FrontStory[], now: number, o: { sector: string; quiet: boolean }): ColumnGroup[] {
  const by = new Map<GroupId, FrontStory[]>();
  for (const it of [...items].sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id))) {
    const g = groupOf(it.at, now); if (!g) continue;
    const id = o.quiet ? "week" : g; by.set(id, [...(by.get(id) ?? []), it]);
  }
  return TIME_GROUPS.filter(g => by.has(g.id)).map(g => {
    const xs = by.get(g.id)!, first = o.sector !== "all" ? [...xs.filter(x => x.sector === o.sector), ...xs.filter(x => x.sector !== o.sector)] : xs;
    return { id: g.id, title: g.title, items: first };
  });
}

// FROM THE ARCHIVE (QUIET only) --------------------------------------------------------------------
export const ARCHIVE_MAX = 4;
export type ArchiveMove = { id: string; at: string; headline: string; line: string | null; href: string; source: "live" | "archive" };
export type ArchiveItem = { kind: "story" | "move"; id: string; at: string; date: string; headline: string; line: string | null; href: string; number: number | null; match: string };
const weekOfQuarter = (t: number) => { const d = new Date(t), q0 = Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3, 1); return Math.floor((t - q0) / (7 * DAY)); };
const quarterOf = (t: number) => { const d = new Date(t); return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`; };
/** "Same week in 2025" (same ISO week number, an earlier year) or "Same week of Q3 2026" (same week of an earlier quarter); else null. */
export function sameWeekMatch(iso: string, now: number): string | null {
  const t = Date.parse(iso); if (!(t < now)) return null;
  const [y, w] = isoWeek(new Date(t)).split("-W"), [ny, nw] = isoWeek(new Date(now)).split("-W");
  if (w === nw && Number(y) < Number(ny)) return `Same week in ${y}`;
  if (quarterOf(t) !== quarterOf(now) && weekOfQuarter(t) === weekOfQuarter(now)) return `Same week of ${quarterOf(t)}`;
  return null;
}
/** A published story or a dated brand move from the same week of an earlier year or quarter, with its real date. Stories first, then the most recent. */
export function archiveFill(stories: Numbered[], moves: ArchiveMove[], now: number, max = ARCHIVE_MAX): ArchiveItem[] {
  const old = (iso: string) => now - Date.parse(iso) >= COLUMN_DAYS * DAY;
  const fromStories = stories.filter(s => old(s.happened_at)).flatMap(s => { const m = sameWeekMatch(s.happened_at, now); return m ? [{ kind: "story" as const, id: s.id, at: s.happened_at, date: longDate(s.happened_at), headline: s.headline, line: oneLine(s.deck), href: storyPath(s.id), number: s.state === "published" ? s.number ?? null : null, match: m }] : []; });
  const fromMoves = moves.filter(m => old(m.at)).flatMap(m => { const x = sameWeekMatch(m.at, now); return x ? [{ kind: "move" as const, id: m.id, at: m.at, date: longDate(m.at), headline: m.headline, line: m.line, href: m.href, number: null, match: m.source === "archive" ? `${x} · from the web archive` : x }] : []; });
  const byNew = (a: ArchiveItem, b: ArchiveItem) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id);
  return [...fromStories.sort(byNew), ...fromMoves.sort(byNew)].slice(0, max);
}

// SECTOR STRIP -------------------------------------------------------------------------------------
export type SectorStrip =
  | { kind: "pick"; sectors: { id: string; name: string }[] }
  | { kind: "sector"; sector: string; name: string; scope: string; note: string | null; signals: { key: string; name: string; stage: StageName | null; share: number | null; href: string }[]; newest: FrontStory | null; whiteSpace: FrontStory | null; report: string };
export function sectorStrip(sector: string, lens: LensResult | null, stream: Numbered[]): SectorStrip {
  if (sector === "all" || !lens) return { kind: "pick", sectors: SECTORS.map(s => ({ id: s, name: sectorName(s) })) };
  const top = lens.signals.filter(s => s.tier === "headline").sort((a, b) => (b.momentum_index ?? -1) - (a.momentum_index ?? -1) || (b.share ?? 0) - (a.share ?? 0) || a.key.localeCompare(b.key)).slice(0, 2);
  const mine = stream.filter(s => s.sector === sector && s.type !== "launch");
  const ws = mine.find(s => s.type === "white_space");
  return { kind: "sector", sector, name: sectorName(sector), scope: lens.scope, note: lens.note,
    signals: top.map(s => ({ key: s.key, name: s.name, stage: s.stage, share: s.share, href: `/signals/${encodeURIComponent(s.key)}` })),
    newest: mine[0] ? toFront(mine[0]) : null, whiteSpace: ws ? toFront(ws) : null, report: `/sectors/${sector}` };
}

// TICKER, MOVING NOW, EDITIONS, EXPLORE --------------------------------------------------------------
export const TICKER_MAX = 12;
export type TickerItem = { key: string; name: string; share: number | null; direction: "up" | "down" | "flat"; href: string };
export function tickerOf(signals: Signal[]): TickerItem[] {
  return signals.filter(s => s.tier === "headline" && s.share != null).sort((a, b) => (b.momentum_index ?? -1) - (a.momentum_index ?? -1) || a.key.localeCompare(b.key)).slice(0, TICKER_MAX)
    .map(s => ({ key: s.key, name: s.name, share: s.share, direction: s.direction === "Rising" || s.direction === "Rising fast" ? "up" : s.direction === "Falling" ? "down" : "flat", href: `/signals/${encodeURIComponent(s.key)}` }));
}
export type MovingItem = { key: string; name: string; dimension: string; basis: string; from: string | null; to: string | null; share: number | null; momentum_index: number | null; href: string };
export type MovingIn = { items: MovingItem[]; pair: { latest: { id: number; at: string }; earlier: { id: number; at: string }; days: number } | null; next: { earliest: string; expected: string } | null };
const dm = (iso: string) => { const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso); return `${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getUTCDay()]} ${d.getUTCDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()]}`; };
/** One plain line when there is nothing to show: when the first valid comparison is expected, or that nothing changed stage. */
export function movingLine(m: MovingIn): string | null {
  if (m.items.length) return null;
  if (m.pair) return `No headline signal changed stage between run ${m.pair.earlier.id} and run ${m.pair.latest.id}.`;
  return m.next ? `No week-over-week comparison yet. The first one is expected with the weekly forecast on ${dm(m.next.expected)}.` : NO_COMPARISON_TEXT;
}
export type EditionsIn = { morning: { day: string; title: string; href: string; count: number } | null; digest: { week: string; number: number; dates: string; href: string } | null; sectors: { at: string | null; count: number } | null };
export type EditionLine = { id: "morning-line" | "digest" | "sector-reports"; title: string; date: string; href: string; format: Format };
export function editionLines(e: EditionsIn, filter: FormatFilter): EditionLine[] {
  const out: EditionLine[] = [];
  if (e.morning) out.push({ id: "morning-line", title: `${e.morning.title}${e.morning.count ? ` · ${e.morning.count} ${e.morning.count === 1 ? "story" : "stories"}` : ""}`, date: e.morning.day, href: e.morning.href, format: "updating" });
  if (e.digest) out.push({ id: "digest", title: `The Digest No. ${e.digest.number}`, date: e.digest.dates, href: e.digest.href, format: "read" });
  if (e.sectors) out.push({ id: "sector-reports", title: `Sector reports · ${e.sectors.count} sectors, updated with each weekly forecast`, date: e.sectors.at ? longDate(e.sectors.at) : "Not updated yet", href: "/sectors", format: "updating" });
  return out.filter(l => shows(filter, l.format));
}
export const EXPLORE_MAX = 8;
export type ExploreItem = { kind: "brand" | "pattern"; key: string; name: string; href: string; at: string; via: string };
/** Brand and pattern pages behind this week's stories, newest story first, each page once. */
export function exploreOf(stream: Numbered[], now: number, patternKeys: Set<string>, names: Map<string, string | null>): ExploreItem[] {
  const out: ExploreItem[] = [], seen = new Set<string>();
  for (const s of stream) {
    if (!within(s.happened_at, now, COLUMN_DAYS * DAY) || s.type === "launch") continue;
    for (const d of s.domains) if (!seen.has(`b:${d}`)) { seen.add(`b:${d}`); out.push({ kind: "brand", key: d, name: names.get(d) ?? d, href: `/brands/${encodeURIComponent(d)}`, at: s.happened_at, via: s.headline }); }
    for (const k of s.signal_keys) if (patternKeys.has(k) && !seen.has(`p:${k}`)) { seen.add(`p:${k}`); out.push({ kind: "pattern", key: k, name: label(k).name, href: `/patterns/${encodeURIComponent(k)}`, at: s.happened_at, via: s.headline }); }
  }
  return out.slice(0, EXPLORE_MAX);
}
export const FRONT_FOOTER = [
  { label: "What makes a story", href: "/what-we-show#ed-w-story" },
  { label: "What we show and why", href: "/what-we-show" },
  { label: "Status", href: "/status" },
  { label: "Removal policy", href: "/what-we-show#ed-w-images" },
] as const;

// THE MODEL ----------------------------------------------------------------------------------------
export type FrontInput = {
  now: number; sector: string; format: FormatFilter;
  stories: Numbered[];
  signals: Signal[]; lens: LensResult | null; stages: Map<string, StageName | null>;
  moving: MovingIn; freshness: { text: string; late: boolean } | null;
  leadEvidence: { id: string; crops: { section: string; before: Crop; after: Crop } | null } | null; series: Record<string, number[]>;
  /** Quarter labels for each series point (the lead's figure dates its number), when the loader has them. */
  seriesQuarters?: Record<string, string[]>;
  chart: Omit<ChartInput, "day" | "stories">;
  editions: EditionsIn; archiveMoves: ArchiveMove[]; patternKeys: Set<string>; brandNames: Map<string, string | null>;
  /** Live data stories (registry status); the shelf is absent when there are none. */
  dataStories?: DataShelfItem[];
};
export type DataShelfItem = { slug: string; number: number; question: string; href: string };
export function frontModel(i: FrontInput) {
  const stream = streamOf(i.stories) as Numbered[], ranked = stream.filter(s => s.type !== "launch");
  const state = pageState(ranked.map(s => s.happened_at), i.now);
  const inFormat = ranked.filter(s => shows(i.format, storyFormat(s.type)));
  const picked = pickLead(inFormat, i.sector, i.now);
  let lead = null as null | { story: FrontStory; label: LeadLabel; why: { text: string; basis: "ai" | "measured" } | null; evidence: LeadEvidence | null };
  if (picked) {
    const s = picked.story as Numbered, type = isKind(s.type) ? s.type : "news", key = s.signal_keys[0];
    const whyText = s.why_line ?? soWhatOf({ type, signalKeys: s.signal_keys, stage: key ? i.stages.get(key) ?? null : null });
    const crops = i.leadEvidence?.id === s.id ? i.leadEvidence.crops : null, pts = key ? i.series[key] ?? [] : [];
    lead = { story: toFront(s), label: state === "quiet" && picked.label === "Today" ? "This week" : picked.label, why: whyText ? { text: whyText, basis: s.why_line ? "ai" : "measured" } : null,
      evidence: crops ? { kind: "crops", ...crops } : key && pts.length >= 1 ? { kind: "spark", key, name: label(key).name, points: pts, ...(i.seriesQuarters?.[key]?.length === pts.length ? { quarters: i.seriesQuarters[key] } : {}) } : null };
  }
  const items = inFormat.filter(s => s.id !== picked?.story.id && groupOf(s.happened_at, i.now) !== null).slice(0, COLUMN_MAX).map(toFront);
  const quiet = state === "quiet";
  const archive = quiet && shows(i.format, "live") ? archiveFill(ranked, i.archiveMoves, i.now) : [];
  const dayStart = Date.parse(`${utcDay(i.now)}T00:00:00Z`);
  const chart = surfaceShows(i.format, "chart-of-the-day") ? chartOfDay({ ...i.chart, day: utcDay(i.now), stories: ranked.filter(s => Date.parse(s.happened_at) < dayStart && Date.parse(s.happened_at) >= dayStart - COLUMN_DAYS * DAY).map(s => ({ type: s.type })) }) : null;
  const launches = surfaceShows(i.format, "new-on-the-scene") ? stream.filter(s => s.type === "launch").slice(0, 6).map(toFront) : [];
  const explore = shows(i.format, "explore") ? exploreOf(stream, i.now, i.patternKeys, i.brandNames) : [];
  const editions = editionLines(i.editions, i.format);
  const movingShown = surfaceShows(i.format, "moving-now");
  const strip = surfaceShows(i.format, "your-sector") ? sectorStrip(i.sector, i.lens, stream) : null;
  const dataStories = surfaceShows(i.format, "data-stories") ? (i.dataStories ?? []) : [];
  return {
    now: new Date(i.now).toISOString(), today: utcDay(i.now), sector: i.sector, format: i.format, state,
    ticker: tickerOf(i.signals), freshness: i.freshness,
    lead,
    moving: movingShown ? { items: i.moving.items, line: movingLine(i.moving), comparison: i.moving.pair ? `Between forecast run ${i.moving.pair.earlier.id} and run ${i.moving.pair.latest.id}, ${i.moving.pair.days} days apart, across all sectors.` : null } : null,
    column: { items, quiet, groups: groupColumn(items, i.now, { sector: i.sector, quiet }) },
    archive, chart, launches, strip, editions, explore, dataStories, footer: FRONT_FOOTER,
    /** Which sections render. Absent sections are left out of the page, never shown empty. */
    sections: { lead: !!lead, moving: movingShown, chart: !!chart, launches: launches.length > 0, strip: !!strip, editions: editions.length > 0, explore: explore.length > 0, archive: archive.length > 0, dataStories: dataStories.length > 0 },
  };
}
export type FrontModel = ReturnType<typeof frontModel>;
/** The parts /front.json serves (everything that changes between polls). */
export const updatesOf = (m: FrontModel) => ({ now: m.now, state: m.state, lead: m.lead ? { id: m.lead.story.id, label: m.lead.label } : null, items: m.column.items, moving: m.moving, freshness: m.freshness });
export type FrontUpdates = ReturnType<typeof updatesOf>;

// THE LEAD'S FIGURE ---------------------------------------------------------------------------------
/** What the lead plate's evidence slot shows for a signal: the one number (Figure type) with its unit and date, the trail when
 * there are at least two measured quarters (it ends at that number), and the coverage caption pinned to the bottom. */
export type LeadFigure = { value: string; unit: string; date: string | null; trail: { x: string; y: number }[] | null; caption: string; key: string; name: string };
export const LEAD_COVERAGE = "Well-covered quarters only (15+ sites, 25% coverage), all sectors.";
const qLabel = (q: string) => { const m = /^(\d{4})-?Q([1-4])$/.exec(q); return m ? `Q${m[2]} ${m[1]}` : q; };
export function leadFigure(e: LeadEvidence | null): LeadFigure | null {
  if (!e || e.kind !== "spark" || !e.points.length) return null;
  const last = e.points[e.points.length - 1]!, q = e.quarters?.[e.quarters.length - 1] ?? null;
  const trail = e.points.length >= 2 ? e.points.map((y, i) => ({ x: e.quarters?.[i] ?? `p${i + 1}`, y })) : null;
  return { value: `${(last * 100).toFixed(1)}%`, unit: "of tracked homepages", date: q ? qLabel(q) : null, trail, caption: LEAD_COVERAGE, key: e.key, name: e.name };
}
