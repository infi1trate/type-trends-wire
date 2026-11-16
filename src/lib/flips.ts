// Back-and-forth runs on one field (A → B → A …) within FLIP_DAYS: a homepage that rotates something (a hero that alternates image and
// video) rather than a run of separate decisions. Display only: stored events, stories and scoring are untouched. Pure.
import { dayText } from "./data-stories/text";

export const FLIP_DAYS = 14;
const DAY = 864e5;
export type FlipIn = { id: string; field: string; before: string; after: string; at: string };
export type FlipRun = { field: string; a: string; b: string; ids: string[]; count: number; since: string; last: string };
const same = (x: string, y: string) => x.toLowerCase() === y.toLowerCase();

/** Runs of at least two consecutive changes on one field that swap the same two values back and forth, first to last within FLIP_DAYS. */
export function flipRuns(evs: readonly FlipIn[], days = FLIP_DAYS): FlipRun[] {
  const byField = new Map<string, FlipIn[]>();
  for (const e of evs) byField.set(e.field, [...(byField.get(e.field) ?? []), e]);
  const out: FlipRun[] = [];
  for (const [field, list] of byField) {
    const xs = [...list].sort((p, q) => p.at.localeCompare(q.at) || p.id.localeCompare(q.id));
    let i = 0;
    while (i < xs.length) {
      let j = i;
      while (j + 1 < xs.length && same(xs[j + 1]!.before, xs[j]!.after) && same(xs[j + 1]!.after, xs[j]!.before) && Date.parse(xs[j + 1]!.at) - Date.parse(xs[i]!.at) <= days * DAY) j++;
      if (j > i) out.push({ field, a: xs[i]!.before, b: xs[i]!.after, ids: xs.slice(i, j + 1).map(e => e.id), count: j - i + 1, since: xs[i]!.at, last: xs[j]!.at });
      i = j + 1;
    }
  }
  return out.sort((p, q) => q.last.localeCompare(p.last));
}
const words = (v: string) => v.replace(/_/g, " ");
const dayMonth = (iso: string) => dayText(iso).replace(/ \d{4}$/, "");
/** "Hero media has switched between image and video 3 times since 11 Nov; the homepage likely rotates it." */
export function flipSentence(r: FlipRun, fieldName: string): string {
  const f = fieldName.replace(/^./, c => c.toUpperCase());
  return `${f} has switched between ${words(r.a)} and ${words(r.b)} ${r.count} times since ${dayMonth(r.since)}; the homepage likely rotates it.`;
}
