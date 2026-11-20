// THE CAROUSEL RULE (E2c) — when a homepage's first screen is a rotating hero (a carousel), the headline, hero image and hero video we
// capture are one slide of it: a change to them is a rotation, never a move. Such changes stay on the tape, marked "Carousel" the way
// seasonal lines are marked "Seasonal", and cannot make or join a story; type, colour and layout changes on the same page are judged as
// before. The crawler reports the carousel as the optional boolean `layout.hero_carousel` in a snapshot's signals; a change is on a
// carousel when either its before or its after snapshot says so. Pure.
export const CAROUSEL_LABEL = "Carousel";
export const CAROUSEL_RULE = "When the first screen is a carousel, a headline, hero image or hero video change is one slide replacing another: it stays on the tape, marked Carousel, and never makes or joins a story. Type, colour and layout changes on such a page are judged as usual.";
/** Layout fields that rotate with a carousel's slides (the headline rotates through message_pivot; the imagery read follows the slide). */
export const ROTATING_LAYOUT_FIELDS = new Set(["hero_media"]);

type Ev = { id: number; type: string; before?: unknown; after?: unknown; snapshot_id?: number | null; prev_snapshot_id?: number | null };
const o = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
/** True when the snapshot's signals say the first screen is a carousel (only an explicit `true` counts). */
export const isCarouselSignals = (signals: unknown) => o(o(signals)["layout"])["hero_carousel"] === true;
/** Either side of the change was captured on a carousel. */
export const onCarousel = (e: Pick<Ev, "snapshot_id" | "prev_snapshot_id">, snaps: ReadonlySet<number>) =>
  (e.snapshot_id != null && snaps.has(e.snapshot_id)) || (e.prev_snapshot_id != null && snaps.has(e.prev_snapshot_id));
/** The change touches what a carousel rotates: the headline copy, the hero media, or the imagery read of the first screen. */
export function touchesRotation(e: Pick<Ev, "type" | "before" | "after">): boolean {
  if (e.type === "message_pivot" || e.type === "imagery_shift") return true;
  if (e.type === "layout_change") return Object.keys({ ...o(e.before), ...o(e.after) }).some(k => ROTATING_LAYOUT_FIELDS.has(k));
  return false;
}
/** Event ids whose change is a carousel rotation (tape label "Carousel"). */
export function carouselEventIds(events: readonly Ev[], snaps: ReadonlySet<number>): Set<number> {
  return new Set(events.filter(e => onCarousel(e, snaps) && touchesRotation(e)).map(e => e.id));
}
/**
 * The part of a carousel change a story may still judge: a headline or imagery change is nothing; a layout change keeps its other fields
 * (headline alignment, grid, button corners) without the hero media. Null when nothing is left.
 */
export function withoutRotation<E extends Ev>(e: E): E | null {
  if (e.type === "message_pivot" || e.type === "imagery_shift") return null;
  if (e.type !== "layout_change") return e;
  const strip = (v: unknown) => Object.fromEntries(Object.entries(o(v)).filter(([k]) => !ROTATING_LAYOUT_FIELDS.has(k)));
  const before = strip(e.before), after = strip(e.after);
  return Object.keys({ ...before, ...after }).length ? { ...e, before, after } : null;
}
