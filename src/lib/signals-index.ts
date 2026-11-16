// THE SIGNALS INDEX (/signals), pure: one ranked list grouped by tier (Headline, Supporting, then Archive folded), each row with its
// stage, share now, an unfiltered sparkline of well-covered quarters, Momentum and basis. The sector lens reorders by that sector's
// share and shows it beside all sectors; sort, dimension filter and lens round-trip through the URL.
import type { Signal } from "./signals";
import type { LensResult } from "./sector-lens";
import { resolveSector } from "./sector-lens";
import { SIGNAL_TABS, resolveSignalTab, signalPath, signalTabOf, type SignalTab } from "./ia";
import { TIERS, TIER_WORD, type Tier } from "./tiers";
import { sectorName, type Basis, type StageName } from "./labels";
import { NEXT_WAVE_MAX_SHARE, NEXT_WAVE_MIN_SITES } from "./forecast-signals";

export const SIGNAL_SORTS = [{ id: "momentum", label: "Momentum" }, { id: "share", label: "Share now" }, { id: "change", label: "Change" }] as const;
export type SignalSort = (typeof SIGNAL_SORTS)[number]["id"];
/** Rows sent on the default view per tier (the rest come with ?tier=archive, the full list), so the page stays under its HTML budget. */
export const FIRST_ROWS: Record<Tier, number> = { headline: Infinity, supporting: 15, archive: 0 };
export type SignalsView = { tab: SignalTab; sort: SignalSort; sector: string; archive: boolean };
export type SignalsSearch = { tab?: string; sort?: string; sector?: string; tier?: string };

/** With no sort chosen: Momentum across all sectors; the sector's share once a sector lens is on. */
export const defaultSort = (sector: string): SignalSort => (resolveSector(sector) === "all" ? "momentum" : "share");
export function parseSignalsSearch(s: SignalsSearch): SignalsView {
  const sector = resolveSector(s.sector), sort = SIGNAL_SORTS.some(x => x.id === s.sort) ? (s.sort as SignalSort) : defaultSort(sector);
  return { tab: resolveSignalTab(s.tab), sort, sector, archive: s.tier === "archive" };
}
/** The URL form of a view: defaults are left out, so the plain /signals link stays the plain view. */
export function signalsSearch(v: SignalsView): SignalsSearch {
  return { ...(v.tab !== "all" ? { tab: v.tab } : {}), ...(v.sort !== defaultSort(v.sector) ? { sort: v.sort } : {}), ...(v.sector !== "all" ? { sector: v.sector } : {}), ...(v.archive ? { tier: "archive" } : {}) };
}

export type SignalsRow = {
  key: string; rank: number; name: string; href: string; tier: Tier; tab: Exclude<SignalTab, "all">; stage: StageName | null; basis: Basis;
  /** Share now in the lens scope, and across all sectors when a sector lens is on. */
  share: number | null; allShare: number | null;
  /** Momentum is scored across all sectors only: with a sector lens on, this is the all-sector value and `momentumAll` is true. */
  momentum: number | null; momentumAll: boolean;
  /** Well-covered quarterly shares (all sectors, unfiltered by the lens) and the change from the first to the last. */
  points: number[]; change: number | null;
};
/** "Momentum 75", "Momentum 75, all sectors" under a lens; null (an empty slot) when the run has no score: the count line says why, once. */
export const momentumText = (r: Pick<SignalsRow, "momentum" | "momentumAll">) => (r.momentum == null ? null : `Momentum ${r.momentum}${r.momentumAll ? ", all sectors" : ""}`);
/** Why a signal has no Momentum: the forecast scores the next wave only below a mainstream share and above a minimum of sites. */
export const MOMENTUM_NEEDS = `a share under ${Math.round(NEXT_WAVE_MAX_SHARE * 100)}% across all sectors and at least ${NEXT_WAVE_MIN_SITES} tracked sites; signals already that common have no next wave to score`;
export const NOT_SCORED_RULE = "Not scored";
/** `unscoredFrom`: under the Momentum sort, the index of the first row without a score (they go last, under one "Not scored" rule). */
/** `rows` are the rows sent (see FIRST_ROWS); `count` is how many the tier has. */
export type SignalsGroup = { tier: Tier; title: string; rows: SignalsRow[]; count: number; folded: boolean; unscoredFrom: number | null };
/** Change over the well-covered quarters: last minus first, or null with fewer than two quarters. */
export const changeOf = (pts: readonly number[]) => (pts.length >= 2 ? pts[pts.length - 1]! - pts[0]! : null);
const desc = (a: number | null, b: number | null) => (b ?? -Infinity) - (a ?? -Infinity);

export function signalsIndex(i: { all: Signal[]; lens: LensResult; series: Record<string, number[]> }, v: SignalsView) {
  const allBy = new Map(i.all.map(s => [s.key, s])), scoped = i.lens.scope !== "all";
  const rows = i.lens.signals.filter(s => v.tab === "all" || signalTabOf(s.key, s.dimension) === v.tab).map(s => {
    const points = i.series[s.key] ?? [];
    return { key: s.key, name: s.name, href: signalPath(s.key), tier: s.tier, tab: signalTabOf(s.key, s.dimension), stage: s.stage, basis: s.basis,
      share: s.share, allShare: scoped ? allBy.get(s.key)?.share ?? null : null,
      momentum: scoped ? allBy.get(s.key)?.momentum_index ?? null : s.momentum_index, momentumAll: scoped, points, change: changeOf(points) };
  });
  const by = (a: Omit<SignalsRow, "rank">, b: Omit<SignalsRow, "rank">) =>
    (v.sort === "share" ? desc(a.share, b.share) : v.sort === "change" ? desc(a.change, b.change) : desc(a.momentum, b.momentum))
    || desc(a.momentum, b.momentum) || desc(a.share, b.share) || a.name.localeCompare(b.name);
  const full = TIERS.map(t => ({ t, rs: rows.filter(r => r.tier === t).sort(by).map((r, k) => ({ ...r, rank: k + 1 })) }));
  const n = (t: Tier) => full.find(g => g.t === t)!.rs.length;
  // The first screen: every headline row, the first SUPPORTING_FIRST supporting rows, archive folded with its count only. ?tier=archive sends all.
  const groups: SignalsGroup[] = full.map(({ t, rs }) => {
    const shownRows = v.archive ? rs : rs.slice(0, FIRST_ROWS[t]), first = shownRows.findIndex(r => r.momentum == null);
    return { tier: t, title: TIER_WORD[t].toLowerCase().replace(/^./, c => c.toUpperCase()), folded: t === "archive" && !v.archive, rows: shownRows, count: rs.length, unscoredFrom: v.sort === "momentum" && first >= 0 ? first : null };
  });
  const where = [v.tab !== "all" ? SIGNAL_TABS.find(x => x.id === v.tab)!.label : null, v.sector !== "all" ? sectorName(v.sector) : null].filter(Boolean).join(", ");
  const sortWord = `${SIGNAL_SORTS.find(x => x.id === v.sort)!.label.toLowerCase()}${v.sort === "momentum" && scoped ? " across all sectors" : ""}`;
  const countLine = `${n("headline")} headline and ${n("supporting")} supporting ${n("headline") + n("supporting") === 1 ? "signal" : "signals"}${where ? ` in ${where}` : ""}, by ${sortWord}; ${n("archive")} archive ${n("archive") === 1 ? "signal" : "signals"} ${v.archive ? "shown" : "folded"}.`;
  const shown = full.filter(g => g.t !== "archive").flatMap(g => g.rs), scored = shown.filter(r => r.momentum != null).length;
  const momentumLine = shown.length && scored < shown.length ? `Momentum is scored for ${scored} of ${shown.length}; it needs ${MOMENTUM_NEEDS}.` : null;
  return { groups, countLine: momentumLine ? `${countLine} ${momentumLine}` : countLine, momentumLine, view: v, scope: i.lens.scope, scoped, note: i.lens.note };
}
export type SignalsIndex = ReturnType<typeof signalsIndex>;
