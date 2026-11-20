// E4 · SCENES — a study reads as three to five scenes, each one state of a figure with a short lead-in and a paragraph. Builders group
// their steps (the template captions) into scenes; this resolves the grouping against the steps that exist, so every step sits in exactly
// one scene and old `?step=` links (1-based step numbers) still land on the scene that holds that step. Pure.
import type { Scene, Step } from "./types";

export type SceneDef = { id: string; lead: string; steps: string[] };
/**
 * The scenes of a study, in reading order: each def keeps the existing steps it names (first claim wins), a step no def names joins the
 * scene of the step before it (else the first scene), empty scenes are dropped, and each scene shows its last step's view.
 */
export function resolveScenes(defs: readonly SceneDef[], steps: readonly Step[]): Scene[] {
  const order = new Map(steps.map((s, k) => [s.id, k])), owner = new Map<string, number>();
  const groups = defs.map(d => ({ id: d.id, lead: d.lead, ids: [] as string[] }));
  defs.forEach((d, j) => { for (const id of d.steps) if (order.has(id) && !owner.has(id)) { owner.set(id, j); groups[j]!.ids.push(id); } });
  if (!groups.length && steps.length) groups.push({ id: "all", lead: "", ids: [] });
  let last = groups.findIndex((_, j) => groups[j]!.ids.length > 0);
  if (last < 0) last = 0;
  for (const s of steps) {
    const j = owner.get(s.id);
    if (j !== undefined) { last = j; continue; }
    owner.set(s.id, last); groups[last]!.ids.push(s.id);
  }
  return groups.filter(g => g.ids.length).map(g => {
    const ids = [...g.ids].sort((a, b) => order.get(a)! - order.get(b)!);
    return { id: g.id, lead: g.lead, steps: ids, view: steps[order.get(ids.at(-1)!)!]!.view };
  });
}
/** Each step on its own scene (the tool, which still steps). */
export const oneScenePerStep = (steps: readonly Step[]): Scene[] => steps.map(s => ({ id: s.id, lead: "", steps: [s.id], view: s.view }));
/** The scene holding the step at 0-based index `k` (clamped; 0 when there are no scenes). */
export function sceneOfStep(s: { steps: readonly Step[]; scenes: readonly Scene[] }, k: number): number {
  const id = s.steps[Math.max(0, Math.min(s.steps.length - 1, Math.trunc(Number.isFinite(k) ? k : 0)))]?.id;
  const j = id ? s.scenes.findIndex(x => x.steps.includes(id)) : -1;
  return j < 0 ? 0 : j;
}
/** `?step=` (1-based step number, as embeds and old links use it) → scene index. Missing or junk → the first scene. */
export const sceneFromParam = (s: { steps: readonly Step[]; scenes: readonly Scene[] }, raw: unknown) => {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? sceneOfStep(s, n - 1) : 0;
};
/** The `?step=` a scene writes back: its first step's 1-based number, so the address and the embeds agree. */
export const paramOfScene = (s: { steps: readonly Step[]; scenes: readonly Scene[] }, j: number) => {
  const id = s.scenes[Math.max(0, Math.min(s.scenes.length - 1, j))]?.steps[0];
  const k = id ? s.steps.findIndex(x => x.id === id) : 0;
  return Math.max(0, k) + 1;
};
