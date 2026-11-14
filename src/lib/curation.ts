// Pure curated-index helpers: index/gallery vocab, crawl-site → forecast trait mapping and curation lead. No I/O.
import { siteTraits } from "./forecast-signals";

export const CRAWL_INDEXES = ["mainstream", "vanguard", "curated"] as const;
export type CrawlIndex = (typeof CRAWL_INDEXES)[number];
export const GALLERIES = ["godly", "landbook", "awwwards", "minimalgallery", "onepagelove", "cssda", "saaslandingpage", "arena", "producthunt"] as const;
export type Gallery = (typeof GALLERIES)[number];
/** Below this many ok sites in an index, a share is too noisy to compare (sample-bias rule). */
export const MIN_INDEX_SITES = 10;
/** Forecast trait dimensions the crawl measures; css features and AI-tag traits are library-only. */
export const CRAWL_TRAIT_DIMENSIONS = ["theme", "headline", "font", "tracking", "hero_media", "framework"] as const;

export type CrawlTraitSite = { run_id?: string | null; index_name: string | null; type?: unknown; color?: unknown; layout?: unknown; tech?: unknown; galleries?: string[] | null };
const o = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Mirrors forecast `siteTraits` on crawl signals so curation lead and adoption speak about the same trait. */
export function crawlSiteTraits(s: CrawlTraitSite): string[] {
  const rendered = o(o(s.type)["rendered"]), h1 = o(rendered["h1"]), body = o(rendered["body"]), declared = o(o(o(s.type)["declared"])["h1"]);
  const webfont = h1["webfont"] === true || body["webfont"] === true ? true : h1["system"] === true || body["system"] === true || body["family"] === "System UI" ? false : null;
  const tracking = declared["letter_spacing_em"];
  const tech = o(s.tech);
  const traits = siteTraits({ domain: "", quarter: "2000Q1", sector: "", theme: typeof o(s.color)["theme"] === "string" ? String(o(s.color)["theme"]) : null,
    h1_family: typeof h1["family"] === "string" ? String(h1["family"]) : null, webfont,
    h1_tracking: typeof tracking === "number" ? tracking : typeof tracking === "string" && tracking.trim() !== "" && Number.isFinite(Number(tracking)) ? Number(tracking) : null,
    frameworks: Object.fromEntries(["next", "framer", "webflow", "tailwind"].map(k => [k, tech[k] === true])),
    hero_media: typeof o(s.layout)["hero_media"] === "string" ? String(o(s.layout)["hero_media"]) : null });
  return traits.filter(t => (CRAWL_TRAIT_DIMENSIONS as readonly string[]).includes(t.slice(0, t.indexOf(":"))));
}

export type IndexCounts = Record<CrawlIndex, { n: number; hits: number; share: number | null }>;
export type TraitCuration = { trait: string; indexes: IndexCounts; curation_lead_pts: number | null; vanguard_spread_pts: number | null };
const pts = (a: number | null, b: number | null) => (a === null || b === null ? null : Math.round((a - b) * 1000) / 10);
export const curationLead = (curatedShare: number | null, mainstreamShare: number | null) => pts(curatedShare, mainstreamShare);

/** Per-trait share in each index for one run's ok sites; shares need ≥ MIN_INDEX_SITES sites in that index. */
export function traitCuration(sites: CrawlTraitSite[]): Map<string, TraitCuration> {
  const totals: Record<string, number> = { mainstream: 0, vanguard: 0, curated: 0 };
  const hits = new Map<string, Record<string, number>>();
  for (const s of sites) {
    const idx = s.index_name ?? ""; if (!(idx in totals)) continue; totals[idx]!++;
    for (const t of crawlSiteTraits(s)) { const h = hits.get(t) ?? { mainstream: 0, vanguard: 0, curated: 0 }; h[idx]!++; hits.set(t, h); }
  }
  const out = new Map<string, TraitCuration>();
  for (const [trait, h] of hits) {
    const indexes = Object.fromEntries(CRAWL_INDEXES.map(i => [i, { n: totals[i]!, hits: h[i]!, share: totals[i]! >= MIN_INDEX_SITES ? h[i]! / totals[i]! : null }])) as IndexCounts;
    out.set(trait, { trait, indexes, curation_lead_pts: curationLead(indexes.curated.share, indexes.mainstream.share), vanguard_spread_pts: pts(indexes.vanguard.share, indexes.mainstream.share) });
  }
  return out;
}

/** How many curated sites each gallery contributed (a site can come from several galleries). */
export function galleryMix(sites: CrawlTraitSite[]): Record<string, number> {
  const mix: Record<string, number> = {};
  for (const s of sites) if (s.index_name === "curated") for (const g of new Set(s.galleries ?? [])) mix[g] = (mix[g] ?? 0) + 1;
  return Object.fromEntries(Object.entries(mix).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

/** Sign flip of curation lead between runs with a material move (wire crossover alert rule). */
export const CROSSOVER_MIN_DELTA_PTS = 5;
export function isCrossover(prev: number | null | undefined, cur: number | null | undefined): boolean {
  if (prev == null || cur == null || prev === 0 || cur === 0) return false;
  return Math.sign(prev) !== Math.sign(cur) && Math.abs(cur - prev) >= CROSSOVER_MIN_DELTA_PTS;
}
