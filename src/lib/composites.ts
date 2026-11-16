// Composite signals: fragments rolled up into ideas people say out loud. Pure.
// Each composite is computed per site in the forecast's site-traits layer (forecast-signals.ts → forecastSiteTraits),
// so the unchanged forecast pipeline gives it share history, stage, momentum and a forecast. Names come from labels.ts.
import type { SeriesPoint } from "./forecast";
import { basis, label, type Dimension } from "./labels";

export type CompositeRule = "all" | "any";
/** A member is a trait key, or a list of keys of which any one counts ("rounded or pill buttons"). */
export type CompositeMember = string | string[];
type CompositeDef = { id: string; rule: CompositeRule; members: CompositeMember[]; definition: string };

/** Measurement cut-offs for member fragments that are not stored as traits; each mirrors the crawl's own spread definition. */
export const MEMBER_CUTS = {
  bigHeadlinePx: 48, // crawl_spread big_headline: declared H1 ≥ 48px
  highWhitespace: 0.6, // crawl_spread high_whitespace: whitespace ratio ≥ 60%
} as const;

const DEFS: CompositeDef[] = [
  { id: "big_type", rule: "all", members: ["h1_size:big", "tracking:tight"], definition: "Very large headlines (48px and up) set with tight letter spacing." },
  { id: "editorial_serif", rule: "all", members: ["headline:serif", "aesthetic:editorial"], definition: "Serif headlines on a page that reads as editorial." },
  { id: "dark_tech", rule: "all", members: ["theme:dark", "aesthetic:dark_tech"], definition: "A dark theme with a dark-tech look." },
  { id: "soft_ui", rule: "all", members: [["cta_shape:round", "cta_shape:pill"], "whitespace:high"], definition: "Rounded or pill buttons (corner radius over 8px) with generous whitespace (60% or more)." },
  { id: "product_led_hero", rule: "any", members: ["hero_layout:product_first", "imagery:product_ui"], definition: "The first screen leads with the product: a product-first hero or product UI imagery." },
  { id: "proof_wall", rule: "all", members: ["components:logo_wall", ["components:testimonial_cards", "components:testimonial_quote"]], definition: "A customer logo wall plus testimonials on the homepage." },
  { id: "motion_rich", rule: "any", members: ["css:scroll_timeline", "css:view_transitions", "tech:gsap", "tech:lottie"], definition: "Visible motion: scroll-driven animation, page transitions, GSAP or Lottie." },
  { id: "immersive_3d", rule: "any", members: ["hero_media:webgl", "tech:three", "tech:webgl_canvas"], definition: "Real-time 3D on the homepage: a WebGL hero, Three.js or a WebGL canvas." },
  { id: "numbers_up_front", rule: "any", members: ["imagery:data_viz", "components:stats_row"], definition: "Numbers as the pitch: charts and data visuals or a row of headline stats." },
  { id: "ai_forward", rule: "any", members: ["ai_positioning:ai_core", "ai_positioning:ai_feature"], definition: "AI is the product or a named feature on the first screen, not a passing mention." },
  { id: "playful_brand", rule: "any", members: ["aesthetic:playful", "tone:playful"], definition: "A playful look or a playful voice." },
  { id: "quiet_minimal", rule: "all", members: ["aesthetic:minimal", "whitespace:high"], definition: "A minimal look with generous whitespace (60% or more)." },
];

export type Composite = CompositeDef & { key: string; name: string; dimension: Dimension; basis: "measured" | "ai"; memberKeys: string[] };
export const compositeKey = (id: string) => `combo:${id}`;
export const COMPOSITES: Composite[] = DEFS.map(d => {
  const key = compositeKey(d.id), l = label(key), memberKeys = d.members.flat();
  return { ...d, key, name: l.name, dimension: l.dimension, memberKeys, basis: memberKeys.some(m => basis(m) === "ai") ? "ai" : "measured" };
});
/** Candidates considered and left out, with the reason (shown on /what-we-show). */
export const DROPPED_COMPOSITES: { name: string; why: string }[] = [
  { name: "Glass and glow", why: "Frosted-glass blur is on about 8 in 10 homepages, so the combination is the default, not a signal." },
  { name: "People-first imagery", why: "People or lifestyle photography leads on about 7 in 10 homepages: a baseline, not a choice." },
  { name: "Premium polish", why: "Luxury look or premium voice covers nearly half the library, too broad to act on." },
  { name: "Try-it demos", why: "Computable, but left out to keep the set at twelve; interactive demos stay visible as their own signal." },
];

export const isComposite = (key: string) => key.startsWith("combo:");
export const compositeOf = (key: string) => COMPOSITES.find(c => c.key === key) ?? null;
/** Composites that list this key as a member. */
export const compositesWith = (key: string) => COMPOSITES.filter(c => c.memberKeys.includes(key));
/** "all of: A, any of (B, C)" in plain words for receipts. */
export function ruleText(c: Composite, name: (k: string) => string = k => label(k).name): string {
  const part = (m: CompositeMember) => (Array.isArray(m) ? (c.members.length > 1 && c.rule === "all" ? `(${m.map(name).join(" or ")})` : m.map(name).join(" or ")) : name(m));
  return c.members.map(part).join(c.rule === "all" ? " and " : " or ");
}

export type CompositeSite = { theme?: string | null; h1_tracking?: number | null; h1_size_px?: number | null; cta_radius_bucket?: string | null; whitespace_ratio?: number | null; frameworks?: unknown; ai_tags?: unknown };
/** Member fragments a composite can test: the site's forecast traits plus measurement-bucket and tech fragments the forecast does not stage. */
export function memberTraits(base: readonly string[], r: CompositeSite): Set<string> {
  const out = new Set(base);
  if (typeof r.h1_size_px === "number" && r.h1_size_px >= MEMBER_CUTS.bigHeadlinePx) out.add("h1_size:big");
  if (typeof r.whitespace_ratio === "number" && r.whitespace_ratio >= MEMBER_CUTS.highWhitespace) out.add("whitespace:high");
  if (r.cta_radius_bucket === "9–24") out.add("cta_shape:round");
  if (r.cta_radius_bucket === "pill") out.add("cta_shape:pill");
  if (r.frameworks && typeof r.frameworks === "object") for (const [k, v] of Object.entries(r.frameworks as Record<string, unknown>)) if (String(v) === "true") out.add(`tech:${k}`);
  return out;
}
const hit = (c: Composite, has: Set<string>) => {
  const ok = (m: CompositeMember) => (Array.isArray(m) ? m.some(x => has.has(x)) : has.has(m));
  return c.rule === "all" ? c.members.every(ok) : c.members.some(ok);
};
export const isTagged = (r: CompositeSite) => !!r.ai_tags && typeof r.ai_tags === "object" && Object.keys(r.ai_tags as object).length > 0;
/** combo:* keys this site carries. AI composites need an AI-tagged capture, the same rule the forecast applies to AI tag denominators. */
export function compositeTraits(base: readonly string[], r: CompositeSite): string[] {
  const has = memberTraits(base, r), tagged = isTagged(r);
  return COMPOSITES.filter(c => (c.basis === "measured" || tagged) && hit(c, has)).map(c => c.key);
}

/**
 * Quarterly share series per composite and scope, on the forecast's own denominators:
 * measured composites use every sampled site (the library_history_share denominator); AI composites use AI-tagged
 * sites only and scale coverage by the tagged fraction, exactly as forecast.server.ts does for AI tag dimensions.
 */
export function compositeSeries<S extends CompositeSite & { quarter: string; sector: string }>(sites: S[], base: Map<string, { denom: number; coverage: number }>, traitsOf: (s: S) => string[]): Map<string, SeriesPoint[]> {
  const hits = new Map<string, number>(), tagged = new Map<string, number>();
  const inc = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  for (const s of sites) {
    const t = isTagged(s), combos = compositeTraits(traitsOf(s), s);
    for (const sc of ["all", s.sector]) {
      if (t) inc(tagged, `${s.quarter}|${sc}`);
      for (const c of combos) inc(hits, `${c}|${s.quarter}|${sc}`);
    }
  }
  const out = new Map<string, SeriesPoint[]>();
  for (const c of COMPOSITES) for (const [qs, b] of base) {
    const [quarter, scope] = qs.split("|") as [string, string];
    const n = hits.get(`${c.key}|${qs}`) ?? 0;
    let denom = b.denom, coverage = b.coverage;
    if (c.basis === "ai") { const t = tagged.get(qs) ?? 0; coverage = b.denom ? b.coverage * t / b.denom : 0; denom = t; }
    const k = `${c.key}|${scope}`, l = out.get(k) ?? [];
    l.push({ quarter, share: denom ? Math.min(1, n / denom) : null, denom, coverage });
    out.set(k, l);
  }
  return out;
}
