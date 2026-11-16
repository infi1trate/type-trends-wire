// The brand picker's pure rules: search over tracked brands only. Pure.
export type Pickable = { domain: string; name: string; sector: string };
/** Tracked brands matching the query by name or domain: exact first, then prefix, then substring; never a brand outside the list. */
export function pickBrands<T extends Pickable>(brands: T[], q: string, limit = 12): T[] {
  const s = q.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  if (!s) return [];
  const rank = (b: T) => { const n = b.name.toLowerCase(), d = b.domain; return n === s || d === s ? 0 : n.startsWith(s) || d.startsWith(s) ? 1 : n.includes(s) || d.includes(s) ? 2 : 9; };
  return brands.map(b => [rank(b), b] as const).filter(([r]) => r < 9).sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name)).slice(0, limit).map(([, b]) => b);
}
