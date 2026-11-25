// B2 · ADOPTION WAKE (pure layout, proposed form "adoption-wake"): one dot per adopter at the quarter it first showed a trait, stacked
// upward inside its quarter's column; brands that already had it at their first capture sit in a hatched "already there" column at the
// left; the share of read homepages is a quiet line on a right-hand axis. Labels for the first three dated adopters are placed only
// where they clear every dot and every other label (labels drop before type shrinks). Coordinates are CSS pixels at `width`.
import type { AdoptionFig, Adopter } from "@/lib/data-stories/types";

export type WakeDot = { domain: string; name: string; col: number; x: number; y: number; r: number; vanguard: boolean; dropped: boolean; censored: boolean; quarter: string | null; href: string };
export type WakeLabel = { domain: string; text: string; x: number; y: number; w: number };
export type WakeLayout = {
  width: number; height: number; dot: number; plot: { l: number; r: number; t: number; b: number };
  columns: { key: string; quarter: string | null; x: number; w: number }[]; dots: WakeDot[]; labels: WakeLabel[];
  line: { quarter: string; x: number; y: number; share: number; denom: number | null }[]; shareMax: number; dated: number;
};
/** Dot diameter: 8 px at 1440, 6 px at 390, linear between. */
export const dotSize = (width: number) => Math.round(Math.max(6, Math.min(8, 6 + ((width - 390) / (1440 - 390)) * 2)));
/** "early 2024" (Q1), "mid 2024" (Q2, Q3), "late 2024" (Q4). */
export const seasonOf = (q: string) => { const m = /^(\d{4})Q([1-4])$/.exec(q); return m ? `${m[2] === "1" ? "early" : m[2] === "4" ? "late" : "mid"} ${m[1]}` : q; };
const CHAR = 6.6; // the kit's 12 px label face, per character
type Box = { x0: number; y0: number; x1: number; y1: number };
const hits = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

export function wakeLayout(fig: Pick<AdoptionFig, "quarters" | "adopters" | "share">, vanguard: ReadonlySet<string>, width: number, denoms: Record<string, number> = {}): WakeLayout {
  const d = dotSize(width), gap = 2, step = d + gap;
  const plot = { l: 8, r: width < 600 ? 40 : 48, t: 24, b: 28 };
  const quarters = [...fig.quarters];
  const keys = ["already", ...quarters], n = keys.length, inner = width - plot.l - plot.r;
  const colW = inner / n, per = Math.max(1, Math.floor((colW - 2) / step));
  const cols = keys.map((k, i) => ({ key: k, quarter: k === "already" ? null : k, x: plot.l + i * colW, w: colW }));
  const groups = keys.map(k => fig.adopters.filter(a => (k === "already" ? a.censored : !a.censored && a.first === k)));
  const tallest = Math.max(1, ...groups.map(g => Math.ceil(g.length / per)));
  const stackH = tallest * step, plotH = Math.max(120, stackH + 24), height = plot.t + plotH + plot.b, base = plot.t + plotH;
  const dots: WakeDot[] = groups.flatMap((g, ci) => {
    const c = cols[ci]!, used = Math.min(per, g.length) * step - gap, x0 = c.x + (c.w - used) / 2 + d / 2;
    return g.map((a: Adopter, j) => ({ domain: a.domain, name: a.name, col: ci, x: x0 + (j % per) * step, y: base - d / 2 - Math.floor(j / per) * step, r: d / 2,
      vanguard: vanguard.has(a.domain), dropped: a.dropped, censored: a.censored, quarter: a.censored ? null : a.first, href: a.href }));
  });
  const shareMax = Math.max(0.01, ...fig.share.map(p => p.y));
  const line = fig.share.flatMap(p => { const i = keys.indexOf(p.x); return i < 1 ? [] : [{ quarter: p.x, x: cols[i]!.x + colW / 2, y: base - (p.y / shareMax) * (plotH - 8), share: p.y, denom: denoms[p.x] ?? null }]; });
  // Labels: the first three dated adopters, to the right of their dot (else the left), clear of all dots, labels and the plot edge.
  const boxes: Box[] = dots.map(o => ({ x0: o.x - o.r - 1, y0: o.y - o.r - 1, x1: o.x + o.r + 1, y1: o.y + o.r + 1 }));
  const labels: WakeLabel[] = [], placed: Box[] = [];
  for (const o of dots.filter(x => !x.censored).slice(0, 3)) {
    const w = o.name.length * CHAR, h = 12;
    for (const side of [1, -1]) {
      const x = side > 0 ? o.x + o.r + 4 : o.x - o.r - 4 - w, b: Box = { x0: x, y0: o.y - h / 2 - 1, x1: x + w, y1: o.y + h / 2 + 1 };
      if (b.x0 < 0 || b.x1 > width - plot.r || b.y0 < 0) continue;
      if (boxes.some(z => hits(z, b)) || placed.some(z => hits(z, b))) continue;
      placed.push(b); labels.push({ domain: o.domain, text: o.name, x, y: o.y + 4, w }); break;
    }
  }
  return { width, height, dot: d, plot, columns: cols, dots, labels, line, shareMax, dated: dots.filter(x => !x.censored).length };
}
/** The dot readout: "Vercel · first seen early 2024 · vanguard · still there". */
export const wakeDotLine = (o: Pick<WakeDot, "name" | "quarter" | "vanguard" | "dropped">) =>
  [o.name, o.quarter ? `first seen ${seasonOf(o.quarter)}` : "already there at its first capture", o.vanguard ? "vanguard" : null, o.dropped ? "later dropped it" : "still there"].filter(Boolean).join(" · ");
/** Keyboard order: quarter by quarter (left to right), then up through the dots in a column. */
export const wakeOrder = (l: WakeLayout) => [...l.dots].sort((a, b) => a.col - b.col || b.y - a.y || a.x - b.x);
/** Signal pages show the wake only with at least this many dated adopters. */
export const WAKE_MIN_DATED = 15;
/** Axis labels: the year at the first column of each year, dropped where it would touch the previous label (4 px clear). */
export function wakeTicks(l: WakeLayout): { key: string; x: number; text: string }[] {
  const out: { key: string; x: number; text: string; w: number }[] = [];
  let year = "";
  for (const c of l.columns.slice(1)) {
    const y = c.quarter!.slice(0, 4); if (y === year) continue; year = y;
    const text = l.width < 600 ? `’${y.slice(2)}` : y, w = text.length * CHAR, x = c.x + c.w / 2, prev = out.at(-1);
    if (prev && x - w / 2 < prev.x + prev.w / 2 + 4) continue;
    out.push({ key: c.key, x, text, w });
  }
  return out.map(({ w: _w, ...t }) => t);
}
