// C1b Part 2 · the stored picture addresses, dependency-free so the picture route can check an address on a cold server without
// loading the intake schemas (thumbs.ts, crops.ts, brand-assets.ts and art/contract.ts re-export these, so there is one rule).
export const DOMAIN_RE = /^(?=.{3,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
/** `<domain>/<day>-<desktop|mobile>[-640w|-320w].webp` in the site-thumbs bucket. */
export const THUMB_PATH_RE = /^([a-z0-9.-]+)\/(\d{4}-\d{2}-\d{2})-(desktop|mobile)(?:-(640|320)w)?\.webp$/;
/** The full-size thumbnail a rendition belongs to (its row's `path`), or null for an address that is not a thumbnail. */
export const mainPathOf = (path: string) => (THUMB_PATH_RE.test(path) ? path.replace(/-(640|320)w\.webp$/, ".webp") : null);
/** `<domain>/<section>/<day>-<hash>.webp`: a section crop. */
export const CROP_PATH_RE = /^([a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?)\/(hero|nav|pricing|cta|footer)\/(\d{4}-\d{2}-\d{2})-([0-9a-f]{8})\.webp$/;
/** `<domain>/<page>/<day>-<hash>.webp`: a product, about or pricing page's first screen. */
export const SURFACE_PATH_RE = /^([a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?)\/(page-product|page-about|page-pricing)\/(\d{4}-\d{2}-\d{2})-([0-9a-f]{8})\.webp$/;
/** `assets/<domain>/<icon|card>/<day>-<hash>.webp`: the brand's own icon or social card. */
export const ASSET_PATH_RE = /^assets\/([a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?)\/(icon|card)\/(\d{4}-\d{2}-\d{2})-([0-9a-f]{8})\.webp$/;
/** `art/<met|aic>-<id>-<hash>.webp`: a museum work's thumbnail. */
export const ART_PATH_RE = /^art\/(met|aic)-[A-Za-z0-9_-]{1,40}-[0-9a-f]{8}\.webp$/;
export const isArtPath = (p: string) => ART_PATH_RE.test(p);

/** What a `/crops/<path>` address is and which stored row decides whether it may be served. */
export type CropRef = { kind: "asset" | "surface" | "crop"; domain: string } | { kind: "art" };
export function cropRefOf(path: string): CropRef | null {
  if (path.startsWith("art/")) return isArtPath(path) ? { kind: "art" } : null;
  for (const [kind, re] of [["asset", ASSET_PATH_RE], ["surface", SURFACE_PATH_RE], ["crop", CROP_PATH_RE]] as const) {
    const m = re.exec(path);
    if (m) return DOMAIN_RE.test(m[1]!) ? { kind, domain: m[1]! } : null;
  }
  return null;
}
