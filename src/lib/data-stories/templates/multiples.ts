// SMALL MULTIPLES: the same chart once per panel (sector, composite), on shared axes. Pure.
import { qIndex } from "../../forecast";
import type { MultiplesFig, MultiplesPanel } from "../types";

const isQ = (x: string) => /^\d{4}Q[1-4]$/.test(x);
export function multiplesFig(o: { title: string; note: string; unit: MultiplesFig["unit"]; chart: MultiplesFig["chart"]; panels: MultiplesPanel[]; xs?: string[] }): MultiplesFig {
  const xs = o.xs ?? [...new Set(o.panels.flatMap(p => p.points.map(v => v.x)))].sort((a, b) => (isQ(a) && isQ(b) ? qIndex(a) - qIndex(b) : a.localeCompare(b)));
  const yMax = Math.max(o.unit === "share" ? 0.05 : 1, ...o.panels.flatMap(p => [...p.points, ...(p.marks ?? [])].map(v => v.y)));
  return { kind: "multiples", title: o.title, note: o.note, unit: o.unit, chart: o.chart, xs, yMax, panels: o.panels };
}
/** First and last point of a panel's line, and the change between them (null with fewer than two points). */
export function firstLast(p: MultiplesPanel) {
  const a = p.points[0], b = p.points[p.points.length - 1];
  return a && b && p.points.length >= 2 ? { first: a, last: b, change: b.y - a.y } : null;
}
