// The stored "why it matters" line per story (no longer written or shown on the Read side since E2b): its limits, word lists and validator.
import { label } from "../labels";
import type { Candidate } from "./types";


/** Storage and editor-correction limit for a why line (the database check allows 220). */
export const WHY_MAX_CHARS = 220;
/** New lines the AI writes are shorter: one concrete sentence of at most 160 characters. */
export const WHY_LINE_MAX = 160;
/** Hard caps: 10 lines a day across builds, 5 per build. */
export const WHY_PER_DAY = 10, WHY_PER_BUILD = 5;
/** Purpose label on the AI budget ledger. */
export const WHY_KIND = "story_why";
/** Hype words the line may not use. */
export const SUPERLATIVES = ["revolutionary", "game-changing", "game changer", "groundbreaking", "ground-breaking", "unprecedented", "disruptive", "incredible", "amazing", "stunning", "massive", "huge", "explosive", "best-ever", "best ever", "insane", "jaw-dropping", "seismic", "radical", "ultimate", "must-see", "skyrocket", "skyrocketing"];

/** Hedging and filler the line may not use (the first stored lines all sounded like this). */
export const BANNED_PHRASES = ["warrants", "monitoring", "signaling", "signalling", "too early", "insufficient", "it remains to be seen", "landscape", "leverage"];

// E2b: the "why it matters" prompt, its tool and its angle prompts (which told the model to open with an imperative or with what a competitor
// should check) are gone; the writer (writer.ts) replaced them. Stored why lines stay in the database and on the desk; the validator below
// still checks an editor's corrected line and a build given a line writer in tests.

export type Known = { brands: { domain: string; names: string[] }[]; signals: { key: string; name: string }[] };
const nums = (s: string) => (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map(n => n.replace(",", "."));
const has = (text: string, needle: string) => new RegExp(`(?<![\\p{L}\\p{N}])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "iu").test(text);

/** Validate a candidate line against the story. Returns the cleaned line or the reason it was rejected. */
export function validateWhy(raw: unknown, story: Pick<Candidate, "headline" | "deck" | "facts" | "domains" | "signalKeys">, known: Known): { ok: true; line: string } | { ok: false; reason: string } {
  if (typeof raw !== "string") return { ok: false, reason: "no line" };
  const line = raw.replace(/\s+/g, " ").trim().replace(/^["“]|["”]$/g, "");
  if (!line) return { ok: false, reason: "empty" };
  if (line.length > WHY_LINE_MAX) return { ok: false, reason: `over ${WHY_LINE_MAX} characters` };
  if (line.includes("$")) return { ok: false, reason: "contains $" };
  const low = line.toLowerCase(), sup = SUPERLATIVES.find(w => has(low, w));
  if (sup) return { ok: false, reason: `superlative: ${sup}` };
  const hedge = BANNED_PHRASES.find(w => has(low, w));
  if (hedge) return { ok: false, reason: `banned phrase: ${hedge}` };
  const source = [story.headline, story.deck ?? "", ...story.facts.map(f => f.text)].join("\n"), allowed = new Set(nums(source));
  const extra = nums(line).find(n => !allowed.has(n));
  if (extra) return { ok: false, reason: `number not in the facts: ${extra}` };
  for (const b of known.brands) if (!story.domains.includes(b.domain) && !has(source, b.domain) && [b.domain, ...b.names].some(n => has(line, n))) return { ok: false, reason: `brand not in the facts: ${b.domain}` };
  for (const s of known.signals) if (!story.signalKeys.includes(s.key) && !has(source, s.name) && has(line, s.name)) return { ok: false, reason: `signal not in the facts: ${s.name}` };
  return { ok: true, line };
}
export const knownFrom = (sites: { domain: string; name: string | null }[], signalKeys: Iterable<string>): Known => ({
  brands: sites.map(s => ({ domain: s.domain, names: [s.name, s.domain.split(".")[0]].filter((x): x is string => !!x && x.length >= 4) })),
  signals: [...signalKeys].map(key => ({ key, name: label(key).name })).filter(s => s.name.length >= 4),
});
