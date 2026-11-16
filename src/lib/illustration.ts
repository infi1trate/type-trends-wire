// Illustration, pure (brand/README.md, "Photography and illustration"): the seeded layout decisions for the three styles and their
// limits. Everything here is deterministic — tilt, tape corners, strip breaks and the trail's geometry come from a seed (a story
// number, an issue number) and the stored data — so the same page always draws the same picture and server and browser agree.

/** The largest filtered area an illustration may cover, in CSS pixels. */
export const ILLUSTRATION_MAX = { w: 900, h: 600 } as const;
/** At most this many filtered illustrations in one viewport; never inside a list or a Ledger. */
export const ILLUSTRATIONS_PER_VIEWPORT = 1;
/** Covers tilt their one object between these angles (degrees), either way. */
export const TILT = { min: 3, max: 6 } as const;
/** Light comes from the top left: shadows fall down and to the right. */
export const LIGHT = { dx: 1, dy: 1 } as const;
export const STYLES = ["cut", "trail", "soft"] as const;
export type IllustrationStyle = (typeof STYLES)[number];
/** Filters each style may use, by id in brand/illustration/slug-filters.svg. */
export const STYLE_FILTERS: Record<IllustrationStyle, readonly string[]> = {
  cut: ["slug-paper", "slug-pencil", "slug-ground", "slug-soft", "slug-duoG", "slug-duoP", "slug-duoK"],
  trail: ["slug-trail", "slug-soft"],
  soft: ["slug-puff", "slug-puffBig", "slug-soft", "slug-ground"],
};
/** CSS properties an illustration may animate. Filters are never animated. */
export const ANIMATABLE = ["transform", "opacity", "stroke-dashoffset"] as const;

/** A string or number to a 32-bit seed (FNV-1a for strings). */
export function seedOf(x: number | string): number {
  if (typeof x === "number") return (Math.abs(Math.trunc(x)) * 2654435761) >>> 0;
  let h = 2166136261;
  for (let i = 0; i < x.length; i++) { h ^= x.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** mulberry32: a small, fast, deterministic generator in [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const r1 = (v: number) => Math.round(v * 10) / 10;

/** The cover object's tilt: 3 to 6 degrees, either way, from the seed. */
export function tiltOf(seed: number): number {
  const r = rng(seed ^ 0x51ed), a = TILT.min + r() * (TILT.max - TILT.min);
  return r1(r() < 0.5 ? -a : a);
}
export type Corner = "tl" | "tr" | "bl" | "br";
/** Two tape corners, always diagonal so the picture reads as held: top-left with bottom-right, or top-right with bottom-left. */
export function tapeCorners(seed: number): [Corner, Corner] {
  return rng(seed ^ 0x7a9e)() < 0.5 ? ["tl", "br"] : ["tr", "bl"];
}
/** Each tape's angle (degrees) and length (share of the picture's width). */
export function tapeOf(seed: number): { corner: Corner; angle: number; length: number }[] {
  const r = rng(seed ^ 0x3c3c);
  return tapeCorners(seed).map(c => ({ corner: c, angle: r1((c === "tl" || c === "br" ? -1 : 1) * (32 + r() * 14)), length: r1(0.16 + r() * 0.06) }));
}

/** How many strips a headline is cut into: one word stays whole; up to five words make two strips; longer, three. */
export const stripCount = (words: number) => (words <= 1 ? 1 : words <= 5 ? 2 : 3);
/**
 * The headline cut into strips at word boundaries, balanced by length. The seed only nudges between equally good breaks,
 * so the same headline always cuts the same way. The strips joined with spaces are the headline.
 */
export function stripsOf(headline: string, seed: number): string[] {
  const words = headline.trim().split(/\s+/).filter(Boolean), n = stripCount(words.length);
  if (n === 1) return words.length ? [words.join(" ")] : [];
  const lens = words.map(w => w.length), total = lens.reduce((a, b) => a + b, 0) + words.length - 1, nudge = rng(seed ^ 0x1d)() < 0.5 ? -0.01 : 0.01;
  let best: number[] = [], bestScore = Infinity;
  const tryBreaks = (breaks: number[]) => {
    const parts = [0, ...breaks, words.length].slice(1).map((end, i, a) => { const start = i === 0 ? 0 : a[i - 1]!; return lens.slice(start, end).reduce((x, y) => x + y, 0) + (end - start - 1); });
    const target = total / n, score = parts.reduce((s, p, i) => s + (p - target) ** 2 + (i === parts.length - 1 ? nudge * p : 0), 0);
    if (score < bestScore) { bestScore = score; best = breaks; }
  };
  if (n === 2) for (let a = 1; a < words.length; a++) tryBreaks([a]);
  else for (let a = 1; a < words.length - 1; a++) for (let b = a + 1; b < words.length; b++) tryBreaks([a, b]);
  const cuts = [0, ...best, words.length];
  return cuts.slice(1).map((end, i) => words.slice(cuts[i]!, end).join(" "));
}
/** Each strip's small offset and turn, so the cut paper never lines up perfectly. */
export function stripShifts(seed: number, n: number): { dx: number; rot: number }[] {
  const r = rng(seed ^ 0x5717);
  return Array.from({ length: n }, (_, i) => ({ dx: r1((i % 2 ? 1 : -1) * (4 + r() * 18)), rot: r1((r() - 0.5) * 3) }));
}
/** The soft object's size (SVG units in a 900 × 600 print) for a number or short word, so it fits the print. */
export function softSize(text: string): number {
  const n = Math.max(1, [...text].length);
  return Math.round(Math.min(520, 1180 / (n * 0.58)));
}

export type TrailPoint = { x: string; y: number };
/**
 * The trail's geometry in a w × h box: measured points (y up), a smooth path through them (Catmull-Rom as cubic Béziers),
 * and where along the path each point sits (0 to 1), so a gumball can stick as the drawing head passes it.
 * Coordinates are rounded to tenths so server and browser print the same SVG.
 */
export function trailGeom(points: TrailPoint[], w: number, h: number, pad = 24): { d: string; pts: [number, number][]; at: number[] } {
  if (!points.length) return { d: "", pts: [], at: [] };
  const ys = points.map(p => p.y), lo = Math.min(...ys), hi = Math.max(...ys), span = hi - lo || 1;
  const pts = points.map((p, i): [number, number] => [r1(points.length < 2 ? w / 2 : pad + (i / (points.length - 1)) * (w - pad * 2)), r1(hi === lo ? h / 2 : h - pad - ((p.y - lo) / span) * (h - pad * 2))]);
  let d = `M${pts[0]![0]} ${pts[0]![1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!, p1 = pts[i]!, p2 = pts[i + 1]!, p3 = pts[i + 2] ?? p2;
    d += ` C${r1(p1[0] + (p2[0] - p0[0]) / 6)} ${r1(p1[1] + (p2[1] - p0[1]) / 6)} ${r1(p2[0] - (p3[0] - p1[0]) / 6)} ${r1(p2[1] - (p3[1] - p1[1]) / 6)} ${p2[0]} ${p2[1]}`;
  }
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1])), total = seg.reduce((a, b) => a + b, 0) || 1;
  let run = 0; const at = [0, ...seg.map(s => (run += s) / total)].map(v => Math.round(v * 1000) / 1000);
  return { d, pts, at };
}

/** Save-Data or a reduced-data preference: illustrations render flat (no filter) and must still read. */
export const flatMode = (o: { saveData?: boolean | undefined; reducedData?: boolean | undefined }) => !!(o.saveData || o.reducedData);
/** Clamp a requested illustration size into the limit, keeping its ratio. */
export function clampSize(w: number, h: number): { w: number; h: number } {
  const k = Math.min(1, ILLUSTRATION_MAX.w / w, ILLUSTRATION_MAX.h / h);
  return { w: Math.round(w * k), h: Math.round(h * k) };
}
