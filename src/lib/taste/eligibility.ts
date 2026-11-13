// Pure ranking-eligibility rules shared by recommend_type faces and pairs.
/** Single-site observations are anecdotes: a sector needs ≥2 sites, 'all' needs ≥3. */
/** A sector result stands when at least this many candidates qualify (capped by the requested limit); otherwise fall back to all. */
export const MIN_SITES_SECTOR = 2, MIN_SITES_ALL = 3, MIN_QUALIFYING_SECTOR = 2;
export const minSites = (scope: string) => scope === "all" ? MIN_SITES_ALL : MIN_SITES_SECTOR;
export type ScopeFallback = { requested: string; used: "all"; qualifying_in_requested: number; min_sites_requested: number; min_sites_used: number; note: string };
/**
 * Rank within the requested scope when it has enough qualifying items; otherwise fall back to 'all'.
 * `build(scope)` returns candidates already filtered by license/category/avoid; this applies the site threshold.
 */
export function chooseScope<T extends { sites: number }>(requested: string, build: (scope: string) => T[], limit: number, unit = "faces") {
  const qualify = (scope: string) => build(scope).filter(item => item.sites >= minSites(scope));
  const items = qualify(requested), need = Math.min(MIN_QUALIFYING_SECTOR, limit);
  if (requested === "all" || items.length >= need) return { scope: requested, items, fallback: null as ScopeFallback | null };
  const note = `${requested} has only ${items.length} ${unit} seen on ≥${MIN_SITES_SECTOR} sites; ranked across all sectors instead (≥${MIN_SITES_ALL} sites each)`;
  return { scope: "all", items: qualify("all"), fallback: { requested, used: "all" as const, qualifying_in_requested: items.length, min_sites_requested: MIN_SITES_SECTOR, min_sites_used: MIN_SITES_ALL, note } };
}
