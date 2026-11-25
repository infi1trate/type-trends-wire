// LATEST CHANGES ON THE FRONT PAGE (E3) — "Every confirmed change, newest first": the eight newest lines in the latest changes (one per brand, change and day, as
// the terminal's tape), each with the brand's icon, name, what changed from and to, and its date or range; then one count line: how many
// changes were confirmed in the last 14 days and how many are still unconfirmed (Seen once or Alternating). Pure: same changes and
// checks in, same block out. A change with no check yet is neither; archive changes are never on it (every public tape is live-only).
import { splitChecked, type Check } from "../integrity";
import { READ_TAPE, readTapeShows, tapeRows, type TapeLabels, type TapeParts } from "../tape";
import type { Pic } from "../pictures";
import type { EventRow } from "../agency/changes";

export const FRONT_TAPE_MAX = 8, FRONT_TAPE_DAYS = 14;
export const FRONT_TAPE_TITLE = "Latest changes", FRONT_TAPE_SUB = "Every confirmed change, newest first";
/** Where the count line and "All changes" go: the terminal's library panel and its Seen once or alternating list. */
export const WHOLE_TAPE_HREF = "/terminal?panel=library", UNCONFIRMED_HREF = "/terminal?panel=library#seen-once";
export type TapeEvent = Pick<EventRow, "id" | "domain" | "type" | "before" | "after" | "page_type" | "summary" | "detected_at"> & { viewport?: string | null; source?: string | null };
/** W1b · an icon or card change carries its old and new pictures as a pair (stored crops-bucket paths, served by /crops/). */
export type TapePair = { kind: "icon" | "card"; before: { src: string; w: number; h: number }; after: { src: string; w: number; h: number }; alt: string };
export type FrontTapeLine = TapeParts & { id: number; domain: string; at: string; href: string; icon: Pic | null; pair?: TapePair };
export type FrontTape = { lines: FrontTapeLine[]; confirmed: number; unconfirmed: number; days: number };

const DAY = 864e5;
/** The confirmed tape rows (newest first) and the unconfirmed count, over the last 14 days of live changes. */
export function confirmedTape<E extends TapeEvent>(events: readonly E[], checks: ReadonlyMap<number, Check>, now: number, labels: (e: E) => TapeLabels = () => ({}), name?: (d: string) => string | null | undefined) {
  const live = events.filter(e => (e.source ?? "live") === "live" && Date.parse(e.detected_at) > now - FRONT_TAPE_DAYS * DAY && Date.parse(e.detected_at) <= now)
    .sort((a, b) => b.detected_at.localeCompare(a.detected_at) || b.id - a.id);
  const split = splitChecked(live, checks);
  // E3b: a colour change whose two colours share a plain name has no line here (the terminal keeps it with both hex values).
  return { rows: tapeRows(split.tape.filter(readTapeShows), labels, name, READ_TAPE), unconfirmed: split.unconfirmed.length };
}
/** The block: the first eight rows as lines (labels already applied), the counts beside them. */
export function frontTape<E extends TapeEvent>(events: readonly E[], checks: ReadonlyMap<number, Check>, o: { now: number; labels?: (e: E) => TapeLabels; icons?: Readonly<Record<string, Pic>>; name?: (d: string) => string | null | undefined }): FrontTape {
  const { rows, unconfirmed } = confirmedTape(events, checks, o.now, o.labels, o.name);
  const lines = rows.slice(0, FRONT_TAPE_MAX).map(r => ({ ...r.parts, id: r.id, domain: r.domain, at: r.detected_at, href: `/brands/${encodeURIComponent(r.domain)}`, icon: o.icons?.[r.domain] ?? null }));
  return { lines, confirmed: rows.length, unconfirmed, days: FRONT_TAPE_DAYS };
}
/** W1b · confirmed icon and card changes join the latest changes like any confirmed change: newest first among the lines, counted with them. */
export function withAssetLines(t: FrontTape, extra: readonly FrontTapeLine[]): FrontTape {
  if (!extra.length) return t;
  const lines = [...t.lines, ...extra].sort((a, b) => b.at.localeCompare(a.at) || b.id - a.id).slice(0, FRONT_TAPE_MAX);
  return { ...t, lines, confirmed: t.confirmed + extra.length };
}
/** "61 changes confirmed in the last 14 days" / "1 change …". */
export const confirmedText = (n: number, days = FRONT_TAPE_DAYS) => `${n} ${n === 1 ? "change" : "changes"} confirmed in the last ${days} days`;
export const unconfirmedText = (n: number) => `${n} still unconfirmed`;
