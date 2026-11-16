// Pure helpers for the shared chart primitives: linear scales, round ticks and donut arcs. No DOM, no React.
export type Domain = readonly [number, number];
/** Maps a domain onto a pixel range; a zero-width domain maps to the range middle. */
export function linear(domain: Domain, range: Domain) {
  const [d0, d1] = domain, [r0, r1] = range, span = d1 - d0;
  return (v: number) => (span === 0 ? (r0 + r1) / 2 : r0 + ((v - d0) / span) * (r1 - r0));
}
/** Round tick values covering [min, max] (about `count` of them), on 1 / 2 / 5 × 10^n steps. */
export function ticks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) return [min];
  const raw = (max - min) / Math.max(1, count), mag = 10 ** Math.floor(Math.log10(raw)), norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out;
}
/** A padded [min, max] that starts at zero when every value is positive (shares, counts). */
export function extent(values: number[], { zero = true, pad = 0.08 }: { zero?: boolean; pad?: number } = {}): Domain {
  const v = values.filter(Number.isFinite);
  if (!v.length) return [0, 1];
  let lo = Math.min(...v), hi = Math.max(...v);
  if (zero && lo > 0) lo = 0;
  if (lo === hi) { hi = lo + 1; }
  const p = (hi - lo) * pad;
  return [zero && lo === 0 ? 0 : lo - p, hi + p];
}
export type Arc = { start: number; end: number; mid: number; share: number };
/** Donut slices as angles (radians, clockwise from 12 o'clock); values ≤ 0 get an empty arc. */
export function arcs(values: number[]): Arc[] {
  const total = values.reduce((a, b) => a + Math.max(0, b), 0);
  let at = 0;
  return values.map(v => { const share = total ? Math.max(0, v) / total : 0, start = at, end = at + share * Math.PI * 2; at = end; return { start, end, mid: (start + end) / 2, share }; });
}
const pt = (cx: number, cy: number, r: number, a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)] as const;
/** SVG path for one donut slice between radii r0 (inner) and r1 (outer). A full circle is drawn as two halves. */
export function arcPath(cx: number, cy: number, r0: number, r1: number, start: number, end: number): string {
  if (end - start <= 0) return "";
  if (end - start >= Math.PI * 2 - 1e-6) return arcPath(cx, cy, r0, r1, start, start + Math.PI) + arcPath(cx, cy, r0, r1, start + Math.PI, start + Math.PI * 2 - 1e-6);
  const large = end - start > Math.PI ? 1 : 0, f = (n: number) => n.toFixed(2);
  const [ax, ay] = pt(cx, cy, r1, start), [bx, by] = pt(cx, cy, r1, end), [c1, c2] = pt(cx, cy, r0, end), [d1, d2] = pt(cx, cy, r0, start);
  return `M${f(ax)} ${f(ay)}A${r1} ${r1} 0 ${large} 1 ${f(bx)} ${f(by)}L${f(c1)} ${f(c2)}A${r0} ${r0} 0 ${large} 0 ${f(d1)} ${f(d2)}Z`;
}
/** A point on a circle, rounded to 0.01 so the server and the browser print the same coordinate (their sin/cos can differ in the last digit,
 *  which broke hydration on /kit's donut labels). */
export const point = (cx: number, cy: number, r: number, a: number) => { const [x, y] = pt(cx, cy, r, a); return [Math.round(x * 100) / 100, Math.round(y * 100) / 100] as const; };
