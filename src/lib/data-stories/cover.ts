// The data-story cover trail: the story's own stored series (README "Photography and illustration": the Trail on data-story covers).
// Pure; returns the first series of two or more points in figure order, or null (the cover then shows type only).
import type { StoryModel } from "./types";
import { qText } from "./text";

export type CoverTrail = { label: string; points: { x: string; y: number }[]; unit: "share" | "count" };
export function coverTrail(s: StoryModel): CoverTrail | null {
  for (const f of Object.values(s.figures)) {
    if (f.kind === "adoption" && f.share.length >= 2) return { label: `${f.signal.name}: share by quarter`, unit: "share", points: f.share.map(p => ({ x: qText(p.x), y: p.y })) };
    if (f.kind === "multiples" && f.chart === "line") {
      const p = f.panels.find(x => x.points.length >= 2);
      if (p) return { label: `${p.label}: ${f.unit === "share" ? "share" : "count"} by quarter`, unit: f.unit, points: p.points.map(q => ({ x: /Q/.test(q.x) ? qText(q.x) : q.x, y: q.y })) };
    }
  }
  return null;
}
