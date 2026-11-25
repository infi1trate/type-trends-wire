/** Pure movement and readout rules shared by every interactive chart. Coordinates are chart-local pixels. */
export type ReadPoint = { x: number; y: number; period: string; lines: string[]; value?: string; count?: string; forecast?: boolean };
export function nearestPoint(points: readonly ReadPoint[], x: number, y?: number): number {
  let at = -1, distance = Infinity;
  points.forEach((p, i) => { const d = y === undefined ? Math.abs(p.x - x) : Math.hypot(p.x - x, p.y - y); if (d < distance) { distance = d; at = i; } });
  return at;
}
export function keyboardPoint(key: string, at: number, length: number): number | undefined {
  if (!length) return -1;
  if (key === 'Escape') return -1;
  if (key === 'Home') return 0;
  if (key === 'End') return length - 1;
  if (key === 'ArrowRight' || key === 'ArrowDown') return Math.min(length - 1, at + 1);
  if (key === 'ArrowLeft' || key === 'ArrowUp') return Math.max(0, at - 1);
  return undefined;
}
export const readoutWords = (p: ReadPoint) => [p.period, ...p.lines].filter(Boolean).join('. ');
export const decimalLabel = (s: string) => s.replace(/(-?\d+(?:\.\d+)?)(\s*(?:%|px|pts|points|rank)\b|%)/g, (_, n: string, u: string) => `${Number(n).toFixed(1)}${u}`);
/** B1c · the one readout structure on every chart: what · when · value · count (when there is one) · "forecast" (when the point is forecast). */
export function readoutLine(r: { what?: string; when?: string; value?: string; count?: string | null; forecast?: boolean }): string {
  return [r.what, r.when, r.value, r.count, r.forecast ? "forecast" : null].filter((x): x is string => !!x && x.trim() !== "").join(" · ");
}
/** B1c · a point's strip text: its structured fields when given, otherwise its period and lines. */
export const pointLine = (what: string, p: ReadPoint) => p.value !== undefined
  ? readoutLine({ what, when: p.period, value: p.value, ...(p.count !== undefined ? { count: p.count } : {}), ...(p.forecast ? { forecast: true } : {}) })
  : readoutLine({ what, when: [p.period, ...p.lines].filter(Boolean).join(" · ") });
