// THE BRANDS INDEX (/brands), pure: the tracked brands as one ruled list with a search, the sector lens and columns for sector, last
// change and recorded moves; sortable by each, every choice in the URL so a view can be shared.
import { resolveSector } from "./sector-lens";
import { sectorName } from "./labels";
import { inCategory, resolveCategory } from "./categories";

export const BRAND_SORTS = [{ id: "change", label: "Last change", dir: "desc" }, { id: "moves", label: "Changes", dir: "desc" }, { id: "name", label: "Name", dir: "asc" }, { id: "sector", label: "Sector", dir: "asc" }] as const;
export type BrandSort = (typeof BRAND_SORTS)[number]["id"];
export type Dir = "asc" | "desc";
export type BrandsView = { tab: "directory" | "moves"; q: string; sector: string; sort: BrandSort; dir: Dir; category?: string | null; sub?: string | null };
export type BrandsSearch = { tab?: string; q?: string; sector?: string; sort?: string; dir?: string; category?: string; sub?: string };
export type BrandListing = { domain: string; name: string | null; sector: string; lastChange: string | null; lastMove: string | null; moves: number };

const defaultDir = (s: BrandSort): Dir => BRAND_SORTS.find(x => x.id === s)!.dir;
export const Q_MAX = 80;
export function parseBrandsSearch(s: BrandsSearch): BrandsView {
  const sort: BrandSort = BRAND_SORTS.some(x => x.id === s.sort) ? (s.sort as BrandSort) : "change";
  const dir: Dir = s.dir === "asc" || s.dir === "desc" ? s.dir : defaultDir(sort);
  const sector = resolveSector(s.sector), c = resolveCategory(sector, s.category, s.sub);
  return { tab: s.tab === "moves" ? "moves" : "directory", q: typeof s.q === "string" ? s.q.slice(0, Q_MAX) : "", sector, sort, dir, category: c.category, sub: c.sub };
}
export function brandsSearch(v: BrandsView): BrandsSearch {
  return { ...(v.tab === "moves" ? { tab: "moves" } : {}), ...(v.q.trim() ? { q: v.q.trim() } : {}), ...(v.sector !== "all" ? { sector: v.sector } : {}), ...(v.sector !== "all" && v.category ? { category: v.category, ...(v.sub ? { sub: v.sub } : {}) } : {}),
    ...(v.sort !== "change" ? { sort: v.sort } : {}), ...(v.dir !== defaultDir(v.sort) ? { dir: v.dir } : {}) };
}
/** Clicking a column: the same column flips its direction; a new column starts in its natural direction. */
export const sortBy = (v: BrandsView, s: BrandSort): BrandsView => ({ ...v, sort: s, dir: v.sort === s ? (v.dir === "asc" ? "desc" : "asc") : defaultDir(s) });

export function brandsIndex(sites: readonly BrandListing[], v: BrandsView) {
  const q = v.q.trim().toLowerCase();
  const name = (s: BrandListing) => s.name ?? s.domain;
  const cmp = (a: BrandListing, b: BrandListing): number => {
    const base = v.sort === "name" ? name(a).localeCompare(name(b))
      : v.sort === "sector" ? sectorName(a.sector).localeCompare(sectorName(b.sector))
      : v.sort === "moves" ? a.moves - b.moves
      : (a.lastChange ?? "").localeCompare(b.lastChange ?? "");
    return v.dir === "asc" ? base : -base;
  };
  const cf = { category: v.sector === "all" ? null : v.category ?? null, sub: v.sub ?? null };
  const rows = sites.filter(s => (v.sector === "all" || s.sector === v.sector) && inCategory(s, cf) && (!q || s.domain.includes(q) || (s.name ?? "").toLowerCase().includes(q)))
    // Brands without a change sort last whichever way "last change" runs.
    .sort((a, b) => (v.sort === "change" ? Number(!a.lastChange) - Number(!b.lastChange) : 0) || cmp(a, b) || name(a).localeCompare(name(b)) || a.domain.localeCompare(b.domain));
  const scope = v.sector === "all" ? "" : ` in ${sectorName(v.sector)}`;
  const countLine = q ? `${rows.length} of ${sites.length} brands match “${v.q.trim()}”${scope}.` : `${rows.length} brands slug reads${scope}.`;
  return { rows, countLine, empty: rows.length ? null : q ? `No tracked brand matches “${v.q.trim()}”${scope}. Try part of the name or the domain, or audit any site instead.` : `No tracked brand${scope} yet.` };
}

/** P2c · how long the first response of /brands waits for the stored directory before it sends the title alone (a stored record reads
 *  in about a second on a fresh instance; a live build takes longer and streams in behind the title, as before). */
export const BRANDS_FIRST_WAIT_MS = 3_000;
