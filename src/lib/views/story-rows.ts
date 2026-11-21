// U1 Part 3 · EVERY DATA ROW LEADS BACK — a row about something a published story reports shows that story ("No. 88 →"). One batched
// read gives the published stories with what they are about; this pure lookup answers per row with no query of its own.
import { storyHref } from "../ia";

/** A published story as the lookup sees it: its number, when it happened, its brands, its main signal and the changes it was built from
 *  (with the two captures either side of each). */
export type StoryIndexRow = { id: string; number: number; happenedAt: string; domains: string[]; mainSignal: string | null; events: number[]; captures: number[] };
/** What a row is about: a brand change (event id), a capture of a brand, a signal or pattern key. */
export type RowRef = { event?: number | null | undefined; events?: readonly number[] | undefined; domain?: string | null | undefined; capture?: number | null | undefined; signal?: string | null | undefined };
export type StoryLinkOut = { id: string; number: number; href: string; text: string };
export type StoryLookup = { byEvent: Map<number, StoryIndexRow>; byCapture: Map<string, StoryIndexRow>; bySignal: Map<string, StoryIndexRow> };

const newer = (a: StoryIndexRow, b: StoryIndexRow | undefined) => !b || a.happenedAt > b.happenedAt || (a.happenedAt === b.happenedAt && a.number > b.number);
/** Builds the lookup once per table. A change or capture reported by more than one story points at the newest; a signal at the newest
 *  story whose main signal it is. */
export function storyLookup(rows: readonly StoryIndexRow[]): StoryLookup {
  const byEvent = new Map<number, StoryIndexRow>(), byCapture = new Map<string, StoryIndexRow>(), bySignal = new Map<string, StoryIndexRow>();
  for (const r of rows) {
    for (const e of r.events) if (newer(r, byEvent.get(e))) byEvent.set(e, r);
    for (const d of r.domains) for (const c of r.captures) { const k = `${d}:${c}`; if (newer(r, byCapture.get(k))) byCapture.set(k, r); }
    if (r.mainSignal && newer(r, bySignal.get(r.mainSignal))) bySignal.set(r.mainSignal, r);
  }
  return { byEvent, byCapture, bySignal };
}
const out = (r: StoryIndexRow): StoryLinkOut => ({ id: r.id, number: r.number, href: storyHref(r.id), text: `No. ${r.number} →` });
/** The published story a data row leads back to, or null. A change is matched by its id; a capture by brand and capture id; a signal or
 *  pattern by the newest story whose main signal it is. */
export function storyForRow(lookup: StoryLookup, row: RowRef): StoryLinkOut | null {
  if (row.event != null) { const r = lookup.byEvent.get(row.event); if (r) return out(r); }
  for (const e of row.events ?? []) { const r = lookup.byEvent.get(e); if (r) return out(r); }
  if (row.capture != null && row.domain) { const r = lookup.byCapture.get(`${row.domain}:${row.capture}`); if (r) return out(r); }
  if (row.signal) { const r = lookup.bySignal.get(row.signal); if (r) return out(r); }
  return null;
}
