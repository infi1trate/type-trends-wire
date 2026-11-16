// Signal tiers: one file decides what deserves a reader's attention. Pure.
// Four questions per trait: VISIBLE (can a site visitor see it?), DECISION (would a brand, marketing or design lead decide
// something because of it?), COVERAGE (does the forecast measure it on enough sites?), MOVES (is it moving?).
// headline = all four; supporting = visible + decision but failing coverage or moves, plus the static evidence set; archive = the rest.
// VISIBLE and DECISION are editorial and static (per category, per-key overrides, one reason each). COVERAGE and MOVES come from
// the latest stored forecast row using the forecast's own thresholds. Collect wide, show narrow: tiers only change what is shown.
import { canonical, label, stageName } from "./labels";
import { COMPOSITES, compositesWith, isComposite } from "./composites";
import { NEXT_WAVE_MIN_SITES } from "./forecast-signals";

export const TIERS = ["headline", "supporting", "archive"] as const;
export type Tier = (typeof TIERS)[number];
export const TIER_WORD: Record<Tier, string> = { headline: "HEADLINE", supporting: "SUPPORTING", archive: "ARCHIVE" };

/** visible + decision answer questions (a) and (b); evidence marks fine measurement buckets that back up a headline (supporting at most). */
export type Judgment = { visible: boolean; decision: boolean; evidence?: boolean; why: string };
const yes = (why: string): Judgment => ({ visible: true, decision: true, why });
const evidence = (why: string): Judgment => ({ visible: true, decision: true, evidence: true, why });
const plumbing = (why: string): Judgment => ({ visible: false, decision: false, why });
const residual = (why: string): Judgment => ({ visible: true, decision: false, why });

/** Per-category starting position. Every category the app knows is listed; unknown categories fall to the archive. */
export const CATEGORY_JUDGMENT: Record<string, Judgment> = {
  // FONT
  font: yes("Custom versus system fonts is a brand-level type decision visitors can see."),
  headline: yes("Headline typeface style is the most visible type decision on a page."),
  tracking: yes("Headline letter spacing is a visible type choice."),
  type: yes("Monospace type is a visible style choice."),
  h1_case: yes("All-caps headlines are a visible type choice."),
  h1_font: yes("A named headline typeface seen on homepages is a concrete type decision."),
  body_font: yes("A named body typeface seen on homepages is a concrete type decision."),
  family: evidence("Google Fonts popularity is supply-side: it shows what designers browse, not what brands ship. Shown on a font's own page, never as a headline row."),
  h1_size: evidence("Headline pixel bands are measurement detail; they back up Big type."),
  h1_tracking: evidence("Headline spacing buckets are measurement detail behind tight headline spacing."),
  // COLOR
  theme: yes("Light or dark mode is the first thing a visitor sees."),
  color_mood: yes("Palette mood is a visible brand-color decision."),
  color: yes("A named page color is a visible brand-color decision."),
  accent: yes("A named accent color is a visible brand-color decision."),
  // LAYOUT
  hero_media: yes("What fills the first screen is a visible art-direction decision."),
  hero_layout: yes("The first-screen layout is a visible page-structure decision."),
  components: yes("Homepage sections are visible page-structure decisions."),
  css: plumbing("Stylesheet technique: visitors see the page, not the CSS feature that built it."),
  framework: plumbing("Which framework or site builder is used is invisible to visitors and rarely a brand decision."),
  tech: plumbing("Which library or platform is used is invisible to visitors and rarely a brand decision."),
  h1_align: evidence("Headline alignment buckets are layout detail; evidence for hero signals."),
  grid_cols: evidence("Column counts are measurement detail; evidence for layout signals."),
  cta_shape: evidence("Button corner-radius buckets are measurement detail; they back up Soft UI."),
  whitespace: evidence("Whitespace thresholds are measurement detail; they back up Soft UI and Quiet minimalism."),
  // VIBE
  aesthetic: yes("The overall look is the art-direction decision teams argue about."),
  tone: yes("Voice is a visible copy and brand decision."),
  imagery: yes("The kind of imagery is a visible art-direction decision."),
  ai_positioning: yes("How loudly a brand leads with AI is a visible positioning decision."),
  pricing: yes("The pricing model on show is a visible marketing decision."),
  h1_word: yes("Words brands put in headlines are visible copy decisions."),
  vibe: evidence("Vibe-map cluster names summarize other tags; shown on the vibe map, not as rows."),
  combo: yes("A composite of fragments that people name out loud."),
};

/** Per-key overrides of the category judgment. Each line is a reviewable editorial call. */
export const KEY_OVERRIDES: Record<string, Judgment> = {
  // Visitor-visible effects promoted out of css:* / tech:* plumbing.
  "css:scroll_timeline": yes("Visitors see sections animate as they scroll."),
  "css:view_transitions": yes("Visitors see animated page-to-page transitions."),
  "css:backdrop_filter": yes("Visitors see frosted-glass panels."),
  "css:variable_fonts": yes("Visitors see type that shifts weight and width; a type-system decision."),
  "css:starting_style": yes("Visitors see elements animate in as the page loads."),
  "tech:gsap": yes("GSAP drives visible motion: scroll and entrance animation."),
  "tech:lottie": yes("Visitors see Lottie vector animations."),
  "tech:three": yes("Visitors see real-time 3D."),
  "tech:webgl_canvas": yes("Visitors see a live WebGL canvas."),
  "tech:lenis": yes("Visitors feel smoothed scrolling."),
  // Residual or default values: visible, but not a decision anyone makes.
  "hero_media:image": residual("A still image hero is the default, not a choice."),
  "hero_media:none": residual("No hero media is a residual value, not a choice."),
  "imagery:none": residual("No imagery is a residual value, not a choice."),
  "ai_positioning:none": residual("No AI positioning is the residual value."),
  "h1_case:other": residual("Mixed-case headlines are the default, not a choice."),
  "cta_shape:none": residual("No button is a residual value."),
  "components:cookie_banner": residual("Cookie banners are legal compliance, not a design or brand choice."),
  // Standard page furniture: real sections, but routine; evidence for page-structure signals rather than headlines.
  "components:newsletter_signup": evidence("Newsletter sign-ups are standard page furniture; evidence, not a headline."),
  "components:faq_accordion": evidence("FAQ accordions are standard page furniture; evidence, not a headline."),
  "components:map": evidence("Maps are standard page furniture; evidence, not a headline."),
  "components:pricing_table": evidence("Pricing tables are standard page furniture; evidence, not a headline."),
  "components:comparison_table": evidence("Comparison tables are standard page furniture; evidence, not a headline."),
  "components:team_grid": evidence("Team grids are standard page furniture; evidence, not a headline."),
  "components:cta_band": evidence("Call-to-action bands are standard page furniture; evidence, not a headline."),
  "components:feature_grid": evidence("Feature grids are standard page furniture; evidence, not a headline."),
  "components:alternating_feature_rows": evidence("Alternating feature rows are standard page furniture; evidence, not a headline."),
  "whitespace:median": evidence("The median whitespace ratio is a measure, not a share; evidence only."),
};

export type JudgmentSource = "category" | "override" | "unknown";
export function judgment(raw: string): Judgment & { key: string; source: JudgmentSource } {
  const key = canonical(raw), cat = key.includes(":") ? key.slice(0, key.indexOf(":")) : "";
  if (KEY_OVERRIDES[key]) return { ...KEY_OVERRIDES[key]!, key, source: "override" };
  if (CATEGORY_JUDGMENT[cat]) return { ...CATEGORY_JUDGMENT[cat]!, key, source: "category" };
  return { visible: false, decision: false, why: "Unknown signal type, kept in the archive until it is classified.", key, source: "unknown" };
}

/** Flat dead-band in points per quarter: classifyStage's linear growth floor (0.005 share/quarter) in forecast.ts. */
export const MOVES_DEADBAND_PTS = 0.5;
/** Coverage = the forecast fitted a curve (status ok: 15+ sites, 25% coverage, 4 usable quarters) on at least NEXT_WAVE_MIN_SITES sites now. */
export const COVERAGE_MIN_SITES = NEXT_WAVE_MIN_SITES;

export type TierStats = { status: string | null; stage: string | null; momentum: number | null; sites: number | null; prevStages?: (string | null)[] };
export type TierChecks = { visible: boolean; decision: boolean; coverage: boolean; moves: boolean };
export type TierResult = { key: string; tier: Tier; reasons: string[]; checks: TierChecks; evidence: boolean; demotedBy?: string[] };

export function coverageCheck(s: TierStats | null): { ok: boolean; why: string } {
  if (!s) return { ok: false, why: "Not forecast: measured by the crawl or another source only, so there is no share history to stage." };
  if (s.status !== "ok") return { ok: false, why: "Too little coverage: the forecast needs 4 usable quarters with 15+ sites and 25% coverage." };
  if ((s.sites ?? 0) < COVERAGE_MIN_SITES) return { ok: false, why: `Seen on ${s.sites ?? 0} site${s.sites === 1 ? "" : "s"} in the latest sample; the forecast needs at least ${COVERAGE_MIN_SITES}.` };
  return { ok: true, why: `Seen on ${s.sites} sites with a fitted forecast.` };
}
export function movesCheck(s: TierStats | null): { ok: boolean; why: string } {
  if (!s || s.status !== "ok") return { ok: false, why: "No fitted curve, so movement can't be judged." };
  const st = stageName(s.stage), m = s.momentum;
  if (st && st !== "Steady") return { ok: true, why: `Moving: stage ${st}.` };
  if (m !== null && Math.abs(m) > MOVES_DEADBAND_PTS) return { ok: true, why: `Moving: ${m > 0 ? "+" : "−"}${Math.abs(m).toFixed(1)} points a quarter.` };
  const seen = [s.stage, ...(s.prevStages ?? [])].filter((x): x is string => !!x).map(x => stageName(x));
  if (new Set(seen).size > 1) return { ok: true, why: "Moving: its stage changed within the last two runs." };
  return { ok: false, why: `Not moving: Steady, ${m == null ? "no momentum" : `${m >= 0 ? "+" : "−"}${Math.abs(m).toFixed(1)} points a quarter`}, same stage over the last two runs.` };
}

/** One trait, before composite demotion. */
export function classifyTrait(raw: string, stats: TierStats | null): TierResult {
  const j = judgment(raw), cov = coverageCheck(stats), mov = movesCheck(stats);
  const checks: TierChecks = { visible: j.visible, decision: j.decision, coverage: cov.ok, moves: mov.ok };
  const reasons = [j.why];
  let tier: Tier;
  if (!j.visible || !j.decision) tier = "archive";
  else if (j.evidence) { tier = "supporting"; }
  else { reasons.push(cov.why); if (cov.ok) reasons.push(mov.why); tier = cov.ok && mov.ok ? "headline" : "supporting"; }
  return { key: j.key, tier, reasons, checks, evidence: !!j.evidence };
}

/** All traits at once: classify, then headline composites demote their headline member fragments to supporting so one idea shows once. */
export function classifyAll(entries: { key: string; stats: TierStats | null }[]): Map<string, TierResult> {
  const out = new Map<string, TierResult>();
  for (const e of entries) { const r = classifyTrait(e.key, e.stats); out.set(r.key, r); }
  for (const c of COMPOSITES) out.has(c.key) || out.set(c.key, classifyTrait(c.key, null));
  for (const c of COMPOSITES) {
    if (out.get(c.key)?.tier !== "headline") continue;
    for (const m of c.memberKeys) {
      const r = out.get(m) ?? classifyTrait(m, null);
      if (r.tier === "headline") out.set(m, { ...r, tier: "supporting", demotedBy: [...(r.demotedBy ?? []), c.key], reasons: [...r.reasons, `Shown inside ${label(c.key).name}, so the same idea isn't shown twice.`] });
      else if (!out.has(m)) out.set(m, r);
    }
  }
  return out;
}
export const headlineKeys = (entries: { key: string; stats: TierStats | null }[]) => new Set([...classifyAll(entries).values()].filter(r => r.tier === "headline").map(r => r.key));
/** Wire alerts may only be raised for headline signals. Existing alerts are untouched. */
export const restrictToHeadline = <A extends { trait: string }>(candidates: A[], headline: Set<string>) => candidates.filter(a => headline.has(canonical(a.trait)));
export const tierCounts = (m: Map<string, TierResult>) => Object.fromEntries(TIERS.map(t => [t, [...m.values()].filter(r => r.tier === t).length])) as Record<Tier, number>;
/** Supporting evidence for a signal's drawer/explainer: a composite's members, otherwise the composites it belongs to. */
export const evidenceKeys = (key: string) => (isComposite(key) ? COMPOSITES.find(c => c.key === key)?.memberKeys ?? [] : compositesWith(canonical(key)).map(c => c.key));
/** Tier for any key (spread aliases and crawl-only keys included): the stored result when the forecast has one, else the static judgment. */
export const tierFor = (tiers: Map<string, TierResult> | undefined, raw: string): Tier => { const k = canonical(raw); return tiers?.get(k)?.tier ?? classifyAll([{ key: k, stats: null }]).get(k)!.tier; };
