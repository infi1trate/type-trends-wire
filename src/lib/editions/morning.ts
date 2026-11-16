// THE MORNING LINE: the daily edition, built deterministically from stored stories (no AI per view). Pure.
// Permanence: an edition for UTC day D reads only what was known when D ended — stories that happened before the cut and were stored
// before max(cut, MORNING_BASELINE), edits and late why-lines from before that moment — so once D is over it never changes.
import { overlay, type EditRow, type StoredStory } from "../stories/edits";
import { withNumbers, type NumberRow } from "../stories/numbers";
import { isKind, soWhatOf, storyPath, streamOf, type StoryRecord } from "../stories/view";
import { sectorName } from "../labels";
import { isoWeek, longDate } from "../digest/week";
import type { CardModel } from "../chart/card";

/** The first edition (the stored 30-day story backfill makes earlier days thin). */
export const MORNING_FIRST_DAY = "2026-11-11";
/** The backfill and the Phase 14b retirement pass were stored by this moment; what was stored before it counts as known for every earlier day. */
export const MORNING_BASELINE = "2026-11-16T04:00:00Z";
export const MORNING_WINDOW_HOURS = 24;
/** Lead plus up to this many more stories. */
export const MORNING_MORE = 5;
/** Fewer published stories than this and the edition says so and shows the last full one below it. */
export const MORNING_MIN_STORIES = 3;
/** The opening: the best WHITE SPACE story of the last OPENING_DAYS days not used in the previous OPENING_ROTATION editions. */
export const OPENING_DAYS = 7;
export const OPENING_ROTATION = 3;
export const DESK_MAX = 3;
/** How far back "the last full edition" is looked for. */
export const LAST_FULL_LOOKBACK_DAYS = 30;
export const RSS_EDITIONS = 14;

const DAY = 864e5, HOUR = 36e5;
export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const todayOf = (now: number) => new Date(now).toISOString().slice(0, 10);
const dayStart = (day: string) => Date.parse(`${day}T00:00:00Z`);
export const cutOf = (day: string) => dayStart(day) + DAY;
const addDays = (day: string, n: number) => new Date(dayStart(day) + n * DAY).toISOString().slice(0, 10);
/** A valid edition day: a real date between the first edition and today. */
export function isEditionDay(day: string, now: number): boolean {
  if (!DAY_RE.test(day) || !Number.isFinite(dayStart(day)) || new Date(dayStart(day)).toISOString().slice(0, 10) !== day) return false;
  return day >= MORNING_FIRST_DAY && day <= todayOf(now);
}

export type LineRow = { story_id: string; why_line: string; why_model: string; why_at: string };
export type MorningRaw = { stories: StoredStory[]; edits: EditRow[]; lines: LineRow[]; numbers?: NumberRow[] };
export type ChartRow = { week: string; trait: string; created_at: string; model: CardModel };
export type MovingInput = { pair: { latest: { id: number; at: string }; earlier: { id: number; at: string }; days: number } | null; items: { key: string; name: string; dimension: string; from: string; to: string; share: number | null }[] };

/** The moment an edition reads up to (end of its day, or now for today) and what it may know (stored before max(cut, baseline), never after now). */
export function editionClock(day: string, now: number) {
  const cut = cutOf(day), asOf = Math.min(cut, now), known = Math.min(Math.max(cut, Date.parse(MORNING_BASELINE)), now);
  return { cut, asOf, known, final: now >= cut };
}
/** Stories as they stood for an edition: only rows, why-lines and edits known by then, the overlay evaluated at the edition's moment. */
export function shownFor(raw: MorningRaw, day: string, now: number): StoryRecord[] {
  const { asOf, known } = editionClock(day, now);
  return shownAsOf(raw, asOf, known);
}
/** Stories that happened before `asOf` and were stored (with why-lines and edits) before `known`, overlaid at `asOf`. */
export function shownAsOf(raw: MorningRaw, asOf: number, known: number): StoryRecord[] {
  const stories = raw.stories.filter(s => Date.parse(s.happened_at) < asOf && Date.parse(s.created_at) < known);
  const lines = new Map(raw.lines.filter(l => Date.parse(l.why_at) < known).map(l => [l.story_id, l]));
  const withLines = stories.map(s => { const l = s.why_line ? null : lines.get(s.id); return l ? { ...s, why_line: l.why_line, why_model: l.why_model, why_at: l.why_at } : s; });
  return withNumbers(overlay(withLines, raw.edits.filter(e => Date.parse(e.at) < known), asOf), raw.numbers ?? []);
}

export type MorningItem = { id: string; number: number | null; type: string; kicker: string; headline: string; deck: string | null; at: string; sector: string | null; sectorName: string | null; score: number; why: { text: string; basis: "ai" | "measured" }; href: string };
const item = (s: StoryRecord): MorningItem => ({
  id: s.id, number: s.number ?? null, type: s.type, kicker: s.kicker, headline: s.headline, deck: s.deck, at: s.happened_at, sector: s.sector, sectorName: s.sector ? sectorName(s.sector) : null, score: s.score,
  why: s.why_line ? { text: s.why_line, basis: "ai" } : { text: soWhatOf({ type: isKind(s.type) ? s.type : "news", signalKeys: s.signal_keys, stage: null }), basis: "measured" },
  href: storyPath(s.id),
});
const byScore = (a: StoryRecord, b: StoryRecord) => b.score - a.score || b.happened_at.localeCompare(a.happened_at) || a.id.localeCompare(b.id);

/** The day's ranked stories: published, not folded, no launches, in the 24 hours before the edition's moment, by score. */
export function rankedFor(shown: StoryRecord[], asOf: number): StoryRecord[] {
  const from = asOf - MORNING_WINDOW_HOURS * HOUR;
  return streamOf(shown).filter(s => s.type !== "launch" && Date.parse(s.happened_at) >= from && Date.parse(s.happened_at) < asOf).sort(byScore);
}
/** The opening for one edition, given the openings used by the previous editions (newest first). */
export function openingFor(shown: StoryRecord[], asOf: number, usedBefore: string[], exclude: Set<string>): StoryRecord | null {
  const from = asOf - OPENING_DAYS * DAY, recent = new Set(usedBefore.slice(0, OPENING_ROTATION));
  return streamOf(shown).filter(s => s.type === "white_space" && Date.parse(s.happened_at) >= from && Date.parse(s.happened_at) < asOf && !recent.has(s.id) && !exclude.has(s.id)).sort(byScore)[0] ?? null;
}
/** Openings for every edition from MORNING_FIRST_DAY through `day`, oldest first (the rotation is a chain, so it is replayed from the start). */
export function openingChain(raw: MorningRaw, day: string, now: number): Map<string, string | null> {
  const out = new Map<string, string | null>(), used: string[] = [];
  for (let d = MORNING_FIRST_DAY; d <= day; d = addDays(d, 1)) {
    const shown = shownFor(raw, d, now), { asOf } = editionClock(d, now), ranked = rankedFor(shown, asOf);
    const top = new Set(ranked.slice(0, MORNING_MORE + 1).map(s => s.id)), o = openingFor(shown, asOf, used, top);
    out.set(d, o?.id ?? null);
    if (o) used.unshift(o.id);
  }
  return out;
}

export type MorningEdition = ReturnType<typeof morningEdition>;
/** One edition. `moving` is the gap-rule comparison among real runs before the edition's moment; `charts` the stored Charts of the Week. */
export function morningEdition(raw: MorningRaw, day: string, now: number, o: { moving: MovingInput; charts: ChartRow[]; withLastFull?: boolean }) {
  const clock = editionClock(day, now), shown = shownFor(raw, day, now), ranked = rankedFor(shown, clock.asOf);
  const lead = ranked[0] ?? null, more = ranked.slice(1, 1 + MORNING_MORE);
  const chain = openingChain(raw, day, now), openingId = chain.get(day) ?? null, opening = openingId ? shown.find(s => s.id === openingId) ?? null : null;
  // When no opening is left because the week's white-space stories already lead or run in today's list, say so.
  const top = new Set([lead, ...more].filter(Boolean).map(s => s!.id));
  const openingInList = !opening && !!openingFor(shown, clock.asOf, [], new Set()) && streamOf(shown).filter(s => s.type === "white_space" && Date.parse(s.happened_at) >= clock.asOf - OPENING_DAYS * DAY && Date.parse(s.happened_at) < clock.asOf).some(s => top.has(s.id));
  const from = clock.asOf - MORNING_WINDOW_HOURS * HOUR;
  const desk = shown.filter(s => s.state === "held" && Date.parse(s.happened_at) >= from && Date.parse(s.happened_at) < clock.asOf).sort(byScore).slice(0, DESK_MAX)
    .map(s => ({ id: s.id, headline: s.headline, score: s.score, reason: s.reason, href: storyPath(s.id) }));
  const week = isoWeek(new Date(clock.asOf - 1));
  const chart = [...o.charts].filter(c => Date.parse(c.created_at) < clock.known && c.week <= week).sort((a, b) => b.week.localeCompare(a.week))[0] ?? null;
  const thin = ranked.length < MORNING_MIN_STORIES;
  let lastFull: { day: string; title: string; lead: MorningItem; more: MorningItem[]; href: string } | null = null;
  if (thin && o.withLastFull !== false) {
    for (let d = addDays(day, -1), i = 0; d >= MORNING_FIRST_DAY && i < LAST_FULL_LOOKBACK_DAYS; d = addDays(d, -1), i++) {
      const c = editionClock(d, now), r = rankedFor(shownFor(raw, d, now), c.asOf);
      if (r.length >= MORNING_MIN_STORIES) { lastFull = { day: d, title: titleOf(d), lead: item(r[0]!), more: r.slice(1, 1 + MORNING_MORE).map(item), href: morningPath(d) }; break; }
    }
  }
  return {
    day, title: titleOf(day), href: morningPath(day), final: clock.final, as_of: new Date(clock.asOf).toISOString(), window: { from: new Date(from).toISOString(), to: new Date(clock.asOf).toISOString() },
    count: ranked.length, thin, lead: lead ? item(lead) : null, more: more.map(item),
    moving: o.moving, opening: opening ? item(opening) : null, openingInList,
    figure: chart ? { kind: "chart" as const, week: chart.week, trait: chart.trait, model: chart.model, href: `/chart/${chart.week}` } : lead?.signal_keys[0] ? { kind: "signal" as const, key: lead.signal_keys[0], href: `/signals/${encodeURIComponent(lead.signal_keys[0])}` } : null,
    desk, lastFull,
  };
}
export const morningPath = (day: string) => `/morning/${day}`;
export const titleOf = (day: string) => `The Morning Line · ${longDate(day)}`;

/** The archive: every edition day with at least one story, newest first. */
export function morningArchive(raw: MorningRaw, now: number) {
  const out: { day: string; title: string; count: number; lead: string | null; leadNumber: number | null; final: boolean; href: string }[] = [];
  for (let d = todayOf(now); d >= MORNING_FIRST_DAY; d = addDays(d, -1)) {
    const c = editionClock(d, now), r = rankedFor(shownFor(raw, d, now), c.asOf);
    if (r.length) out.push({ day: d, title: titleOf(d), count: r.length, lead: r[0]!.headline, leadNumber: r[0]!.number ?? null, final: c.final, href: morningPath(d) });
  }
  return out;
}
