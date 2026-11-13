// Pure band classification. Phase 3 (MCP) mirrors this logic — keep it dependency-free.

export type Band = "BASELINE" | "RISING" | "PEAKING" | "RETURNING" | "FADING" | "STEADY";

export interface RankPoint {
  captured_on: string; // yyyy-mm-dd
  popularity_rank: number;
  trending_rank: number;
}

export interface BandResult {
  band: Band;
  reason: string;
  delta7: number | null;
  delta28: number | null;
}

export const BASELINE_DAYS = 42;

const DAY = 86_400_000;
const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
export const daysBetween = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / DAY);

/** Latest point at least `days` older than `latestDate`. History must be sorted ascending. */
export function pointAtLeast(history: RankPoint[], latestDate: string, days: number): RankPoint | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const p = history[i]!;
    if (daysBetween(p.captured_on, latestDate) >= days) return p;
  }
  return null;
}

/** Positive = climbed that many places (old rank minus new rank). */
export const climb = (oldRank: number, newRank: number) => oldRank - newRank;

export const moveThreshold = (oldRank: number) => Math.max(5, 0.05 * oldRank);

/**
 * Classify a family from its popularity/trending history.
 * `firstDate` overrides the first snapshot date when the history passed in is sparse.
 */
export function computeBand(history: RankPoint[], opts: { firstDate?: string } = {}): BandResult {
  const sorted = [...history].sort((a, b) => a.captured_on.localeCompare(b.captured_on));
  if (sorted.length === 0) {
    return { band: "BASELINE", reason: `Collecting history: 0 of ${BASELINE_DAYS} days`, delta7: null, delta28: null };
  }
  const cur = sorted[sorted.length - 1]!;
  const first = opts.firstDate ?? sorted[0]!.captured_on;
  const p7 = pointAtLeast(sorted, cur.captured_on, 7);
  const p14 = pointAtLeast(sorted, cur.captured_on, 14);
  const p28 = pointAtLeast(sorted, cur.captured_on, 28);
  const delta7 = p7 ? climb(p7.popularity_rank, cur.popularity_rank) : null;
  const delta28 = p28 ? climb(p28.popularity_rank, cur.popularity_rank) : null;

  const span = daysBetween(first, cur.captured_on);
  if (span < BASELINE_DAYS || !p28) {
    return {
      band: "BASELINE",
      reason: `Collecting history: ${Math.max(0, span)} of ${BASELINE_DAYS} days`,
      delta7,
      delta28,
    };
  }

  const thr = moveThreshold(p28.popularity_rank);
  const c28 = delta28 ?? 0;

  if (c28 >= thr && cur.trending_rank <= 200) {
    return { band: "RISING", reason: `Climbed ${c28} places in 28d; trending #${cur.trending_rank}`, delta7, delta28 };
  }
  const trendWorsened = cur.trending_rank - p28.trending_rank;
  if (cur.popularity_rank <= 100 && trendWorsened >= 50) {
    return {
      band: "PEAKING",
      reason: `Top-100 usage but momentum fell ${trendWorsened} places in 28d`,
      delta7,
      delta28,
    };
  }
  if (-c28 >= thr) {
    const lastWeek = p7 ? climb(p7.popularity_rank, cur.popularity_rank) : 0;
    const weekBefore = p7 && p14 ? climb(p14.popularity_rank, p7.popularity_rank) : 0;
    if (lastWeek > 0 && weekBefore > 0) {
      return {
        band: "RETURNING",
        reason: `Down ${-c28} in 28d but climbing two weeks running`,
        delta7,
        delta28,
      };
    }
    return { band: "FADING", reason: `Dropped ${-c28} places in 28d`, delta7, delta28 };
  }
  return { band: "STEADY", reason: "No significant 28d move", delta7, delta28 };
}

export const METHODOLOGY = [
  "FORECAST (F10): logistic vs linear fits on quarterly shares (N≥15, coverage≥25%, ≥4 usable quarters), 80% bootstrap cones, stage rules, trendsetter/next-wave scores and a 2025Q2 backtest model card. AI-written brief cites computed evidence. Correlation, not causation.",
  "Bands compare a family's newest snapshot with the latest snapshot at least 7, 14 and 28 days older.",
  "Positive change = places climbed (old rank minus new rank). Rank 1 = most used.",
  "Threshold = max(5, 5% of the old rank).",
  `BASELINE — fewer than ${BASELINE_DAYS} days between first and latest snapshot.`,
  "RISING — 28d popularity climb ≥ threshold AND trending rank ≤ 200.",
  "PEAKING — popularity rank ≤ 100 AND trending rank worsened ≥ 50 places over 28d.",
  "RETURNING — 28d drop ≥ threshold but climbed in both the last 7 days and the 7 days before.",
  "FADING — 28d drop ≥ threshold.",
  "STEADY — everything else.",
];
