// E4 · THE SAME TRUTH RULES AS STORIES — what a study may count from measured homepage changes (library_events). Pure, and built only from
// the story engine's own rules, never a second copy of them:
//   1. The carousel rule (carousel.ts): on a rotating first screen (a capture's own flag, or the inherited one for earlier live captures)
//      the headline, hero, palette, accent, imagery and style are one slide, so those fields leave the change (`withoutRotations`).
//   2. The studio rule (carousel.ts): on studio homepages the palette, accent and hero follow the featured work (`withoutShowcase`).
//   3. Integrity (integrity.ts): a live-crawl change counts only with the part that passed two-before, two-after, one-transition
//      (`splitChecked`); when verdicts can't be read no live change counts (fail closed). Archive (Wayback) changes are kept as they are.
// A change with nothing left is not counted at all.
import { carouselEventIds, isShowcaseSector, withoutRotations, withoutShowcase } from "../carousel";
import { splitChecked, type Check } from "../integrity";
import type { EventRow } from "./series";

export type RawEvent = EventRow & { before?: unknown; after?: unknown; prev_snapshot_id?: number | null };
export type TruthIn = {
  /** Snapshot ids on a carousel (carouselSnapshots: own flag, or inherited for live captures). */
  carousel: ReadonlySet<number>;
  /** Newest integrity verdict per live change; null when they could not be read. */
  checks: ReadonlyMap<number, Check> | null;
  sectorOf: (domain: string) => string | null;
};
export function truthEvents<E extends RawEvent>(events: readonly E[], o: TruthIn): E[] {
  const judged = withoutRotations(events, carouselEventIds(events, o.carousel));
  const shown = judged.flatMap(e => { if (!isShowcaseSector(o.sectorOf(e.domain))) return [e]; const k = withoutShowcase(e); return k ? [k] : []; });
  if (!o.checks) return shown.filter(e => e.source !== "live");
  return splitChecked(shown, o.checks).tape.map(e => { const seen = (e as E & { seen?: { before: string; after: string } }).seen; return seen ? { ...e, seen } : e; });
}
