// The stored data a data story draws from, and the shared coverage rule. Pure: the server loads `DataInput`, everything else is math.
import { forecastSiteTraits, type SiteRow } from "../forecast-signals";
import { COMPOSITES, compositeOf, isTagged } from "../composites";
import { THRESHOLDS, qIndex } from "../forecast";
import { basis } from "../labels";
import type { CropRow } from "../crops";

export type SiteInfo = { domain: string; name: string | null; sector: string; active: boolean };
/** One sample per brand per quarter (library_site_history): the forecast's own per-site rows. */
export type HistRow = SiteRow & { captured_at: string | null; source: string | null; now?: boolean | null; snapshot_id: number | null; page_bg?: string | null; accent?: string | null };
/** Per snapshot: whether a skeleton was stored (it can be redrawn) and its palette (hex + share of the first screen). */
export type SnapMeta = { id: number; skeleton: boolean; palette: { hex: string; share: number }[] };
/** A measured, dated change on a homepage (library_events), and a confirmed rebrand (Rebrand desk). */
export type EventRow = { id: number; domain: string; type: string; source: string; at: string; snapshot_id: number | null };
export type RebrandRow = { id: string; domain: string; at: string; source: string };
/** Every stored home/desktop capture (when and where from), so change rates can be read per compared capture. */
export type CaptureStamp = { domain: string; at: string; source: string };
export type HeadlineSignal = { key: string; name: string };
export type DataInput = {
  now: number; sites: SiteInfo[]; history: HistRow[]; snaps: SnapMeta[]; captures: CaptureStamp[]; events: EventRow[]; rebrands: RebrandRow[];
  headline: HeadlineSignal[]; crops: CropRow[]; runId: number | null;
};

/**
 * The coverage rule, the forecast's own (usablePoints): a quarter counts when enough brands were sampled (15 for all sectors or a
 * pooled scope, 8 for one sector) and at least a quarter of the tracked brands in scope were sampled.
 */
export const usableRule = (sectors: readonly string[] | null) => ({ minDenom: sectors && sectors.length === 1 ? THRESHOLDS.denomSector : THRESHOLDS.denomAll, coverage: THRESHOLDS.coverage });
export const ruleText = (sectors: readonly string[] | null) => { const r = usableRule(sectors); return `Only well-covered quarters: at least ${r.minDenom} brands sampled and at least ${Math.round(r.coverage * 100)}% of the tracked brands in scope.`; };

const inScope = (sectors: readonly string[] | null) => (s: string) => !sectors || sectors.includes(s);
export const activeSites = (i: DataInput, sectors: readonly string[] | null) => i.sites.filter(s => s.active && inScope(sectors)(s.sector));
export const rowsIn = (i: DataInput, sectors: readonly string[] | null) => { const act = new Set(activeSites(i, sectors).map(s => s.domain)); return i.history.filter(r => act.has(r.domain)); };
export const byQuarter = (a: string, b: string) => qIndex(a) - qIndex(b);

export type Coverage = { q: string; denom: number; coverage: number; usable: boolean };
/** Every sampled quarter in scope with its denominator and coverage, oldest first. */
export function quarterCoverage(i: DataInput, sectors: readonly string[] | null): Coverage[] {
  const total = activeSites(i, sectors).length, rule = usableRule(sectors), n = new Map<string, number>();
  for (const r of rowsIn(i, sectors)) n.set(r.quarter, (n.get(r.quarter) ?? 0) + 1);
  return [...n].sort((a, b) => byQuarter(a[0], b[0])).map(([q, denom]) => { const coverage = total ? denom / total : 0; return { q, denom, coverage, usable: denom >= rule.minDenom && coverage >= rule.coverage }; });
}
export const usableQuarters = (i: DataInput, sectors: readonly string[] | null) => quarterCoverage(i, sectors).filter(c => c.usable).map(c => c.q);

/** Whether a row can answer for a key: measured keys always; AI keys only on AI-tagged captures (the forecast's denominator rule). */
export const knows = (key: string, r: HistRow) => { const c = compositeOf(key); const ai = c ? c.basis === "ai" : basis(key) === "ai"; return !ai || isTagged(r); };
const traitCache = new WeakMap<HistRow, Set<string>>();
export const traitsOf = (r: HistRow) => { let t = traitCache.get(r); if (!t) { t = new Set(forecastSiteTraits(r)); traitCache.set(r, t); } return t; };

export type SharePoint = { q: string; share: number; denom: number };
/** Share of brands in scope carrying `key`, per well-covered quarter (AI keys over AI-tagged brands only). */
export function shareSeries(i: DataInput, sectors: readonly string[] | null, key: string): SharePoint[] {
  const usable = new Set(usableQuarters(i, sectors)), hit = new Map<string, number>(), den = new Map<string, number>();
  for (const r of rowsIn(i, sectors)) {
    if (!usable.has(r.quarter) || !knows(key, r)) continue;
    den.set(r.quarter, (den.get(r.quarter) ?? 0) + 1);
    if (traitsOf(r).has(key)) hit.set(r.quarter, (hit.get(r.quarter) ?? 0) + 1);
  }
  return [...usable].filter(q => (den.get(q) ?? 0) > 0).sort(byQuarter).map(q => ({ q, share: (hit.get(q) ?? 0) / den.get(q)!, denom: den.get(q)! }));
}
export const compositeSeries = (i: DataInput, sectors: readonly string[] | null) => COMPOSITES.map(c => ({ key: c.key, name: c.name, points: shareSeries(i, sectors, c.key) }));

/** Snapshot metadata by id. */
export const snapIndex = (i: DataInput) => new Map(i.snaps.map(s => [s.id, s]));
/** Usable captures of one brand: distinct quarters whose stored capture kept a skeleton (so it can be redrawn). */
export function usableCaptures(i: DataInput, domain: string, snaps = snapIndex(i)): HistRow[] {
  return i.history.filter(r => r.domain === domain && r.snapshot_id != null && snaps.get(r.snapshot_id)?.skeleton).sort((a, b) => byQuarter(a.quarter, b.quarter));
}
export const nameOf = (i: DataInput) => { const m = new Map(i.sites.map(s => [s.domain, s.name ?? s.domain])); return (d: string) => m.get(d) ?? d; };
export const sectorOfSite = (i: DataInput) => { const m = new Map(i.sites.map(s => [s.domain, s.sector])); return (d: string) => m.get(d) ?? null; };
