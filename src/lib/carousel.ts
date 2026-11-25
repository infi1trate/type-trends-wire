// THE CAROUSEL RULE (E2c, widened E2d) — when a homepage's first screen is a rotating hero (a carousel), the headline, hero image, hero
// video and first-screen colours (palette, accent) we capture, and our AI reads of its imagery and style (E2g), belong to one slide of it: a change to them is a rotation, never a move.
// Such changes stay in the latest changes, marked "Carousel" the way seasonal lines are marked "Seasonal", and cannot make or join a story; type
// (fonts) and layout (alignment, grid, button corners) on the same page are judged as before. The crawler reports the carousel as the
// optional boolean `layout.hero_carousel` in a snapshot's signals; a change is on a carousel when either its before or its after snapshot
// says so. A capture from before the flag existed takes the value of the page's nearest later flagged capture (E2f, inheritedCarousel).
// THE STUDIO RULE (E2d) — a studio's first screen shows its newest or featured client work, so on homepages in the studios sector the
// palette, accent, hero image and hero video follow that work, as a media homepage follows its lead story: for those fields a studio is
// treated as an editorial homepage (lines in the latest changes only, with or without the carousel flag; editor.ts applies it). A studio's own type,
// headline and layout changes are judged as before, and roundups gathering studios are unaffected. Decided from the sector. Pure.
export const CAROUSEL_LABEL = "Carousel";
export const CAROUSEL_RULE = "When the first screen is a carousel, a headline, hero image, hero video, palette or accent change, or our AI read of its imagery or style, is one slide replacing another: it stays in the latest changes, marked Carousel, and never makes or joins a story. Type and layout changes on such a page are judged as usual. A capture taken before we recorded carousels takes the answer of the page's next capture that has one.";
/** Sectors whose homepages are showcases of client work (studio rule). */
export const SHOWCASE_SECTORS: ReadonlySet<string> = new Set(["studios"]);
export const SHOWCASE_RULE = "A studio's homepage shows its newest or featured client work, so its palette, accent, hero image and hero video follow that work: those changes stay in the latest changes and never make or join a story. A studio's own typeface, headline and layout changes are judged as usual.";
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
/** AI reads of the first screen that follow the slide: the imagery read (E2c) and the style read, aesthetic (E2g). */
const SLIDE_READS: ReadonlySet<string> = new Set(["imagery_shift", "aesthetic_shift"]);
function touches(e: Pick<Ev, "type" | "before" | "after">, f: Follow): boolean {
  if (SLIDE_READS.has(e.type)) return true;
  if (e.type === "message_pivot") return f.headline;
  if (FIELD_TYPES.has(e.type)) { const s = slideFields(f); return fieldsOf(e).some(k => s.has(k)); }
  return false;
}
function strip<E extends Ev>(e: E, f: Follow): E | null {
  if (SLIDE_READS.has(e.type) || (f.headline && e.type === "message_pivot")) return null;
  if (!FIELD_TYPES.has(e.type)) return e;
  const s = slideFields(f), keep = (v: unknown) => Object.fromEntries(Object.entries(o(v)).filter(([k]) => !s.has(k)));
  const before = keep(e.before), after = keep(e.after);
  return Object.keys({ ...before, ...after }).length ? { ...e, before, after } : null;
}

/** The change touches what a carousel rotates: the headline copy, the hero media, the first-screen colours, or the imagery or style read. */
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

/** Every change with its carousel rotation taken out (`rotating`: carouselEventIds): the story engine's judged set, and the studies' (E4). */
export const withoutRotations = <E extends Ev>(events: readonly E[], rotating: ReadonlySet<number>): E[] =>
  events.flatMap(e => { if (!rotating.has(e.id)) return [e]; const k = withoutRotation(e); return k ? [k] : []; });
/**
 * E4 · the studio rule as a field strip, for counts of changes (the studies): on a showcase homepage the palette, accent and hero media
 * follow the featured work, so those fields are taken out of a change (and the imagery read dropped); its type, headline and layout stay.
 * Null when nothing is left. The story engine applies the same rule through its candidate counts (editor.ts `counts`/`changeOf`).
 */
export const withoutShowcase = <E extends Ev>(e: E): E | null => {
  if (e.type === "imagery_shift") return null;
  if (!FIELD_TYPES.has(e.type)) return e;
  const keep = (v: unknown) => Object.fromEntries(Object.entries(o(v)).filter(([k]) => !SLIDE_FIELDS.has(k)));
  const before = keep(e.before), after = keep(e.after);
  return Object.keys({ ...before, ...after }).length ? { ...e, before, after } : null;
};

/**
 * E2f · the flag belongs to the page. The crawler began sending `hero_carousel` on 20 Nov, so older captures have no key: a capture with
 * no key takes the value of the nearest later capture of the same brand, page and viewport that has it; a capture with the key keeps its
 * own value. Returns the ids (of `captures`) that are on a carousel. `page` is any key naming brand|page|viewport.
 */
export type FlagCapture = { id: number; page: string; at: string; flag: boolean | null };
export function inheritedCarousel(captures: readonly FlagCapture[], keyed: readonly FlagCapture[]): Set<number> {
  const by = new Map<string, FlagCapture[]>();
  for (const k of keyed) if (k.flag !== null) by.set(k.page, [...(by.get(k.page) ?? []), k]);
  for (const xs of by.values()) xs.sort((a, b) => a.at.localeCompare(b.at) || a.id - b.id);
  const out = new Set<number>();
  for (const c of captures) {
    const flag = c.flag !== null ? c.flag : (by.get(c.page) ?? []).find(k => k.at > c.at)?.flag ?? false;
    if (flag) out.add(c.id);
  }
  return out;
}
