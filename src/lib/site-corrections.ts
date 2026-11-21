// I3b · addresses on file that turned out to be a different business from the brand named, mapped to the brand's real address.
// Pure and dependency-free: the crawl intake rewrites the crawler's seed list through it before `library_sync` (so the wrong address
// stays inactive whatever list the crawler sends) and drops captures of the wrong address; once the crawler's seeds carry the right
// address the rewrite is a no-op.
export type SiteCorrection = { domain: string; on: string; reason: string };
export const SITE_CORRECTIONS: Readonly<Record<string, SiteCorrection>> = {
  "ragged-edge.com": { domain: "raggededge.com", on: "2026-11-21", reason: "ragged-edge.com is a resort and marina, not the branding studio Ragged Edge" },
};
/** Whether `domain` is an address on file that belongs to a different business. */
export const isWrongSite = (domain: string): boolean => Object.prototype.hasOwnProperty.call(SITE_CORRECTIONS, domain.toLowerCase());
/** The seed list with each wrong address replaced by the brand's real one (first entry per domain wins). */
export function correctSites<T extends { domain: string }>(sites: readonly T[]): T[] {
  const out = new Map<string, T>();
  for (const s of sites) {
    const fix = SITE_CORRECTIONS[s.domain.toLowerCase()], row = fix ? { ...s, domain: fix.domain } : s;
    if (!out.has(row.domain)) out.set(row.domain, row);
  }
  return [...out.values()];
}
