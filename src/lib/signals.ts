// Signal view model shared by the terminal, the Digest, embeds and MCP: tier, basis, Momentum index, Confidence and the so-what line,
// derived from the latest stored forecast rows. Pure; forecast numbers pass through unchanged.
import { basis, label, stageName, type Basis, type Dimension, type StageName } from "./labels";
import { classifyAll, tierCounts, type Tier, type TierResult, type TierStats } from "./tiers";
import { confidence, directionWord, momentumIndex, type ConfidenceLevel, type Direction } from "./momentum";
import { soWhat } from "./digest/copy";

export type SignalRow = { dimension: string; value: string; scope: string; status: string; stage: string | null; momentum: number | null; current_share: number | null; next_wave_score: number | null; present?: string[] | null; sites?: number | null; usable?: number | null; /** Latest stored quarter { q, n, s } (forecast-rows). */ sample?: unknown };
export type Signal = {
  key: string; name: string; dimension: Dimension; basis: Basis; tier: Tier; reasons: string[]; scope: string;
  stage: StageName | null; share: number | null; momentum: number | null; direction: Direction | null; next_wave_score: number | null;
  momentum_index: number | null; confidence: ConfidenceLevel; confidence_reason: string; so_what: string | null; sites: number | null; quarters: number | null; components: number;
};
/** The latest stored run as plain JSON: rows for every scope and the previous two runs' library-wide stages. */
export type SignalSnapshot = { run_id: number | null; computed_at: string | null; prev_runs: number[]; rows: SignalRow[]; prev: [string, (string | null)[]][] };
export const rowKey = (r: { dimension: string; value: string }) => `${r.dimension}:${r.value}`;

/** Tier results for every stored 'all' row (plus composites), using the previous two runs' stages for the MOVES question. */
export function tiersFrom(rows: SignalRow[], prevStages: Map<string, (string | null)[]>): Map<string, TierResult> {
  return classifyAll(rows.filter(r => r.scope === "all").map(r => ({ key: rowKey(r), stats: { status: r.status, stage: r.stage, momentum: r.momentum, sites: r.sites ?? null, prevStages: prevStages.get(rowKey(r)) ?? [] } satisfies TierStats })));
}

/** Signals for one scope. Momentum index ranks next-wave scores among headline + supporting signals in that scope. Sector rows borrow the library-wide tier and site count. */
export function buildSignals(rows: SignalRow[], tiers: Map<string, TierResult>, scope = "all"): Signal[] {
  const all = new Map(rows.filter(r => r.scope === "all").map(r => [rowKey(r), r]));
  const inScope = rows.filter(r => r.scope === scope);
  const shown = (k: string) => { const t = tiers.get(k)?.tier; return t === "headline" || t === "supporting"; };
  const scoreOf = (r: SignalRow) => (r.scope === "all" ? r.next_wave_score : all.get(rowKey(r))?.next_wave_score ?? null);
  const cohort = inScope.filter(r => shown(rowKey(r))).map(scoreOf);
  return inScope.map(r => {
    const key = rowKey(r), t = tiers.get(key), base = all.get(key) ?? r, l = label(key);
    const score = scoreOf(r), sites = r.scope === "all" ? r.sites ?? null : base.sites ?? null, quarters = r.usable ?? null, comps = (r.present ?? []).length;
    const c = confidence({ key, components: comps, sites, quarters });
    const stage = stageName(r.stage), tier = t?.tier ?? "archive";
    return { key, name: l.name, dimension: l.dimension, basis: basis(key), tier, reasons: t?.reasons ?? [], scope: r.scope, stage, share: r.current_share, momentum: r.momentum, direction: directionWord(r.momentum),
      next_wave_score: score, momentum_index: shown(key) ? momentumIndex(score, cohort) : null, confidence: c.level, confidence_reason: c.reason, so_what: tier === "headline" ? soWhat(key, r.stage) : null, sites, quarters, components: comps };
  });
}
/** Default lists show headline signals only; the All signals view picks one tier. */
export const headlineOnly = <T extends { tier: Tier }>(xs: T[]) => xs.filter(x => x.tier === "headline");
export const ofTier = <T extends { tier: Tier }>(xs: T[], tier: Tier) => xs.filter(x => x.tier === tier);
export { tierCounts };
/** Momentum in words for receipts: "72 · Rising". */
export const momentumText = (s: Pick<Signal, "momentum_index" | "direction">) => `${s.momentum_index ?? "—"}${s.direction ? ` · ${s.direction}` : ""}`;
