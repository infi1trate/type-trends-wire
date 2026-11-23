// C1b Part 1 · the one picture a page paints largest, announced in the first bytes. Pure: no I/O.
// The browser found Today's lead picture only once the whole document had arrived (its <img> and React's preload sat ~110 KB in, inside
// a late block). Each page that leads with a picture now says which one in the head's first flush and in a `Link` response header, from
// a stored copy, so the request leaves with the first byte. Only that one picture is announced; nothing else is preloaded.
import type { LeadPlan } from "./lead-picture";

/** The sizes each lead slot draws its pictures at: the components read these, so the announcement always asks for the same file. */
export const LEAD_SIZES = {
  /** Today's two-picture stack from 1024 px: the first across the column, the second at 58% over its corner. */
  stackFirst: "(min-width: 1024px) 34vw, 50vw",
  stackSecond: "(min-width: 1024px) 20vw, 50vw",
  pair: "(min-width: 480px) 50vw, 100vw",
  single: "(min-width: 768px) 720px, 100vw",
  /** Today's mosaic tiles (the front passes these); story pages use `mosaic`. */
  frontMosaic: "(min-width: 1024px) 18vw, 50vw",
  mosaic: "(min-width: 1024px) 25vw, 50vw",
  /** Today's single "after" crop beside the lead. */
  frontCrop: "(min-width: 1024px) 40vw, 100vw",
} as const;

/** The announced picture: its address, its renditions and sizes when it has them, and the widths it is the largest element at. */
export type FirstPicture = { href: string; srcSet: string | null; sizes: string | null; media: string | null };
/** What a page's first flush may announce. */
export type FirstPaint = { picture: FirstPicture | null };
export const NO_FIRST: FirstPaint = { picture: null };

/** Today's lead picture is the largest element only where it stands beside the headline (from 1024 px); below that the headline is,
 *  and the picture sits under the deck, so it is announced for those widths only. */
export const FRONT_PICTURE_MEDIA = "(min-width: 1024px)";
/** A page's first flush waits at most this long for its stored picture address when the read's start is unknown. */
export const FIRST_PAINT_WAIT_MS = 250;
/** C1b · the read starts when the request arrives, before the page code loads; on a cold instance its first database connection
 *  takes 400 to 650 ms (measured, local engine, 23 Nov), so the first flush waits until this long after arrival, and never less than
 *  the floor. A warm instance has the address kept and does not wait at all. */
export const FIRST_PAINT_DEADLINE_MS = 650;
export const FIRST_PAINT_FLOOR_MS = 50;
/** How long a page's loader still waits for the announced picture, given how long ago its read started (null: not known). */
export const firstWaitMs = (elapsedMs: number | null): number =>
  elapsedMs === null || !Number.isFinite(elapsedMs) ? FIRST_PAINT_WAIT_MS : Math.max(FIRST_PAINT_FLOOR_MS, Math.min(FIRST_PAINT_DEADLINE_MS, FIRST_PAINT_DEADLINE_MS - Math.max(0, elapsedMs)));

const DRAWN = new Set(["pair", "single", "card", "mosaic"]);
const pic = (src: string, srcSet: string | null, sizes: string | null, media: string | null): FirstPicture => ({ href: src, srcSet: srcSet || null, sizes: srcSet ? sizes : null, media });

/** The first picture a lead plan draws (the one painted first and largest), with the sizes `LeadPicture` gives it; null when the plan
 *  draws type, swatches, marks, a chart or nothing. `front`: Today's compact stack (two pictures) and its mosaic sizes. */
export function planPicture(plan: LeadPlan | null | undefined, where: "front" | "story"): FirstPicture | null {
  if (!plan || !DRAWN.has(plan.kind)) return null;
  const first = plan.items[0];
  if (!first) return null;
  const media = where === "front" ? FRONT_PICTURE_MEDIA : null;
  const sizes = where === "front" && plan.kind === "mosaic" && plan.items.length === 2 ? LEAD_SIZES.stackFirst
    : plan.kind === "pair" ? LEAD_SIZES.pair
    : plan.kind === "mosaic" ? (where === "front" ? LEAD_SIZES.frontMosaic : LEAD_SIZES.mosaic)
    : LEAD_SIZES.single;
  return pic(first.src, first.srcSet, sizes, media);
}

/** Today's lead slot, as the front model hands it to the page (front.ts `LeadEvidence`): the picture it draws eagerly, if any. */
export type FrontSlot =
  | { kind: "plan"; plan: LeadPlan }
  | { kind: "crop"; crop: { src: string } }
  | { kind: "card"; cover: { src: string } }
  | { kind: string };
export function frontPicture(slot: FrontSlot | null | undefined): FirstPicture | null {
  if (!slot) return null;
  if (slot.kind === "plan" && "plan" in slot) return planPicture(slot.plan, "front");
  if (slot.kind === "crop" && "crop" in slot) return pic(slot.crop.src, null, null, FRONT_PICTURE_MEDIA);
  if (slot.kind === "card" && "cover" in slot) return pic(slot.cover.src, null, null, FRONT_PICTURE_MEDIA);
  // Before/after crops load lazily beside the lead and the sparkline is drawn: nothing to announce.
  return null;
}

/** The `Link` response header for the announced picture (absent without one). Values are quoted; `;` and `,` cannot occur in our
 *  addresses or sizes, which are built from checked paths and the constants above. */
export function linkHeader(p: FirstPicture | null | undefined): string | null {
  if (!p) return null;
  const parts = [`<${p.href}>`, "rel=preload", "as=image", "fetchpriority=high"];
  if (p.srcSet) parts.push(`imagesrcset="${p.srcSet}"`);
  if (p.srcSet && p.sizes) parts.push(`imagesizes="${p.sizes}"`);
  if (p.media) parts.push(`media="${p.media}"`);
  return parts.join("; ");
}

/** W3d Part 5 · the directory's and a collection's first picture is the largest element only on a phone (from 768 px the cover headline
 *  is), so it is announced for those widths only. */
export const NARROW_PICTURE_MEDIA = "(max-width: 767px)";
/** A brand's Data view leads with its homepage thumbnail (`SiteThumb`, drawn at 320 px from its renditions). */
export const THUMB_SIZES = "320px";
export const thumbPicture = (t: { src: string; srcSet?: string | null } | null | undefined): FirstPicture | null => (t ? pic(t.src, t.srcSet ?? null, THUMB_SIZES, null) : null);
/** A pattern page's first example that has a crop (the large tile when it has one): the picture it paints largest at every width. */
export function patternPicture(p: { examples: readonly { crop?: { src: string } | null }[] } | null | undefined): FirstPicture | null {
  const c = p?.examples.find(e => e.crop)?.crop;
  return c ? pic(c.src, null, null, null) : null;
}
/** The index of the example `patternPicture` announces (the page draws that one eagerly). */
export const patternFirstIndex = (examples: readonly { crop?: unknown }[]) => examples.findIndex(e => !!e.crop);
/** A wall's first tile with a crop (tiles without one are drawn, not pictures), announced for phones. */
export function wallPicture(tiles: readonly { crop?: { src: string } | null }[] | null | undefined): FirstPicture | null {
  const c = tiles?.find(t => t.crop)?.crop;
  return c ? pic(c.src, null, null, NARROW_PICTURE_MEDIA) : null;
}
/** The directory's "Moved this week" band (shown on the directory tab with three cards or more in the lens): its first card's crop. */
export function brandsPicture(d: { moved?: readonly { domain: string; hero: { src: string } }[]; sites: readonly { domain: string; sector?: string | null }[] } | null | undefined, v: { tab: string; sector: string }): FirstPicture | null {
  if (!d || v.tab !== "directory") return null;
  const sector = new Map(d.sites.map(x => [x.domain, x.sector ?? null]));
  const band = (d.moved ?? []).filter(m => v.sector === "all" || sector.get(m.domain) === v.sector);
  return band.length >= 3 ? pic(band[0]!.hero.src, null, null, NARROW_PICTURE_MEDIA) : null;
}

/** Which page a request is and which object's picture it would announce: Today without a lens, a brand's or a story's Read view, a
 *  brand's Data view (W3d Part 5: where /library/<domain> lands) and a pattern without a lens. Any other page (another view, a sector
 *  or format lens) announces nothing here; the directory and collections announce from the data their loaders already wait for. */
export type FirstKind = "front" | "brand" | "story" | "brand-data" | "pattern";
export function firstOf(pathname: string, search: URLSearchParams): { kind: FirstKind; id: string } | null {
  if (search.get("view") === "data" && [...search.keys()].every(k => k !== "sector")) {
    const b = /^\/brands\/([a-z0-9.-]{3,253})\/?$/.exec(pathname);
    return b ? { kind: "brand-data", id: b[1]! } : null;
  }
  if (search.has("view")) return null;
  const pattern = /^\/patterns\/([^/]{3,360})\/?$/.exec(pathname);
  if (pattern) { if (search.has("sector")) return null; try { const k = decodeURIComponent(pattern[1]!); return k.length <= 120 ? { kind: "pattern", id: k } : null; } catch { return null; } }
  if (pathname === "/") return search.has("sector") || search.has("format") ? null : { kind: "front", id: "today" };
  const brand = /^\/brands\/([a-z0-9.-]{3,253})\/?$/.exec(pathname);
  if (brand) return { kind: "brand", id: brand[1]! };
  const story = /^\/stories\/([^/]{1,300})\/?$/.exec(pathname);
  if (story) { try { return { kind: "story", id: decodeURIComponent(story[1]!) }; } catch { return null; } }
  return null;
}
