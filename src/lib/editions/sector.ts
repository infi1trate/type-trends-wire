// STATE OF A SECTOR: a quarterly report built on read from the reader run's signals, stored stories, trendsetters and pattern examples.
// Pure and deterministic; no AI text. Blocks render in the fixed SECTOR_BLOCKS order.
import { sectorName, type StageName } from "../labels";
import { brandPath, signalPath } from "../ia";
import { buildSignals, type Signal, type SignalRow } from "../signals";
import { resolveSector, sectorCoverage } from "../sector-lens";
import type { TierResult } from "../tiers";
import { storyPath, streamOf, type StoryRecord } from "../stories/view";
import { longDate } from "../digest/week";
import type { Crop } from "../crops";

export const SECTOR_BLOCKS = ["headline", "signals", "contrast", "white-space", "counter-moves", "leaders", "patterns", "stories", "basis"] as const;
export const SECTOR_SIGNALS_MAX = 12;
export const SECTOR_CONTRAST_MAX = 6;
export const SECTOR_LEADERS_MAX = 8;
export const SECTOR_STORIES_MAX = 12;
/** White space and counter-moves look back this far (a quarter can be a few days old). */
export const SECTOR_LOOKBACK_DAYS = 90;
const RISING: ReadonlySet<StageName | null> = new Set<StageName | null>(["Emerging", "Rising"]);

export function quarterOf(now: number) {
  const d = new Date(now), q = Math.floor(d.getUTCMonth() / 3), y = d.getUTCFullYear();
  return { key: `${y}Q${q + 1}`, label: `Q${q + 1} ${y}`, start: new Date(Date.UTC(y, q * 3, 1)).toISOString(), end: new Date(Date.UTC(y, q * 3 + 3, 1)).toISOString() };
}
export const sectorPath = (sector: string) => `/sectors/${encodeURIComponent(sector)}`;

export type SectorPatternBlock = { key: string; name: string; examples: number; withCaptures: number; href: string; sample: { domain: string; name: string | null; href: string; crop: Crop | null }[] };
export type SectorInput = {
  sector: string; now: number; run: { id: number; at: string } | null;
  rows: SignalRow[]; tiers: Map<string, TierResult>;
  sites: { domain: string; sector: string; name: string | null }[];
  trendsetters: { domain: string; rank: number; sector: string | null }[];
  stories: StoryRecord[];
  patterns: SectorPatternBlock[];
};
/** What a sector report compares: stage and share. Momentum is not computed per sector, so it is reported once, as all-sector. */
type Side = { stage: StageName | null; share: number | null };
const side = (s: Signal | undefined): Side => ({ stage: s?.stage ?? null, share: s?.share ?? null });
const momentumAll = (s: Signal | undefined) => s?.momentum_index ?? null;
const storyLine = (s: StoryRecord) => ({ id: s.id, type: s.type, kicker: s.kicker, headline: s.headline, at: s.happened_at, score: s.score, href: storyPath(s.id) });
const byScore = (a: StoryRecord, b: StoryRecord) => b.score - a.score || b.happened_at.localeCompare(a.happened_at) || a.id.localeCompare(b.id);

export type SectorReport = ReturnType<typeof sectorReport>;
export function sectorReport(i: SectorInput) {
  const sector = resolveSector(i.sector), name = sectorName(sector), q = quarterOf(i.now);
  const cov = sectorCoverage(i.rows, i.tiers, sector);
  const all = new Map(buildSignals(i.rows, i.tiers, "all").map(s => [s.key, s]));
  const here = cov.enough ? buildSignals(i.rows, i.tiers, sector) : [];
  const shown = here.filter(s => s.tier === "headline" || s.tier === "supporting");
  const signals = shown.filter(s => s.tier === "headline").map(s => ({ key: s.key, name: s.name, dimension: s.dimension, basis: s.basis, here: side(s), all: side(all.get(s.key)), momentum_all: momentumAll(all.get(s.key)), href: signalPath(s.key) }))
    .sort((a, b) => (b.momentum_all ?? -1) - (a.momentum_all ?? -1) || a.name.localeCompare(b.name)).slice(0, SECTOR_SIGNALS_MAX);
  const pair = (s: Signal) => ({ key: s.key, name: s.name, dimension: s.dimension, here: side(s), all: side(all.get(s.key)), momentum_all: momentumAll(all.get(s.key)), href: signalPath(s.key) });
  const risingHere = shown.filter(s => RISING.has(s.stage) && !RISING.has(all.get(s.key)?.stage ?? null)).sort((a, b) => (momentumAll(all.get(b.key)) ?? -1) - (momentumAll(all.get(a.key)) ?? -1) || a.name.localeCompare(b.name)).slice(0, SECTOR_CONTRAST_MAX).map(pair);
  const risingElsewhere = shown.filter(s => !RISING.has(s.stage) && s.stage !== null && RISING.has(all.get(s.key)?.stage ?? null)).sort((a, b) => (momentumAll(all.get(b.key)) ?? -1) - (momentumAll(all.get(a.key)) ?? -1) || a.name.localeCompare(b.name)).slice(0, SECTOR_CONTRAST_MAX).map(pair);

  const stream = streamOf(i.stories).filter(s => s.sector === sector && s.type !== "launch"), since = i.now - SECTOR_LOOKBACK_DAYS * 864e5;
  const recent = (s: StoryRecord) => Date.parse(s.happened_at) >= since && Date.parse(s.happened_at) <= i.now;
  const whiteSpace = stream.filter(s => s.type === "white_space" && recent(s)).sort(byScore).slice(0, 4).map(storyLine);
  const counterMoves = stream.filter(s => s.type === "counter_move" && recent(s)).sort(byScore).slice(0, 6).map(storyLine);
  const quarter = stream.filter(s => s.happened_at >= q.start && s.happened_at < q.end).sort(byScore);

  const sites = i.sites.filter(s => s.sector === sector), nameOf = new Map(sites.map(s => [s.domain, s.name]));
  const moves = streamOf(i.stories).filter(s => ["move", "rebrand", "counter_move", "roundup"].includes(s.type)).sort((a, b) => b.happened_at.localeCompare(a.happened_at));
  const leaders = [...i.trendsetters].filter(t => t.sector === sector && nameOf.has(t.domain)).sort((a, b) => a.rank - b.rank).slice(0, SECTOR_LEADERS_MAX).map(t => {
    const m = moves.find(s => s.domains.includes(t.domain));
    return { domain: t.domain, name: nameOf.get(t.domain) ?? null, rank: t.rank, href: brandPath(t.domain), latest: m ? { id: m.id, headline: m.headline, at: m.happened_at, href: storyPath(m.id) } : null };
  });
  const asOf = i.run?.at ?? new Date(i.now).toISOString();
  return {
    sector, name, quarter: q, title: `State of ${name} · ${q.label}`, as_of: asOf, asOfText: longDate(asOf), href: sectorPath(sector),
    brands: sites.length, coverage: { covered: cov.covered, total: cov.total, enough: cov.enough },
    note: cov.enough ? null : `${name} doesn't have enough forecast coverage yet (${cov.covered} of ${cov.total} headline signals measured there), so this report shows stories, brands and patterns but no sector signal numbers.`,
    signals, contrast: { risingHere, risingElsewhere }, whiteSpace, counterMoves, leaders, patterns: i.patterns,
    stories: quarter.slice(0, SECTOR_STORIES_MAX).map(storyLine), storiesInQuarter: quarter.length,
    basis: `Based on ${sites.length} brands tracked in ${name} and ${i.run ? `the forecast run of ${longDate(i.run.at)} (run ${i.run.id})` : "no stored forecast run yet"}. Stage, share and Momentum are measured; stories link to their receipts.`,
    blocks: SECTOR_BLOCKS,
  };
}

/** /sectors: every sector with its coverage, covered ones first. */
export function sectorIndex(i: Omit<SectorInput, "sector" | "patterns" | "trendsetters">) {
  const q = quarterOf(i.now), stream = streamOf(i.stories);
  return i.sites.length || i.rows.length ? [...new Set(i.sites.map(s => s.sector))].sort().map(sector => {
    const c = sectorCoverage(i.rows, i.tiers, sector);
    return { sector, name: sectorName(sector), href: sectorPath(sector), brands: i.sites.filter(s => s.sector === sector).length, covered: c.covered, total: c.total, enough: c.enough,
      stories: stream.filter(s => s.sector === sector && s.type !== "launch" && s.happened_at >= q.start && s.happened_at < q.end).length };
  }).sort((a, b) => Number(b.enough) - Number(a.enough) || b.brands - a.brands || a.name.localeCompare(b.name)) : [];
}
