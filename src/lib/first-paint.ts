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
/** A page's first flush waits at most this long for its stored picture address (it was started before the page code loaded). */
export const FIRST_PAINT_WAIT_MS = 250;

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

/** Which page a request is and which object's picture it would announce: Today without a lens, a brand's or a story's Read view.
 *  Any other page (or a Data view, a sector or format lens) announces nothing. */
export type FirstKind = "front" | "brand" | "story";
export function firstOf(pathname: string, search: URLSearchParams): { kind: FirstKind; id: string } | null {
  if (search.has("view")) return null;
  if (pathname === "/") return search.has("sector") || search.has("format") ? null : { kind: "front", id: "today" };
  const brand = /^\/brands\/([a-z0-9.-]{3,253})\/?$/.exec(pathname);
  if (brand) return { kind: "brand", id: brand[1]! };
  const story = /^\/stories\/([^/]{1,300})\/?$/.exec(pathname);
  if (story) { try { return { kind: "story", id: decodeURIComponent(story[1]!) }; } catch { return null; } }
  return null;
}
