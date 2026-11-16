// Story EVIDENCE crops: which section a story's change shows in and the versions either side of it. Pure.
import { beforeAfterAt, sectionName, toCrop, versionsOf, type Crop, type CropRow, type CropSection } from "../crops";
import { storySection, type ChangeRef } from "../evidence-map";

export const ROUNDUP_GRID_MAX = 8;
export type StoryEvidence = {
  section: CropSection | null; sectionName: string | null;
  compare: { before: Crop; after: Crop } | null;
  /** ROUNDUP: each member brand's current hero crop (null = no capture yet). */
  grid: { domain: string; crop: Crop | null }[] | null;
  note: string | null;
};
/** Event ids behind a story: its own `event:<id>` sources and the moves it groups (`story:move:<id>`). */
export function storyEventIds(sourceIds: string[]): number[] {
  return [...new Set(sourceIds.map(x => /^(?:event|story:move):(\d+)$/.exec(x)?.[1]).filter((x): x is string => !!x).map(Number))];
}
export function storyEvidence(s: { type: string; domains: string[] }, changes: ChangeRef[], pivot: string, crops: CropRow[]): StoryEvidence {
  if (s.type === "roundup") {
    const grid = s.domains.slice(0, ROUNDUP_GRID_MAX).map(d => { const v = versionsOf(crops, d, "hero")[0]; return { domain: d, crop: v ? toCrop(v) : null }; });
    return { section: "hero", sectionName: sectionName("hero"), compare: null, grid, note: grid.some(g => g.crop) ? null : "No hero captures of these brands yet; each is shown as a card." };
  }
  const section = storySection(s.type, changes), d = s.domains[0];
  if (!section || !d) return { section: null, sectionName: null, compare: null, grid: null, note: null };
  const p = beforeAfterAt(versionsOf(crops, d, section), pivot);
  return { section, sectionName: sectionName(section), compare: p ? { before: toCrop(p.before), after: toCrop(p.after) } : null, grid: null,
    note: p ? null : `No captures of the ${sectionName(section).toLowerCase()} on both sides of this change yet; the facts are the record.` };
}
