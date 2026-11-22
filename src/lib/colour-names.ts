// U2b · colour words are facts. One reader-facing name per hex (tape lines, story facts, the writer's sheet and its check), from the
// colour's OKLCH lightness, chroma and hue. A tinted pale colour is named by its tint ("Pale blue"), never "light grey". Pure. The taste
// tickers (`colorTicker`, `colorName`) keep their own bins: they are aggregation keys, not words for one colour.
import { oklch } from "./taste/color";

const HEX = /^#[\da-f]{6}$/i;
/** Hue word by OKLCH hue angle (degrees). W1d · hot pinks sit at 345–12° (#FB2180 is 2.8°), so that wedge is pink, and red only when dark
 *  (wine, maroon); 12–20° is red unless pale; cyan reaches 225° for light colours (darker ones there stay blue); lightness decides teal/cyan and purple/magenta. */
export function hueWord(h: number, L: number): string {
  if (h >= 345 || h < 12) return L < 0.45 ? "red" : "pink";
  if (h < 20) return L >= 0.8 ? "pink" : "red";
  if (h < 38) return "red";
  if (h < 80) return "orange";
  if (h < 120) return "yellow";
  if (h < 170) return "green";
  if (h < 215) return L >= 0.75 ? "cyan" : "teal";
  if (h < 225) return L >= 0.68 ? "cyan" : "blue";
  if (h < 270) return "blue";
  if (h < 290) return "indigo";
  if (h < 320) return "purple";
  return L >= 0.6 ? "magenta" : "purple";
}
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
/** "#D0E0E7" → "Pale blue", "#12181F" → "Near-black", "#6366F1" → "Vivid indigo", "#FB2180" → "Vivid pink"; null for anything that is not a six-digit hex. */
export function colourName(hex: string): string | null {
  if (!HEX.test(hex)) return null;
  const { L, C, h } = oklch(hex), warm = h >= 60 && h < 120;
  // A barely tinted grey in the pink wedge reads by lightness (pale: pink, else red), as before W1d; only saturated colours are hot pinks.
  const hue = C < 0.05 && (h >= 345 || h < 15) ? (L >= 0.7 ? "pink" : "red") : hueWord(h, L);
  if (C < 0.015) return L >= 0.97 ? "White" : L >= 0.9 ? "Off-white" : L >= 0.75 ? "Light grey" : L >= 0.45 ? "Mid grey" : L >= 0.27 ? "Dark grey" : L < 0.05 ? "Black" : "Near-black";
  if (C < 0.05) {
    if (L < 0.27) return "Near-black";
    if (L >= 0.9 && warm) return "Cream";
    if (L >= 0.8) return hue === "indigo" || hue === "purple" ? "Lavender" : `Pale ${hue}`;
    return `${cap(hue)}-grey`;
  }
  if (L >= 0.93 && warm && C < 0.1) return "Cream";
  if (L >= 0.88 && C < 0.1) return `Pale ${hue}`;
  if (h >= 38 && h < 80 && L < 0.55) return "Brown";
  // W1d · named shades between hues: tan (muted warm mid-light), coral (light red-orange), orange-red, lime (light yellow-green).
  if (h >= 55 && h < 95 && C < 0.09 && L >= 0.6 && L < 0.82) return "Tan";
  if (h >= 22 && h < 45 && C >= 0.12 && C < 0.19 && L >= 0.7) return "Coral";
  if (h >= 33 && h < 40 && C >= 0.18 && L >= 0.55) return "Vivid orange-red";
  if (h >= 115 && h < 135 && C >= 0.15 && L >= 0.75) return "Lime";
  if (L < 0.3) return hue === "blue" || (hue === "indigo" && h < 275) ? "Navy" : `Dark ${hue}`;
  if (L < 0.45) return `Dark ${hue}`;
  if (L >= 0.75 && C < 0.15) return `Light ${hue}`;
  return `${C >= 0.15 ? "Vivid" : "Muted"} ${hue}`;
}

/** Colour words a written text may use only when the story's sheet names them (hues and named shades). */
export const COLOUR_WORDS = ["red", "orange", "yellow", "green", "teal", "cyan", "blue", "navy", "indigo", "purple", "violet", "magenta", "pink", "cream", "beige", "brown", "grey", "gray", "black", "white", "near-black", "off-white", "lavender", "gold", "golden", "silver", "mint", "coral", "olive", "maroon", "turquoise", "peach", "tan", "amber", "lime", "crimson", "scarlet", "emerald", "burgundy", "ivory", "charcoal", "sky-blue"] as const;
// Longest first, so "near-black" is one word; a compound such as "blue-grey" reads as both of its words.
const WORD = new RegExp(`(?<![\\p{L}\\p{N}])(${[...COLOUR_WORDS].sort((a, b) => b.length - a.length).join("|")})(?![\\p{L}\\p{N}])`, "giu");
/** The colour words in a text, lower-case, in order ("near-black" stays one word). */
/** Set phrases that carry a colour word but name no colour (the "White space" story kind, Black Friday). */
const NOT_COLOURS = /\bwhite[ -]space\b|\bblack friday\b|\bwhite[ -]label\b|\bwhite ?papers?\b|\bblue[ -]chip\b|\bred flags?\b/gi;
export const colourWordsIn = (text: string): string[] => [...text.replace(NOT_COLOURS, " ").matchAll(WORD)].map(m => m[1]!.toLowerCase());
/** The words a set of colour names allows: each name's words and its compounds ("Near-black" allows near-black and black). */
export function allowedColourWords(names: string[]): Set<string> {
  const out = new Set<string>();
  for (const n of names) for (const w of n.toLowerCase().split(/\s+/)) { out.add(w); for (const p of w.split("-")) out.add(p); }
  if (out.has("grey")) out.add("gray");
  return out;
}
