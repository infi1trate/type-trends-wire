// CHART OF THE DAY: a short named list of recipes over stored data, rotated by the UTC date and stable for the whole UTC day. Pure.
// A recipe whose data is too thin is skipped and the next one in the list is tried; with nothing left the section is absent.
import type { Signal } from "../signals";
import { kitCharts, wellCovered, type QuarterSeries } from "../kit";
// Same shapes as the shared chart primitives (components/charts/Charts.tsx), kept here so this module stays pure.
export type ScatterPoint = { id: string; label: string; x: number; y: number; stage?: string | null };
export type LineSeries = { id: string; label: string; points: { x: string; y: number }[] };
export type Bar = { id: string; label: string; value: number; stage?: string | null };
export type Slice = { id: string; label: string; value: number };

export const CHART_RECIPES = [
  { id: "share-momentum", title: "Share against Momentum: the composite signals", note: "Each dot is a composite signal: how many tracked homepages show it, and how fast that share moved per quarter.", source: "Latest forecast run, all sectors." },
  { id: "biggest-mover", title: "The biggest mover, quarter by quarter", note: "The headline signal with the most Momentum right now, over the well-covered quarters (15+ sites, 25% coverage).", source: "Latest forecast run, all sectors." },
  { id: "common-composites", title: "The six most common composite signals", note: "Share of tracked homepages showing each composite signal.", source: "Latest forecast run, all sectors." },
  { id: "stories-by-type", title: "Stories by type this week", note: "Published stories in the seven days before today (UTC), by type.", source: "Stored stories with the editor's edits applied." },
] as const;
export type RecipeId = (typeof CHART_RECIPES)[number]["id"];
/** Thin-data floors: below these a recipe is skipped. */
export const CHART_MIN = { scatter: 4, linePoints: 3, bars: 3, stories: 5, types: 2 } as const;

export type ChartInput = { day: string; composites: Signal[]; headline: Signal[]; series: QuarterSeries[]; stories: { type: string }[] };
type Base = { recipe: RecipeId; title: string; note: string; source: string; receipt: { href: string; label: string } };
export type ChartOfDay =
  | (Base & { kind: "scatter"; points: ScatterPoint[] })
  | (Base & { kind: "line"; series: LineSeries[] })
  | (Base & { kind: "bar"; bars: Bar[] })
  | (Base & { kind: "donut"; slices: Slice[]; total: number });

const meta = (id: RecipeId) => { const r = CHART_RECIPES.find(x => x.id === id)!; return { recipe: id, title: r.title, note: r.note, source: r.source }; };
function build(id: RecipeId, i: ChartInput): ChartOfDay | null {
  const types: Record<string, number> = {}; for (const s of i.stories) if (s.type !== "launch") types[s.type] = (types[s.type] ?? 0) + 1;
  const k = kitCharts(i.composites, [], types);
  if (id === "share-momentum") return k.scatter.length >= CHART_MIN.scatter ? { ...meta(id), kind: "scatter", points: k.scatter, receipt: { href: "/patterns", label: "Every composite pattern" } } : null;
  if (id === "common-composites") return k.bars.length >= CHART_MIN.bars ? { ...meta(id), kind: "bar", bars: k.bars, receipt: { href: "/patterns", label: "Every composite pattern" } } : null;
  if (id === "stories-by-type") { const total = k.slices.reduce((a, s) => a + s.value, 0); return total >= CHART_MIN.stories && k.slices.length >= CHART_MIN.types ? { ...meta(id), kind: "donut", slices: k.slices, total, receipt: { href: "/morning", label: "The Morning Line" } } : null; }
  const by = new Map(i.series.map(s => [s.key, s.quarters.filter(wellCovered).map(p => ({ x: p.q, y: p.s as number }))]));
  const mover = [...i.headline].filter(s => s.momentum != null && (by.get(s.key)?.length ?? 0) >= CHART_MIN.linePoints).sort((a, b) => Math.abs(b.momentum!) - Math.abs(a.momentum!) || a.key.localeCompare(b.key))[0];
  return mover ? { ...meta(id), kind: "line", series: [{ id: mover.key, label: mover.name, points: by.get(mover.key)! }], receipt: { href: `/signals/${encodeURIComponent(mover.key)}`, label: `${mover.name}: the full chart` } } : null;
}
/** Days since 1970-01-01 of a YYYY-MM-DD UTC date. */
export const dayNumber = (day: string) => Math.floor(Date.parse(`${day}T00:00:00Z`) / 864e5);
/** The day's recipe: start at (day number mod recipes), skip thin ones in list order. */
export function chartOfDay(i: ChartInput): ChartOfDay | null {
  const n = CHART_RECIPES.length, start = ((dayNumber(i.day) % n) + n) % n;
  for (let k = 0; k < n; k++) { const c = build(CHART_RECIPES[(start + k) % n]!.id, i); if (c) return c; }
  return null;
}
