// Pure leading-indicator functions. No I/O.
import { qIndex, usablePoints, type SeriesPoint } from "./forecast";
import { NEXT_WAVE_WEIGHTS, TRAIT_KEYWORDS } from "./forecast-constants";
export type SiteRow = { domain: string; quarter: string; sector: string; theme?: string | null; h1_family?: string | null; webfont?: boolean | null; h1_tracking?: number | null; css_features?: unknown; frameworks?: unknown; hero_media?: string | null; ai_tags?: unknown };
const AI_DIMS = ["imagery", "aesthetic", "components", "hero_layout", "ai_positioning", "tone", "color_mood"];
const SERIF = /(serif|georgia|times|garamond|canela|tiempos|lora|fraunces|playfair|editorial|domaine|recoleta)/i;
// Mirrors the SQL trait definitions behind library_history_share (except the whitespace median).
export function siteTraits(r: SiteRow): string[] {
  const out = new Set<string>();
  if (r.theme === "dark") out.add("theme:dark");
  if (r.h1_family && SERIF.test(r.h1_family) && !/sans/i.test(r.h1_family)) out.add("headline:serif");
  if (r.webfont === true) out.add("font:webfont"); if (r.webfont === false) out.add("font:system");
  if (typeof r.h1_tracking === "number" && r.h1_tracking <= -0.02) out.add("tracking:tight");
  if (Array.isArray(r.css_features)) for (const f of r.css_features) if (typeof f === "string") out.add(`css:${f}`);
  if (r.frameworks && typeof r.frameworks === "object") for (const f of ["next", "framer", "webflow", "tailwind"]) if (String((r.frameworks as Record<string, unknown>)[f]) === "true") out.add(`framework:${f}`);
  if (r.hero_media) out.add(`hero_media:${r.hero_media}`);
  if (r.ai_tags && typeof r.ai_tags === "object") for (const d of AI_DIMS) { const v = (r.ai_tags as Record<string, unknown>)[d]; for (const x of Array.isArray(v) ? v : typeof v === "string" ? [v] : []) if (typeof x === "string") out.add(`${d}:${x}`); }
  return [...out];
}

// First usable quarter where library-wide share crosses `level`, only when an earlier usable quarter sat below it.
export function crossingQuarter(points: SeriesPoint[], scope: string, level: number): string | null {
  const use = usablePoints(points, scope); const i = use.findIndex(p => p.share >= level);
  return i > 0 ? use[i]!.quarter : null;
}

export type Trendsetter = { domain: string; score: number; observed: number; traits_led: { trait: string; adopted: string; crossed: string; lead: number }[] };
export function trendsetterScores(rows: SiteRow[], crossings: Record<string, string>): Trendsetter[] {
  const bySite = new Map<string, SiteRow[]>();
  for (const r of rows) bySite.set(r.domain, [...(bySite.get(r.domain) ?? []), r]);
  const out: Trendsetter[] = [];
  for (const [domain, list] of bySite) {
    const caps = [...list].sort((a, b) => qIndex(a.quarter) - qIndex(b.quarter)).map(r => ({ quarter: r.quarter, traits: new Set(siteTraits(r)) }));
    const observed = new Set<string>(); const led: Trendsetter["traits_led"] = []; let total = 0;
    for (const [trait, crossed] of Object.entries(crossings)) {
      if (!caps.some(c => c.traits.has(trait))) continue; observed.add(trait);
      const i = caps.findIndex((c, j) => c.traits.has(trait) && caps[j + 1]!?.traits.has(trait));
      if (i < 0) continue; const lead = Math.min(8, qIndex(crossed) - qIndex(caps[i]!.quarter));
      if (lead > 0) { total += lead; led.push({ trait, adopted: caps[i]!.quarter, crossed, lead }); }
    }
    if (observed.size) out.push({ domain, score: total / observed.size, observed: observed.size, traits_led: led.sort((a, b) => b.lead - a.lead) });
  }
  return out.sort((a, b) => b.score - a.score || a.domain.localeCompare(b.domain));
}

export function trendsetterGap(latestRows: SiteRow[], top: Set<string>, trait: string): number | null {
  const a = latestRows.filter(r => top.has(r.domain)), b = latestRows.filter(r => !top.has(r.domain));
  if (!a.length || !b.length) return null;
  const share = (l: SiteRow[]) => l.filter(r => siteTraits(r).includes(trait)).length / l.length;
  return (share(a) - share(b)) * 100;
}

export function leadLag(seriesBySector: Record<string, SeriesPoint[]>, level = 0.1): Record<string, string | null> {
  return Object.fromEntries(Object.entries(seriesBySector).map(([s, pts]) => [s, usablePoints(pts, s).find(p => p.share >= level)?.quarter ?? null]));
}

export function keywordCount(trait: string, texts: string[]): number {
  const keys = TRAIT_KEYWORDS[trait]; if (!keys) return 0;
  return texts.filter(t => { const l = t.toLowerCase(); return keys.some(k => l.includes(k)); }).length;
}

export type Components = { gap: number | null; vanguard: number | null; momentum: number | null; corroboration: number | null };
export function zScores(values: (number | null)[]): (number | null)[] {
  const v = values.filter((x): x is number => x !== null); if (v.length < 2) return values.map(x => (x === null ? null : 0));
  const m = v.reduce((a, b) => a + b, 0) / v.length, sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
  return values.map(x => (x === null ? null : sd > 0 ? (x - m) / sd : 0));
}
// Weighted z-combo; missing components contribute 0 (the cohort mean).
export function nextWaveScores(items: Components[]) {
  const keys = ["gap", "vanguard", "momentum", "corroboration"] as const;
  const z = Object.fromEntries(keys.map(k => [k, zScores(items.map(i => i[k]))])) as Record<typeof keys[number], (number | null)[]>;
  return items.map((_, i) => ({ score: keys.reduce((s, k) => s + NEXT_WAVE_WEIGHTS[k] * (z[k]![i] ?? 0), 0), z: Object.fromEntries(keys.map(k => [k, z[k]![i]])) as Record<typeof keys[number], number | null> }));
}
