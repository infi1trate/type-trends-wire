// Deterministic editorial copy for the Digest and explainer pages. Names come only from labels.ts. Pure.
import { AI_TAGGED, basis, canonical, inSentence, label, stageName, type Dimension, type StageName } from "../labels";

export { AI_TAGGED };
import { compositeOf, ruleText } from "../composites";
export const pct = (v: number | null | undefined, d = 0) => (v == null ? null : `${(v * 100).toFixed(d)}%`);
export const pts = (v: number | null | undefined) => (v == null ? null : `${Math.abs(v).toFixed(1)} points a quarter`);
const cat = (key: string) => canonical(key).split(":")[0] ?? "";

/** One plain-English definition per trait, from its label and how we detect it. */
export function traitDefinition(key: string): string {
  const k = canonical(key), l = label(k), name = inSentence(l.name), c = cat(k);
  const combo = c === "combo" ? compositeOf(k) : null;
  if (combo) return `${l.name} is a composite signal: ${combo.definition.replace(/\.$/, "")}. It combines ${ruleText(combo)}. ${combo.basis === "ai" ? "At least one part is read by our AI tagger, so treat each count as an estimate." : "Every part is measured directly from each page's code and rendered styles."}`;
  const what =
    c === "css" ? `homepages whose stylesheets use ${name}` :
    c === "framework" ? `homepages ${/^built/i.test(l.name) ? name : `built with ${l.name}`}` :
    c === "components" ? `homepages that include ${name}` :
    c === "hero_layout" || c === "hero_media" ? `homepages whose first screen uses ${/^(no|text-only)/i.test(l.name) ? name : `a ${name.replace(/^(an?) /, "")}`}` :
    c === "imagery" ? `homepages whose main imagery is ${name}` :
    c === "tone" ? `homepage copy written in a ${name}` :
    c === "aesthetic" ? `homepages that read as ${name}` :
    c === "color_mood" ? `homepages with ${name}` :
    c === "theme" ? `homepages that open in ${name}` :
    c === "ai_positioning" ? `homepages where we see ${name}` :
    `homepages that use ${name}`;
  const how = basis(k) === "ai" ? "It is read by our AI tagger from homepage captures, so treat each count as an estimate." : "It is measured directly from each page's code and rendered styles.";
  return `${l.name} tracks the share of ${what}. ${how}`;
}

const STAGE_READ: Record<StageName, string> = {
  Emerging: "still early, so using it now reads as ahead of the curve",
  Rising: "past the experiment stage and spreading, so it belongs in briefs and templates now",
  Peaking: "close to its high-water mark, so it reads as current today and as familiar soon",
  Fading: "losing ground, so using it now reads as last cycle unless the choice is deliberate",
  Steady: "holding its share, so it is a safe, unremarkable choice",
};
const AUDIENCE: Record<Dimension, string> = {
  FONT: "For type choices", COLOR: "For palettes", LAYOUT: "For page structure and component choices", VIBE: "For art direction and copy tone",
};
/** "Why it matters" for the cover's lead signal when the brief did not store one. Subject is "this signal" so verbs agree with any name. */
export function whyItMatters(key: string, stage: string | null, share: number | null, momentum: number | null): string {
  const l = label(key), s = stageName(stage), p = pct(share), m = pts(momentum);
  const facts = [p ? `${p} of tracked homepages` : null, m && momentum ? `${momentum >= 0 ? "gaining" : "losing"} ${m}` : null].filter(Boolean);
  const at = facts.length ? `at ${facts.join(" and ")}, ` : "";
  return s ? `${AUDIENCE[l.dimension]}: ${at}this signal is ${STAGE_READ[s]}.` : `${AUDIENCE[l.dimension]}: ${at}this signal is worth watching, but there is not enough history to stage it yet.`;
}
/** The so-what line for a headline signal: audience × stage, deterministic, no AI. "this signal" keeps verbs agreeing with any name. */
export function soWhat(key: string, stage: string | null): string {
  const l = label(key), s = stageName(stage);
  return s ? `${AUDIENCE[l.dimension]}: this signal is ${STAGE_READ[s]}.` : `${AUDIENCE[l.dimension]}: worth watching, but there is not enough history to stage it yet.`;
}
/** Stage change in words: "moved from Steady to Rising". */
export const stageMove = (from: StageName | null, to: StageName | null) => (from && to && from !== to ? `moved from ${from} to ${to}` : to ? `is ${to}` : "is not staged yet");
/** One sentence of facts for a mover. */
export function moverSentence(share: number | null, momentum: number | null, sites: number | null, sector: string | null = null): string {
  const bits = [pct(share) ? `On ${pct(share)} of tracked ${sector ? `${sector} ` : ""}homepages` : null, momentum != null && Math.abs(momentum) >= 0.05 ? `${momentum >= 0 ? "gaining" : "losing"} ${pts(momentum)}` : momentum != null ? "flat quarter on quarter" : null];
  const head = bits.filter(Boolean).join(", ");
  return head ? `${head}${sites ? `, across ${sites} sites in the latest sample` : ""}.` : sites ? `Seen on ${sites} sites in the latest sample.` : "Too little history for a share yet.";
}
