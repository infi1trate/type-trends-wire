// E4 · THE STUDIES HOME — which study leads, the series in order, the "In the works" shelf and the front page's three rows. Pure.
import { DATA_STORIES, SERIES, studyLabel, withheld } from "./registry";
import { addQuarters, quarterOf, qText } from "./text";
import type { CoverTrail } from "./cover";
import type { StoryModel } from "./types";

/** The earliest quarter a study waiting on well-covered quarters could run: the live crawl adds one per calendar quarter, so the gap
 *  closes `need − have` quarters after the current one ("Q3 2027" from Q4 2026 with 5 of 8). */
export function earliestQuarter(o: { have: number; need: number; now: number }): string {
  return addQuarters(quarterOf(new Date(o.now).toISOString()), Math.max(0, o.need - o.have));
}
export type ShelfRow = { key: string; question: string; series: string; wait: string; earliest: string | null; ready: boolean };
/** A registry draft (or a live study whose check stopped passing) on the shelf, with the check's own figures. */
export function draftRow(e: { slug: string; question: string; series: string }, w: { have: number; need: number; text: string; perQuarter: boolean }, now: number): ShelfRow {
  const title = SERIES.find(s => s.id === e.series)?.title ?? "";
  return { key: e.slug, question: e.question, series: title, wait: w.text, earliest: w.perQuarter ? `Earliest: ${qText(earliestQuarter({ have: w.have, need: w.need, now }))}` : null, ready: false };
}
export const CANDIDATE_CAP = 3;
/** "Who moved first" candidates: every headline signal but the one study 2 already tells, run through study 2's adoption check. At most
 *  three, the closest to passing first (a passing one reads "Ready to write."); candidates get no page. */
export function candidateRows(cands: readonly { key: string; name: string; entries: number }[], need: number): ShelfRow[] {
  const title = SERIES.find(s => s.id === "first-movers")!.title;
  return [...cands].sort((a, b) => b.entries - a.entries || a.name.localeCompare(b.name)).slice(0, CANDIDATE_CAP).map(c => ({
    key: `candidate:${c.key}`, question: `${title}: ${c.name}`, series: title, wait: c.entries >= need ? "Ready to write." : `Has ${c.entries} dated adopters, needs ${need}.`, earliest: null, ready: c.entries >= need,
  }));
}
/** The day a study's facts last changed: the day of the first stored version written from its current sheet, else today (nothing written
 *  from it yet). A day, not a time, so studies whose facts changed the same day tie and the lowest number leads. */
export function changedAt(rows: readonly { slug: string; facts_hash: string; created_at: string }[], slug: string, hash: string, now: number): string {
  const at = rows.filter(r => r.slug === slug && r.facts_hash === hash).map(r => r.created_at).sort()[0];
  return (at ?? new Date(now).toISOString()).slice(0, 10);
}
export type HomeStudy = { slug: string; number: number; label: string; series: string; seriesTitle: string; headline: string; deck: string; question: string; dataThrough: string | null; href: string; key: StoryModel["key"]; cover: CoverTrail | null; changedAt: string; written?: boolean };
/** The lead (E5b): a live study with checked written text before one still on fallback text; among those, the one whose facts changed
 *  most recently (ties: the lowest number). A record stored before E5b has no `written`, which reads as fallback for every study. */
export const leadOf = (studies: readonly HomeStudy[]): HomeStudy | null =>
  [...studies].sort((a, b) => Number(!!b.written) - Number(!!a.written) || b.changedAt.localeCompare(a.changedAt) || a.number - b.number)[0] ?? null;
export type HomeSeries = { id: string; title: string; description: string; studies: HomeStudy[] };
export type StudiesHome = { lead: HomeStudy | null; series: HomeSeries[]; shelf: ShelfRow[]; tool: { question: string; line: string; href: string } };
export const TOOL_LINE = "Pick a tracked brand and see where it sits in its sector, and how its homepage has changed.";
/** W3d · a series every one of whose studies is withheld by the editor is not listed (Beyond the homepage while both switches are off). */
const shownSeries = () => SERIES.filter(s => DATA_STORIES.some(e => e.series === s.id && !withheld(e)));
export function studiesHome(live: readonly HomeStudy[], shelf: readonly ShelfRow[]): StudiesHome {
  const sorted = [...live].sort((a, b) => a.number - b.number);
  return { lead: leadOf(sorted), series: shownSeries().map(s => ({ id: s.id, title: s.title, description: s.description, studies: sorted.filter(x => x.series === s.id) })), shelf: [...shelf],
    tool: { question: "Where does your brand sit?", line: TOOL_LINE, href: "/data/where-you-sit" } };
}
/** The front page's Studies list: the lead study first, then the rest by number, at most three. */
/** W3b · a stored home without the studies `out` names (withheld after the record was written): the lead is chosen again from the rest. */
export function homeWithout(h: StudiesHome, out: (slug: string) => boolean): StudiesHome {
  const all = h.series.flatMap(s => s.studies);
  if (!all.some(x => out(x.slug)) && !(h.lead && out(h.lead.slug)) && !h.shelf.some(r => out(r.key))) return h;
  return { ...studiesHome(all.filter(x => !out(x.slug)), h.shelf.filter(r => !out(r.key))), tool: h.tool };
}
export function frontStudies(h: Pick<StudiesHome, "lead" | "series">): { slug: string; number: number; label: string; headline: string; question: string; href: string }[] {
  const all = h.series.flatMap(s => s.studies).sort((a, b) => a.number - b.number), lead = h.lead;
  return [...(lead ? [lead] : []), ...all.filter(x => x.slug !== lead?.slug)].slice(0, 3).map(x => ({ slug: x.slug, number: x.number, label: studyLabel(x.number), headline: x.headline, question: x.question, href: x.href }));
}
