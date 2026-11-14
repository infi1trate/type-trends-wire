// Pure supply signal: new Google Fonts families per category and Product Hunt launches using a trait. No I/O.
export const SUPPLY_WINDOW_DAYS = 90;
export const FLOODING_MULTIPLE = 2, FLOODING_MIN_PH = 5, FLATTENING_MOMENTUM = 0.5;
export type FirstSeen = { family: string; category: string | null; first_seen: string };
export type GfAdditions = { category: string; last90: number; prior90: number | null; history_start: string | null; history_days: number; note: string | null };
const DAY = 864e5;

/** Additions = families first seen after the first snapshot day (earlier ones have unknown add dates). Prior window needs 180 days of history. */
export function gfAdditions(rows: FirstSeen[], category: string, now: number): GfAdditions {
  const start = rows.reduce<string | null>((m, r) => (m === null || r.first_seen < m ? r.first_seen : m), null);
  const startMs = start ? Date.parse(`${start}T00:00:00Z`) : NaN, history = Number.isNaN(startMs) ? 0 : Math.floor((now - startMs) / DAY);
  const added = rows.filter(r => r.category === category && start !== null && r.first_seen > start).map(r => Date.parse(`${r.first_seen}T00:00:00Z`));
  const w = SUPPLY_WINDOW_DAYS * DAY, last90 = added.filter(t => t > now - w && t <= now).length;
  const prior90 = history >= 2 * SUPPLY_WINDOW_DAYS ? added.filter(t => t > now - 2 * w && t <= now - w).length : null;
  return { category, last90, prior90, history_start: start, history_days: history, note: prior90 === null ? `Google Fonts first-seen history covers ${history} days; additions need 180` : null };
}
/** Net new supply: Δ additions (last 90 vs prior 90) + Product Hunt launches whose crawled site shows the trait. Null when neither is measurable. */
export function supplyValue(gf: GfAdditions | null, phSites: number | null): number | null {
  const gfDelta = gf && gf.prior90 !== null ? gf.last90 - gf.prior90 : null;
  if (gfDelta === null && !phSites) return null;
  return (gfDelta ?? 0) + (phSites ?? 0);
}
/** Marketplace flooding: supply surging while adoption momentum flattens — a late-stage sign. */
export function isFlooding(gf: GfAdditions | null, phSites: number | null, stage: string | null, momentum: number | null): boolean {
  const surging = (gf !== null && gf.prior90 !== null && gf.last90 >= FLOODING_MULTIPLE * Math.max(1, gf.prior90)) || (phSites ?? 0) >= FLOODING_MIN_PH;
  const flattening = stage === "peaking" || stage === "flat" || stage === "declining" || (momentum !== null && momentum < FLATTENING_MOMENTUM);
  return surging && flattening;
}
export const FLOODING_NOTE = "Marketplace flooding: new supply is surging while momentum flattens — late stage, leaning toward peaking.";
