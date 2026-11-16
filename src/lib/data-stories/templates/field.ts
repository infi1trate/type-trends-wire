// BRAND FIELD: every brand in a sector placed on two measured style axes, with labelled extremes, the sector centre and clusters. Pure.
import type { FieldAxis, FieldFig, FieldPoint } from "../types";
import { brandHref } from "../text";

export const FIELD_CLUSTERS = 3;
export const FIELD_MIN_POINTS = 6;
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length ? (s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2) : 0; };
const z = (xs: number[]) => { const m = xs.reduce((a, b) => a + b, 0) / (xs.length || 1), sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length || 1)) || 1; return xs.map(x => (x - m) / sd); };

/** Deterministic k-means on z-scored axes: seeds at evenly spaced ranks of x + y, 25 rounds; clusters numbered left to right. */
export function clusters(pts: { x: number; y: number }[], k = FIELD_CLUSTERS): number[] {
  if (pts.length < k) return pts.map(() => 0);
  const zx = z(pts.map(p => p.x)), zy = z(pts.map(p => p.y)), P = pts.map((_, i) => [zx[i]!, zy[i]!] as const);
  const order = P.map((p, i) => [p[0] + p[1], i] as const).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let c = Array.from({ length: k }, (_, j) => P[order[Math.floor(((2 * j + 1) * order.length) / (2 * k))]![1]]!.slice() as number[]);
  let a = P.map(() => 0);
  for (let round = 0; round < 25; round++) {
    a = P.map(p => c.reduce((best, cc, j) => ((p[0] - cc[0]!) ** 2 + (p[1] - cc[1]!) ** 2 < (p[0] - c[best]![0]!) ** 2 + (p[1] - c[best]![1]!) ** 2 ? j : best), 0));
    c = c.map((cc, j) => { const m = P.filter((_, i) => a[i] === j); return m.length ? [m.reduce((s, p) => s + p[0], 0) / m.length, m.reduce((s, p) => s + p[1], 0) / m.length] : cc; });
  }
  const rank = c.map((cc, j) => [cc[0]!, j] as const).sort((x, y) => x[0] - y[0] || x[1] - y[1]).map(x => x[1]);
  return a.map(j => rank.indexOf(j));
}
const side = (v: number, mid: number, hi: string, lo: string) => (v >= mid ? hi : lo);
export function brandField(o: { title: string; note: string; sector: string; sectorName: string; axes: { x: FieldAxis; y: FieldAxis }; brands: { domain: string; name: string; x: number | null; y: number | null }[]; words: { x: [string, string]; y: [string, string] } }): FieldFig {
  const ok = o.brands.filter((b): b is { domain: string; name: string; x: number; y: number } => b.x != null && b.y != null && Number.isFinite(b.x) && Number.isFinite(b.y)).sort((a, b) => a.domain.localeCompare(b.domain));
  const cl = clusters(ok), centre = { x: median(ok.map(p => p.x)), y: median(ok.map(p => p.y)) };
  const points: FieldPoint[] = ok.map((b, i) => ({ domain: b.domain, name: b.name, x: b.x, y: b.y, cluster: cl[i]!, href: brandHref(b.domain) }));
  const ids = [...new Set(cl)].sort((a, b) => a - b);
  const groups = ids.map(id => { const m = points.filter(p => p.cluster === id); const x = median(m.map(p => p.x)), y = median(m.map(p => p.y));
    return { id, n: m.length, x, y, label: `${side(x, centre.x, o.words.x[0], o.words.x[1])}, ${side(y, centre.y, o.words.y[0], o.words.y[1])}` }; });
  const pick = (f: (p: FieldPoint) => number, id: string, label: string) => { const p = [...points].sort((a, b) => f(b) - f(a) || a.domain.localeCompare(b.domain))[0]; return p ? [{ id, domain: p.domain, label }] : []; };
  const extremes = points.length ? [...pick(p => p.x, "x-max", `Largest ${o.axes.x.label.toLowerCase()}`), ...pick(p => -p.x, "x-min", `Smallest ${o.axes.x.label.toLowerCase()}`), ...pick(p => p.y, "y-max", `Most ${o.axes.y.label.toLowerCase()}`), ...pick(p => -p.y, "y-min", `Least ${o.axes.y.label.toLowerCase()}`)] : [];
  return { kind: "field", title: o.title, note: o.note, sector: o.sector, sectorName: o.sectorName, axes: o.axes, points, missing: o.brands.length - ok.length, centre, clusters: groups, extremes };
}
