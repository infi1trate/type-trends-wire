// One Momentum figure and one Confidence word per signal, derived only from stored forecast fields. Display only: no forecast number changes. Pure.
import { basis } from "./labels";
import { COMPONENT_KEYS } from "./forecast-signals";

/** Direction words from stored momentum (points of share per quarter). Flat uses the forecast's own dead-band (tiers.MOVES_DEADBAND_PTS). */
export const DIRECTION_CUTS = { fast: 2, flat: 0.5 } as const;
export type Direction = "Rising fast" | "Rising" | "Flat" | "Falling";
export function directionWord(momentum: number | null | undefined): Direction | null {
  if (momentum == null || !Number.isFinite(momentum)) return null;
  if (momentum >= DIRECTION_CUTS.fast) return "Rising fast";
  if (momentum > DIRECTION_CUTS.flat) return "Rising";
  if (momentum < -DIRECTION_CUTS.flat) return "Falling";
  return "Flat";
}

/** Momentum index 0–100: percentile rank of a stored next-wave score among the cohort (headline + supporting signals, same scope, same run). */
export function momentumIndex(score: number | null | undefined, cohort: (number | null | undefined)[]): number | null {
  if (score == null || !Number.isFinite(score)) return null;
  const v = cohort.filter((x): x is number => x != null && Number.isFinite(x));
  if (!v.includes(score)) v.push(score);
  if (v.length === 1) return 50;
  const below = v.filter(x => x < score).length, ties = v.filter(x => x === score).length - 1;
  return Math.round(((below + ties / 2) / (v.length - 1)) * 100);
}

/** Confidence thresholds. A level needs every minimum; AI estimates never rise above Medium. */
export const CONFIDENCE = {
  High: { components: 3, sites: 30, quarters: 5 }, // three or more of the seven score parts measured, 30+ sites, 5+ usable quarters
  Medium: { components: 2, sites: 10, quarters: 4 }, // the forecast's own minimum of 4 usable quarters
  aiCap: "Medium",
} as const;
export type ConfidenceLevel = "High" | "Medium" | "Low";
export type ConfidenceInput = { key: string; components: number; sites: number | null; quarters: number | null };
export function confidence(i: ConfidenceInput): { level: ConfidenceLevel; reason: string } {
  const sites = i.sites ?? 0, quarters = i.quarters ?? 0, ai = basis(i.key) === "ai";
  const meets = (t: { components: number; sites: number; quarters: number }) => i.components >= t.components && sites >= t.sites && quarters >= t.quarters;
  let level: ConfidenceLevel = meets(CONFIDENCE.High) ? "High" : meets(CONFIDENCE.Medium) ? "Medium" : "Low";
  const capped = ai && level === "High";
  if (capped) level = CONFIDENCE.aiCap;
  const facts = `${i.components} of ${COMPONENT_KEYS.length} components, ${sites} site${sites === 1 ? "" : "s"}, ${quarters} quarter${quarters === 1 ? "" : "s"}`;
  return { level, reason: `${level}: ${facts}${ai ? capped ? ", AI estimate (capped at Medium)" : ", AI estimate" : ""}` };
}
