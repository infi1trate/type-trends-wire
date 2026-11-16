// SIMILAR BRANDS, pure: the tracked brands nearest to one brand by measured overlap. Jaccard overlap of headline signals on each
// brand's latest capture, counting measured signals only (AI estimates never make two brands "similar"). Below SIMILAR_MIN a brand
// is not called similar; ties go to the same sector, then by name. Fewer than SIMILAR_ENOUGH clear the bar → say so, never pad.
import { brandPath } from "./ia";

/** Minimum Jaccard overlap (shared ÷ either) of measured headline signals for a brand to be called similar. */
export const SIMILAR_MIN = 0.6;
/** …and at least this many shared signals, so one common signal (say, system fonts) never makes two brands similar on its own. */
export const SIMILAR_MIN_SHARED = 2;
export const SIMILAR_MAX = 6;
/** Below this many similar brands the page says so instead of listing a short, padded set. */
export const SIMILAR_ENOUGH = 3;

export type SimilarSite = { domain: string; name: string | null; sector: string; traits: string[] };
export type SimilarBrand = { domain: string; name: string; sector: string; sameSector: boolean; overlap: number; shared: string[]; href: string };
export type SimilarResult = { items: SimilarBrand[]; enough: boolean; basis: number; line: string };

export function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  let i = 0; for (const x of a) if (b.has(x)) i++;
  const u = a.size + b.size - i;
  return u ? i / u : 0;
}
/** The signals similarity is measured on: headline-tier, measured-basis signals the brand shows on its latest capture. */
export const comparable = (traits: readonly string[], eligible: ReadonlySet<string>) => new Set(traits.filter(t => eligible.has(t)));

const nameOf = (s: SimilarSite) => s.name ?? s.domain;
export function similarBrands(domain: string, sites: readonly SimilarSite[], eligible: ReadonlySet<string>, o: { min?: number; max?: number } = {}): SimilarResult {
  const min = o.min ?? SIMILAR_MIN, max = o.max ?? SIMILAR_MAX;
  const self = sites.find(s => s.domain === domain);
  const mine = self ? comparable(self.traits, eligible) : new Set<string>();
  const items = !mine.size ? [] : sites.filter(s => s.domain !== domain).map(s => {
    const t = comparable(s.traits, eligible);
    return { domain: s.domain, name: nameOf(s), sector: s.sector, sameSector: !!self && s.sector === self.sector, overlap: jaccard(mine, t), shared: [...mine].filter(k => t.has(k)).sort(), href: brandPath(s.domain) };
  }).filter(s => s.overlap >= min && s.shared.length >= SIMILAR_MIN_SHARED)
    .sort((a, b) => b.overlap - a.overlap || Number(b.sameSector) - Number(a.sameSector) || a.name.localeCompare(b.name) || a.domain.localeCompare(b.domain))
    .slice(0, max);
  const enough = items.length >= SIMILAR_ENOUGH, pctMin = Math.round(min * 100);
  const line = !mine.size ? "No measured headline signal on this brand's latest capture yet, so there is nothing to compare."
    : enough ? `The ${items.length} tracked brands sharing the most measured headline signals with it (at least ${pctMin}% overlap and ${SIMILAR_MIN_SHARED} shared signals).`
    : items.length === 0 ? `No tracked brand shares at least ${pctMin}% (and ${SIMILAR_MIN_SHARED} or more) of its measured headline signals, so none is called similar.`
    : `Only ${items.length} tracked ${items.length === 1 ? "brand shares" : "brands share"} at least ${pctMin}% (and ${SIMILAR_MIN_SHARED} or more) of its measured headline signals; we show ${items.length === 1 ? "it" : "them"} rather than pad the list.`;
  return { items, enough, basis: mine.size, line };
}
