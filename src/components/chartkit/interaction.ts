/** Pure movement and readout rules shared by every interactive chart. Coordinates are chart-local pixels. */
export type ReadPoint = { x: number; y: number; period: string; lines: string[] };
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
