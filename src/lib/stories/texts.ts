// The writer's text on the Read side (E2b): the latest checked version of a story's written text replaces its headline and deck wherever
// stories are read; the template headline and deck stay on the record for the Data view and the desk. A correction newer than the
// latest version shows the corrected template until the next version is written. Pure; rows come from story_texts (checked only).
import { howWeKnow, shareBaseFailures, textOf } from "./writer";
import { storedCaptureDates } from "./capture-dates";
import { CENSUS_HOW, SALE_KEY, censusKeyOf } from "../census";

export type TextRow = { story_id: string; version: number; headline: string; deck: string; body: string[]; how_we_know: string; model: string; created_at: string };
export type Written = { headline: string; deck: string; body: string[]; howWeKnow: string; model: string; version: number; at: string };
type Overlaid = { id: string; headline: string; deck: string | null; correctedAt: string | null };
/** Latest checked version per story. */
export function latestTexts(rows: TextRow[]): Map<string, TextRow> {
  const out = new Map<string, TextRow>();
  // E2c: a version that puts a share beside a base it was not counted on is never shown (the story reads as its template until rewritten).
  for (const r of rows.filter(x => !shareBaseFailures(textOf(x)).length)) { const cur = out.get(r.story_id); if (!cur || r.version > cur.version) out.set(r.story_id, r); }
  return out;
}
export function withTexts<S extends Overlaid>(stories: S[], rows: TextRow[]): (S & { written: Written | null; template: { headline: string; deck: string | null } })[] {
  const by = latestTexts(rows);
  return stories.map(s => {
    const t = by.get(s.id), template = { headline: s.headline, deck: s.deck };
    if (!t || (s.correctedAt && s.correctedAt > t.created_at)) return { ...s, written: null, template };
    return { ...s, headline: t.headline, deck: t.deck, written: { headline: t.headline, deck: t.deck, body: t.body ?? [], howWeKnow: t.how_we_know, model: t.model, version: t.version, at: t.created_at }, template };
  });
}
/** The how-we-know line a story shows: a census always says how it is read (E3: the newest capture and one at least six hours older), even
 *  over a written version stored with older wording; any other story, its written line, else the one built from its basis and dates. */
export function storyHowWeKnow(s: { id?: string; type: string; basis: string | null; kicker: string; happened_at: string; facts: unknown; deck?: string | null; written?: Written | null }): string {
  const census = s.id ? censusKeyOf(s.id) : null;
  if (census) return census === SALE_KEY ? CENSUS_HOW.sale : CENSUS_HOW.words;
  return s.written?.howWeKnow ?? howWeKnowOf(s);
}
/** The how-we-know line for a story without a written text: from its basis, its kicker (news) and the dates on its change lines. */
export function howWeKnowOf(s: { id?: string; type: string; basis: string | null; kicker: string; happened_at: string; facts: unknown; deck?: string | null }): string {
  if (s.type === "news") return howWeKnow({ dates: [], ourRead: false, measured: false, news: s.kicker.split(" · ").slice(1).join(" · ") || "outside news" });
  // E2g: a census is read from what the pages say now.
  const census = s.id ? censusKeyOf(s.id) : null;
  if (census) return census === SALE_KEY ? CENSUS_HOW.sale : CENSUS_HOW.words;
  const facts = Array.isArray(s.facts) ? (s.facts as { text?: unknown; basis?: unknown; kind?: unknown }[]) : [];
  // E2g: the change lines carry when each change happened by its captures; W1d: so does a quiet change's "Changed between …" line, and
  // the deck's "between … and …" when no line does. Those dates are the line, never the day the story ran or the change was confirmed.
  const stated = storedCaptureDates(s), dates = new Set<string>(stated.length ? stated : [s.happened_at.slice(0, 10)]);
  const ourRead = s.basis === "ai" || facts.some(f => f.basis === "ai"), measured = s.basis === "measured" || facts.some(f => f.basis === "measured");
  return howWeKnow({ dates: [...dates], ourRead, measured: measured || !ourRead });
}
