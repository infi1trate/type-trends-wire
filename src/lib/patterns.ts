// PATTERN object: a signal seen as examples. Pure; examples come from each brand's current traits (the forecast's own site-trait layer).
import { basis, label, sectorName, type Basis, type Dimension, type StageName } from "./labels";
import { isComposite } from "./composites";
import { OBJECT_BLOCKS, brandPath, consoleHref, patternPath, signalPath, type Block } from "./ia";
import { currentCrop, isIllustrated, patternCountLine, sectionName, toCrop, type Crop, type CropRow, type CropSection } from "./crops";
import { patternSection } from "./evidence-map";
import { resolveSector } from "./sector-lens";
import type { Signal } from "./signals";

export type PatternSite = { domain: string; name: string | null; sector: string; captured: string | null; traits: string[] };
export const PATTERN_MIN_EXAMPLES = 3;
export const PATTERN_NOTE = "No section captures of these brands yet; examples are shown as cards until the crawler sends them.";
/** Headline LAYOUT signals and headline composites can be patterns. */
export const isPatternSignal = (s: Pick<Signal, "tier" | "dimension" | "key">) => s.tier === "headline" && (s.dimension === "LAYOUT" || isComposite(s.key));
export type PatternRow = { key: string; name: string; dimension: Dimension; basis: Basis; stage: StageName | null; momentum_index: number | null; confidence: string; so_what: string | null; examples: number; sample: string[]; href: string; section: CropSection; withCaptures: number; illustrated: boolean };
export type PatternExample = { domain: string; name: string | null; sector: string; sectorName: string; captured: string | null; crop: Crop | null; href: string };
export type PatternPage = {
  key: string; name: string; dimension: Dimension; basis: Basis; stage: StageName | null; share: number | null; momentum_index: number | null; direction: string | null; confidence: string; confidence_reason: string;
  sector: string; section: CropSection; sectionName: string; withCaptures: number; illustrated: boolean; countLine: string; examples: PatternExample[]; total: number; sectors: { sector: string; name: string; count: number }[]; note: string | null; soWhat: string;
  related: { key: string; name: string; examples: number; href: string }[]; signalHref: string; whoUses: string; blocks: readonly Block[];
};
const examplesOf = (sites: PatternSite[], key: string, sector = "all") => sites.filter(s => s.traits.includes(key) && (sector === "all" || s.sector === sector));

/** An example's crop: the latest capture of the pattern's section, only while it was current when the brand's traits were measured. */
const exampleCrop = (crops: CropRow[], e: PatternSite, section: CropSection) => currentCrop(crops, e.domain, section, e.captured);
/** /patterns: headline layout and composite signals with at least three example brands (in the lens sector when one is chosen). */
export function patternIndex(sites: PatternSite[], signals: Signal[], rawSector: unknown = "all", crops: CropRow[] = [], o: { illustrated?: boolean } = {}): PatternRow[] {
  const sector = resolveSector(rawSector);
  return signals.filter(isPatternSignal).map(s => {
    const ex = examplesOf(sites, s.key, sector).sort((a, b) => a.domain.localeCompare(b.domain)), section = patternSection(s.key);
    const withCaptures = ex.filter(e => exampleCrop(crops, e, section)).length;
    return { key: s.key, name: s.name, dimension: s.dimension, basis: s.basis, stage: s.stage, momentum_index: s.momentum_index, confidence: s.confidence, so_what: s.so_what, examples: ex.length, sample: ex.slice(0, 5).map(e => e.domain), href: patternPath(s.key), section, withCaptures, illustrated: isIllustrated(withCaptures) };
  }).filter(p => p.examples >= PATTERN_MIN_EXAMPLES && (!o.illustrated || p.illustrated)).sort((a, b) => (b.momentum_index ?? -1) - (a.momentum_index ?? -1) || b.examples - a.examples || a.name.localeCompare(b.name));
}
export const PATTERN_EXAMPLES_MAX = 48;
/** /patterns/<key>: the example grid (the pattern's section crop where one is current, typographic card otherwise), filterable by sector. */
export function patternModel(key: string, sites: PatternSite[], signals: Signal[], crops: CropRow[], rawSector: unknown = "all"): PatternPage | null {
  const s = signals.find(x => x.key === key);
  if (!s || !isPatternSignal(s)) return null;
  const sector = resolveSector(rawSector), all = examplesOf(sites, key);
  if (all.length < PATTERN_MIN_EXAMPLES) return null;
  const counts = new Map<string, number>(); for (const e of all) counts.set(e.sector, (counts.get(e.sector) ?? 0) + 1);
  const scoped = examplesOf(sites, key, sector).sort((a, b) => (b.captured ?? "").localeCompare(a.captured ?? "") || a.domain.localeCompare(b.domain));
  const section = patternSection(key), cropOf = new Map(scoped.map(e => [e.domain, exampleCrop(crops, e, section)]));
  // Brands with a capture first, then latest measurement; only brands that currently show the pattern are ever listed.
  const ordered = [...scoped].sort((a, b) => Number(!!cropOf.get(b.domain)) - Number(!!cropOf.get(a.domain)) || (b.captured ?? "").localeCompare(a.captured ?? "") || a.domain.localeCompare(b.domain));
  const examples = ordered.slice(0, PATTERN_EXAMPLES_MAX).map(e => { const c = cropOf.get(e.domain); return { domain: e.domain, name: e.name, sector: e.sector, sectorName: sectorName(e.sector), captured: e.captured, crop: c ? toCrop(c) : null, href: brandPath(e.domain) }; });
  const withCaptures = [...cropOf.values()].filter(Boolean).length;
  const l = label(key);
  const related = patternIndex(sites, signals).filter(p => p.key !== key && (p.dimension === l.dimension || isComposite(p.key) === isComposite(key))).slice(0, 6).map(p => ({ key: p.key, name: p.name, examples: p.examples, href: p.href }));
  return {
    key, name: l.name, dimension: l.dimension, basis: basis(key), stage: s.stage, share: s.share, momentum_index: s.momentum_index, direction: s.direction, confidence: s.confidence, confidence_reason: s.confidence_reason,
    sector, section, sectionName: sectionName(section), withCaptures, illustrated: isIllustrated(withCaptures), countLine: patternCountLine(l.name, scoped.length, withCaptures), examples, total: scoped.length, sectors: [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([x, count]) => ({ sector: x, name: sectorName(x), count })),
    note: withCaptures ? null : PATTERN_NOTE, soWhat: s.so_what ?? "", related, signalHref: signalPath(key), whoUses: consoleHref(`q ${key} AND ${sector}`, sector), blocks: OBJECT_BLOCKS,
  };
}
