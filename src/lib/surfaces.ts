// W1b · every surface a brand owns: its latest capture of each page (home, product, about, pricing) side by side, whether each one's
// measured identity matches the homepage, and the one census measure "does the product page use the homepage's headline typeface".
// Pure; measured fields only (rendered headline and body typeface, page theme, accent colour), compared with the library's own equality
// rules (`equalField`). A field the crawler could not measure, or a typeface that fell back to a substitute, is "not comparable".
import { equalField } from "./library-diff";
import { colourName } from "./colour-names";

export const SURFACE_PAGES = ["home", "product", "about", "pricing"] as const;
export type SurfacePage = (typeof SURFACE_PAGES)[number];
export const SURFACE_NAME: Record<SurfacePage, string> = { home: "Homepage", product: "Product page", about: "About page", pricing: "Pricing page" };
export type Font = { family: string; substituted?: boolean | null; webfont?: boolean | null } | null;
export type SurfaceCapture = { id: number; domain: string; page_type: string; captured_at: string; run_id: string | null; url: string | null; h1: Font; body: Font; theme: string | null; accent: string | null };
export type Match = "yes" | "no" | "not comparable";
export const SURFACE_FIELDS = ["h1", "body", "theme", "accent"] as const;
export type SurfaceField = (typeof SURFACE_FIELDS)[number];
export const SURFACE_FIELD_NAME: Record<SurfaceField, string> = { h1: "Headline typeface", body: "Body typeface", theme: "Theme", accent: "Accent colour" };

const font = (f: Font) => (f && typeof f.family === "string" && f.family.trim() && f.substituted !== true ? f : null);
const value = (c: SurfaceCapture, k: SurfaceField): unknown => (k === "h1" || k === "body" ? font(c[k]) : k === "theme" ? c.theme : c.accent && /^#[0-9a-f]{6}$/i.test(c.accent) ? c.accent : null);
/** Whether one measured field of a surface matches the homepage's. */
export function fieldMatch(home: SurfaceCapture, other: SurfaceCapture, k: SurfaceField): Match {
  const a = value(home, k), b = value(other, k);
  if (a == null || b == null) return "not comparable";
  return equalField(k, a, b) ? "yes" : "no";
}
/** "Matches home" for a whole surface: no when any comparable field differs, yes when at least one is comparable and all match. */
export function surfaceMatch(home: SurfaceCapture, other: SurfaceCapture): Match {
  const m = SURFACE_FIELDS.map(k => fieldMatch(home, other, k));
  return m.includes("no") ? "no" : m.includes("yes") ? "yes" : "not comparable";
}
/** How a measured field reads in a table cell: typeface family, theme word, accent with its plain colour name. */
export function fieldText(c: SurfaceCapture, k: SurfaceField): string {
  const v = value(c, k);
  if (v == null) return k === "h1" || k === "body" ? (c[k]?.substituted ? "fallback font" : "not measured") : "not measured";
  if (k === "h1" || k === "body") return (v as { family: string }).family;
  if (k === "accent") return colourName(String(v)) ?? String(v).toUpperCase();
  return String(v);
}
const newestFirst = (a: SurfaceCapture, b: SurfaceCapture) => b.captured_at.localeCompare(a.captured_at) || b.id - a.id;
/** The newest capture of each surface page for one brand. */
export function latestSurfaces(captures: readonly SurfaceCapture[]): Partial<Record<SurfacePage, SurfaceCapture>> {
  const out: Partial<Record<SurfacePage, SurfaceCapture>> = {};
  for (const c of [...captures].sort(newestFirst)) if ((SURFACE_PAGES as readonly string[]).includes(c.page_type) && !out[c.page_type as SurfacePage]) out[c.page_type as SurfacePage] = c;
  return out;
}

// PRODUCT PAGE AGAINST HOMEPAGE (same crawl) ----------------------------------------------------------------------------------------
/** A gift-card page is not a product page (the crawler now avoids them); never compared. */
export const GIFT_CARD = /gift[-_ ]?card|giftcard|e-?gift/i;
export type ProductPair = { domain: string; home: SurfaceCapture; product: SurfaceCapture; typeface: Match; accent: Match };
/** The newest crawl in which a brand has both a homepage and a product page capture (same run id), compared on typeface and accent. */
export function productPair(captures: readonly SurfaceCapture[]): ProductPair | null {
  const sorted = [...captures].sort(newestFirst);
  for (const home of sorted.filter(c => c.page_type === "home" && c.run_id)) {
    const product = sorted.find(c => c.page_type === "product" && c.run_id === home.run_id);
    if (!product) continue;
    if (product.url && GIFT_CARD.test(product.url)) return null;
    return { domain: home.domain, home, product, typeface: fieldMatch(home, product, "h1"), accent: fieldMatch(home, product, "accent") };
  }
  return null;
}
/** The census: of the brands in `sector` whose product page and homepage typefaces are both measured (M), those where they differ (N). */
export function productTypeCount(pairs: readonly ProductPair[]): { base: number; differ: ProductPair[] } {
  const comparable = pairs.filter(p => p.typeface !== "not comparable");
  return { base: comparable.length, differ: comparable.filter(p => p.typeface === "no") };
}
/** The brand page's one plain line about its product page, or null when there is no same-crawl pair. */
export function productLine(p: ProductPair | null, day: (iso: string) => string): string | null {
  if (!p) return null;
  const part = (m: Match, what: string) => (m === "yes" ? `the homepage's ${what}` : m === "no" ? `a different ${what}` : null);
  const t = part(p.typeface, "headline typeface"), a = part(p.accent, "accent colour"), when = `both captured in the same crawl on ${day(p.home.captured_at)}`;
  if (!t && !a) return `The product page and the homepage could not be compared on headline typeface or accent colour (${when}).`;
  const said = [t, a].filter(Boolean).join(" and "), missing = !t ? " Its headline typeface could not be compared." : !a ? " Its accent colour could not be compared." : "";
  return `The product page uses ${said} (${when}).${missing}`;
}

// VIEW SHAPES (built by surfaces.server.ts) ------------------------------------------------------------------------------------
export type SurfaceTile = { key: string; what: string; at: string | null; live: string; report: string; pic: { src: string; width: number; height: number; alt: string; fit: "cover" | "contain"; ratio: string } | null; lines: string[] };
export type SurfaceRow = { page: string; fields: Record<string, string>; at: string; url: string | null; match: Match | "this is home" };
export type AssetHistoryRow = { kind: string; version: number; first: string; last: string; src: string; width: number; height: number; verdict: string | null };
export type BrandSurfaces = { domain: string; show: boolean; tiles: SurfaceTile[]; productLine: string | null; rows: SurfaceRow[]; fieldNames: string[]; history: AssetHistoryRow[] };
/** The icon and card history's verdict column, in plain words. */
export const ASSET_VERDICT_WORDS: Record<string, string> = { change: "Changed (confirmed)", "re-encode": "Same picture, saved again", waiting: "Looks different; waiting for captures", alternating: "Switches back to an earlier version", blank: "Blank capture, not counted", editorial: "Follows the latest article, not counted", unmeasured: "Not measured yet" };
export const assetVerdictText = (v: string | null) => (v == null ? "First version" : ASSET_VERDICT_WORDS[v] ?? v);
