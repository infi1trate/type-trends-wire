// THE CAROUSEL RULE (E2c, widened E2d) — when a homepage's first screen is a rotating hero (a carousel), the headline, hero image, hero
// video and first-screen colours (palette, accent) we capture belong to one slide of it: a change to them is a rotation, never a move.
// Such changes stay on the tape, marked "Carousel" the way seasonal lines are marked "Seasonal", and cannot make or join a story; type
// (fonts) and layout (alignment, grid, button corners) on the same page are judged as before. The crawler reports the carousel as the
// optional boolean `layout.hero_carousel` in a snapshot's signals; a change is on a carousel when either its before or its after snapshot
// says so.
// THE STUDIO RULE (E2d) — a studio's first screen shows its newest or featured client work, so on homepages in the studios sector the
// palette, accent, hero image and hero video follow that work, as a media homepage follows its lead story: for those fields a studio is
// treated as an editorial homepage (tape lines only, with or without the carousel flag; editor.ts applies it). A studio's own type,
// headline and layout changes are judged as before, and roundups gathering studios are unaffected. Decided from the sector. Pure.
export const CAROUSEL_LABEL = "Carousel";
export const CAROUSEL_RULE = "When the first screen is a carousel, a headline, hero image, hero video, palette or accent change is one slide replacing another: it stays on the tape, marked Carousel, and never makes or joins a story. Type and layout changes on such a page are judged as usual.";
/** Sectors whose homepages are showcases of client work (studio rule). */
export const SHOWCASE_SECTORS: ReadonlySet<string> = new Set(["studios"]);
export const SHOWCASE_RULE = "A studio's homepage shows its newest or featured client work, so its palette, accent, hero image and hero video follow that work: those changes stay on the tape and never make or join a story. A studio's own typeface, headline and layout changes are judged as usual.";
/** Fields that follow the slide (carousel) or the featured work (studio): hero media and first-screen colours. */
export const SLIDE_FIELDS: ReadonlySet<string> = new Set(["hero_media", "palette", "accent"]);
/** Kept for callers of the E2c name: the layout fields that rotate with a slide. */
export const ROTATING_LAYOUT_FIELDS: ReadonlySet<string> = new Set(["hero_media"]);
/** Event types whose before/after fields are stripped field by field (the rest of the change is still judged). */
const FIELD_TYPES = new Set(["layout_change", "palette_shift", "redesign"]);

type Ev = { id: number; type: string; before?: unknown; after?: unknown; snapshot_id?: number | null; prev_snapshot_id?: number | null };
const o = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const fieldsOf = (e: Pick<Ev, "before" | "after">) => Object.keys({ ...o(e.before), ...o(e.after) });
/** True when the snapshot's signals say the first screen is a carousel (only an explicit `true` counts). */
export const isCarouselSignals = (signals: unknown) => o(o(signals)["layout"])["hero_carousel"] === true;
/** Either side of the change was captured on a carousel. */
export const onCarousel = (e: Pick<Ev, "snapshot_id" | "prev_snapshot_id">, snaps: ReadonlySet<number>) =>
  (e.snapshot_id != null && snaps.has(e.snapshot_id)) || (e.prev_snapshot_id != null && snaps.has(e.prev_snapshot_id));
/** A showcase homepage (studio rule), from the sector. */
export const isShowcaseSector = (sector: string | null | undefined) => !!sector && SHOWCASE_SECTORS.has(sector);

/** What follows the slide: `headline` true for a carousel (the headline is one slide's). */
type Follow = { headline: boolean };
const CAROUSEL: Follow = { headline: true };
const slideFields = (f: Follow) => (f.headline ? new Set([...SLIDE_FIELDS, "headline"]) : SLIDE_FIELDS);
function touches(e: Pick<Ev, "type" | "before" | "after">, f: Follow): boolean {
  if (e.type === "imagery_shift") return true;
  if (e.type === "message_pivot") return f.headline;
  if (FIELD_TYPES.has(e.type)) { const s = slideFields(f); return fieldsOf(e).some(k => s.has(k)); }
  return false;
}
function strip<E extends Ev>(e: E, f: Follow): E | null {
  if (e.type === "imagery_shift" || (f.headline && e.type === "message_pivot")) return null;
  if (!FIELD_TYPES.has(e.type)) return e;
  const s = slideFields(f), keep = (v: unknown) => Object.fromEntries(Object.entries(o(v)).filter(([k]) => !s.has(k)));
  const before = keep(e.before), after = keep(e.after);
  return Object.keys({ ...before, ...after }).length ? { ...e, before, after } : null;
}

/** The change touches what a carousel rotates: the headline copy, the hero media, the first-screen colours, or the imagery read. */
export const touchesRotation = (e: Pick<Ev, "type" | "before" | "after">) => touches(e, CAROUSEL);
/** Event ids whose change is a carousel rotation (tape label "Carousel"). */
export function carouselEventIds(events: readonly Ev[], snaps: ReadonlySet<number>): Set<number> {
  return new Set(events.filter(e => onCarousel(e, snaps) && touchesRotation(e)).map(e => e.id));
}
/**
 * The part of a carousel change a story may still judge: a headline or imagery change is nothing; a palette, layout or redesign change
 * keeps its other fields (fonts, headline alignment, grid, button corners) without the hero media and colours. Null when nothing is left.
 */
export const withoutRotation = <E extends Ev>(e: E): E | null => strip(e, CAROUSEL);
