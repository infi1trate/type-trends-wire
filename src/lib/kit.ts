// The kit (/kit): what each section shows, in order, and the pure chart data built from live reads. No AI, no writes.
import type { Signal } from "./signals";
import { label } from "./labels";
import { STORY_TYPE_DEFS } from "./stories/types";

/** Kit sections, in the order the page renders them. */
export const KIT_SECTIONS = [
  { id: "kit-type", title: "Wordmark and type roles" },
  { id: "kit-colour", title: "Colour and stage colours" },
  { id: "kit-controls", title: "Buttons, chips and controls" },
  { id: "kit-stories", title: "Stories, signals and brands" },
  { id: "kit-containers", title: "Containers" },
  { id: "kit-images", title: "Image treatments" },
  { id: "kit-charts", title: "Charts" },
  { id: "kit-space", title: "Spacing and whitespace" },
  { id: "kit-motion", title: "Motion" },
  { id: "kit-data", title: "Study templates" },
] as const;
/** The brand's eight containers (components/brand/Containers.tsx), shown in this order. */
export const CONTAINERS = ["sheet", "rulebox", "card", "slab", "plate", "raised", "sticker", "photo"] as const;
export type ContainerStyle = (typeof CONTAINERS)[number];

export type QuarterSeries = { key: string; quarters: { q: string; s: number | null; n: number; c: number }[] };
/** A quarter is well covered when enough sites were measured (same cut as the signal sparklines). */
export const WELL_COVERED = { sites: 15, coverage: 0.25 } as const;
export const wellCovered = (p: QuarterSeries["quarters"][number]) => p.s != null && p.n >= WELL_COVERED.sites && p.c >= WELL_COVERED.coverage;

export function kitCharts(composites: Signal[], series: QuarterSeries[], storyTypes: Record<string, number>) {
  const named = composites.filter(s => s.share != null);
  const scatter = named.filter(s => s.momentum != null).map(s => ({ id: s.key, label: s.name, x: s.share!, y: s.momentum!, stage: s.stage }));
  const byShare = [...named].sort((a, b) => b.share! - a.share! || a.key.localeCompare(b.key));
  const bars = byShare.slice(0, 6).map(s => ({ id: s.key, label: s.name, value: s.share!, stage: s.stage }));
  const covered = new Map(series.map(s => [s.key, s.quarters.filter(wellCovered).map(p => ({ x: p.q, y: p.s as number }))]));
  const lines = byShare.filter(s => (covered.get(s.key)?.length ?? 0) >= 3).slice(0, 2).map(s => ({ id: s.key, label: s.name, points: covered.get(s.key)! }));
  const slices = Object.entries(storyTypes).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([t, n]) => ({ id: t, label: STORY_TYPE_DEFS[t as keyof typeof STORY_TYPE_DEFS]?.kicker ?? label(t).name, value: n }));
  return { scatter, lines, bars, slices };
}
export type KitCharts = ReturnType<typeof kitCharts>;
