// "What we show and why": copy generated from tiers.ts, composites.ts and momentum.ts, shared by /what-we-show and the MCP methodology. Pure.
import { CATEGORY_JUDGMENT, COVERAGE_MIN_SITES, KEY_OVERRIDES, MOVES_DEADBAND_PTS, TIERS, classifyAll, type Tier, type TierResult } from "./tiers";
import { COMPOSITES, DROPPED_COMPOSITES, ruleText } from "./composites";
import { CONFIDENCE, DIRECTION_CUTS } from "./momentum";
import { NAMES, basis, label } from "./labels";

export const JOBS = [
  { id: "spot", word: "Spot", line: "What is changing: headline signals that are visible, decision-worthy, well measured and moving." },
  { id: "prove", word: "Prove", line: "Who is doing it: the sites, sectors and supporting measurements behind each headline." },
  { id: "act", word: "Act", line: "Where the opening is: stage, Momentum and Confidence say whether to move now, wait, or differentiate." },
] as const;
export const QUESTIONS = [
  { id: "visible", word: "Visible", line: "Can a site visitor see it? Build plumbing (frameworks, site builders, most CSS techniques) is invisible, so it stays in the archive unless it produces a visible effect." },
  { id: "decision", word: "Decision", line: "Would a brand, marketing or design lead decide something because of it? Defaults and residual values (an image hero, no AI positioning, cookie banners) are not decisions." },
  { id: "coverage", word: "Coverage", line: `Does the forecast measure it on enough sites? It needs a fitted curve (4 usable quarters with 15+ sites and 25% coverage) and at least ${COVERAGE_MIN_SITES} sites in the latest sample.` },
  { id: "moves", word: "Moves", line: `Is it moving? Its stage is not Steady, or momentum is beyond ±${MOVES_DEADBAND_PTS} points a quarter (the forecast's own flat dead-band), or its stage changed within the last two runs.` },
] as const;
export const TIER_LINES: Record<Tier, string> = {
  headline: "All four answers are yes. Shown by default on TODAY, Signals, every panel, the Digest, the chart of the week and wire alerts.",
  supporting: "Visible and decision-worthy but thin or not moving, or a fine measurement bucket (pixel bands, column counts, radius buckets, Google Fonts popularity). Shown as evidence inside a headline signal's drawer, explainer and in audits.",
  archive: "Build plumbing and residual values. Still collected and never deleted; reachable through All signals and MCP.",
};
export const COMPOSITE_LINE = "Composites roll fragments into ideas people say out loud. Each is computed per site from stored data and runs through the unchanged forecast, so it has share history, a stage, momentum and a forecast. A composite that passes the tier rules is a headline, and its member fragments drop to supporting so one idea is never shown twice.";
export const BASIS_LINE = "MEASURED values are read from each page's code and rendered styles. AI ESTIMATE values are read by our AI tagger from homepage captures (or by our AI reader from pricing pages); a composite is an AI estimate if any member is.";
export const MOMENTUM_LINE = `Momentum is one 0–100 figure: the percentile rank of the stored next-wave score among headline and supporting signals in the same scope and run. Its word comes from stored momentum: Rising fast (≥ +${DIRECTION_CUTS.fast} points a quarter), Rising (> +${DIRECTION_CUTS.flat}), Flat, or Falling (< −${DIRECTION_CUTS.flat}). The seven score parts stay one click away in each receipt.`;
export const CONFIDENCE_LINE = `Confidence is High with ${CONFIDENCE.High.components}+ of 7 score parts measured, ${CONFIDENCE.High.sites}+ sites and ${CONFIDENCE.High.quarters}+ usable quarters; Medium with ${CONFIDENCE.Medium.components}+ parts, ${CONFIDENCE.Medium.sites}+ sites and ${CONFIDENCE.Medium.quarters}+ quarters; Low otherwise. AI estimates never rise above ${CONFIDENCE.aiCap}.`;

export type ListedSignal = { key: string; name: string; dimension: string; basis: string; tier: Tier; reasons: string[] };
/** Every known signal key: forecast rows, the label map's named keys and composites, classified with the latest stats. */
export function signalList(tiers: Map<string, TierResult>): ListedSignal[] {
  const all = classifyAll([...new Set([...tiers.keys(), ...Object.keys(NAMES), ...COMPOSITES.map(c => c.key)])].map(key => ({ key, stats: null })));
  for (const [k, r] of tiers) all.set(k, r);
  return [...all.values()].map(r => { const l = label(r.key); return { key: r.key, name: l.name, dimension: l.dimension, basis: basis(r.key), tier: r.tier, reasons: r.reasons }; })
    .sort((a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) || a.dimension.localeCompare(b.dimension) || a.name.localeCompare(b.name));
}
/** Open-ended categories (named fonts, colors, words, vibe clusters) are listed once each with their category reason. */
export const OPEN_CATEGORIES = ["family", "h1_font", "body_font", "color", "accent", "h1_word", "vibe"].map(c => ({ category: c, ...CATEGORY_JUDGMENT[c]! }));
export const OVERRIDE_COUNT = Object.keys(KEY_OVERRIDES).length;
export const methodologyLines = () => [
  `TIERS: one file (tiers.ts) decides what is shown by default. Four questions per trait: ${QUESTIONS.map(q => `${q.word.toUpperCase()} — ${q.line}`).join(" ")} headline = all four; supporting = visible + decision but failing coverage or moves, plus fine measurement buckets; archive = everything else. ${TIER_LINES.archive} Tools that list signals accept an optional tier filter; outputs carry tier.`,
  `COMPOSITES: ${COMPOSITE_LINE} Current set: ${COMPOSITES.map(c => `${c.name} (combo:${c.id}, ${c.dimension}, ${c.rule === "all" ? "all of" : "any of"}: ${ruleText(c)})`).join("; ")}. Left out: ${DROPPED_COMPOSITES.map(d => `${d.name} — ${d.why}`).join(" ")}`,
  `MOMENTUM AND CONFIDENCE: ${MOMENTUM_LINE} ${CONFIDENCE_LINE} Display only: no forecast number changes. ${BASIS_LINE}`,
];
