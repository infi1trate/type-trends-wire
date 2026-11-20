// Story EVIDENCE crops: which section a story's change shows in and the versions either side of it. Pure.
import { afterAt, beforeAfterAt, sectionName, toCrop, versionsOf, type Crop, type CropRow, type CropSection } from "../crops";
import { storySection, type ChangeRef } from "../evidence-map";
import { NO_CAPTURE_LINE } from "../crops";

export const ROUNDUP_GRID_MAX = 8;
export type StoryEvidence = {
  section: CropSection | null; sectionName: string | null;
  compare: { before: Crop; after: Crop } | null;
  /** I1: no pair, but a crop of the section taken at or after the change: shown alone, credited. */
  after?: Crop | null;
  /** ROUNDUP: each member brand's current hero crop (null = no capture yet). */
  grid: { domain: string; crop: Crop | null }[] | null;
  note: string | null;
};
/** Event ids behind a story: its own `event:<id>` sources and the moves it groups (`story:move:<id>`). */
export function storyEventIds(sourceIds: string[]): number[] {
  return [...new Set(sourceIds.map(x => /^(?:event|story:move):(\d+)$/.exec(x)?.[1]).filter((x): x is string => !!x).map(Number))];
}
/** A census shows the first-screen crops of its first members that have one (E2g), at most this many. */
export const CENSUS_GRID_MAX = 4;
export function storyEvidence(s: { type: string; domains: string[]; id?: string }, changes: ChangeRef[], pivot: string, crops: CropRow[]): StoryEvidence {
  if (s.type === "roundup" && s.id?.startsWith("census:")) {
    const grid = s.domains.flatMap(d => { const v = versionsOf(crops, d, "hero")[0]; return v ? [{ domain: d, crop: toCrop(v) }] : []; }).slice(0, CENSUS_GRID_MAX);
    return { section: "hero", sectionName: sectionName("hero"), compare: null, grid: grid.length ? grid : null, note: null };
  }
  if (s.type === "roundup") {
    const grid = s.domains.slice(0, ROUNDUP_GRID_MAX).map(d => { const v = versionsOf(crops, d, "hero")[0]; return { domain: d, crop: v ? toCrop(v) : null }; });
    return { section: "hero", sectionName: sectionName("hero"), compare: null, grid, note: grid.some(g => g.crop) ? null : "No hero captures of these brands yet; each is shown as a card." };
  }
  const section = storySection(s.type, changes), d = s.domains[0];
  if (!section || !d) return { section: null, sectionName: null, compare: null, grid: null, note: null };
  const versions = versionsOf(crops, d, section), p = beforeAfterAt(versions, pivot), after = p ? null : afterAt(versions, pivot);
  return { section, sectionName: sectionName(section), compare: p ? { before: toCrop(p.before), after: toCrop(p.after) } : null, after: after ? toCrop(after) : null, grid: null,
    note: p || after ? null : NO_CAPTURE_LINE };
}

// KEPT CROPS (E2c) ---------------------------------------------------------------------------------------------------------------
// A published story keeps the crops it cites (story_kept_crops): its before and after, or a gathered story's member heroes. A kept crop is
// never replaced by a newer one on the story page, and crop history never evicts it while the story is published.
export type KeptRole = "before" | "after" | "member";
export type KeptCrop = { path: string; domain: string; role: KeptRole };
const pathOf = (c: Crop) => c.src.replace(/^\/crops\//, "");
/** The crops a story's evidence shows, to keep: the pair, else the one after, else the first four member heroes. */
export function keepFromEvidence(ev: StoryEvidence): KeptCrop[] {
  if (ev.compare) return [{ path: pathOf(ev.compare.before), domain: ev.compare.before.domain, role: "before" }, { path: pathOf(ev.compare.after), domain: ev.compare.after.domain, role: "after" }];
  if (ev.after) return [{ path: pathOf(ev.after), domain: ev.after.domain, role: "after" }];
  return (ev.grid ?? []).filter(g => g.crop).slice(0, 4).map(g => ({ path: pathOf(g.crop!), domain: g.domain, role: "member" as const }));
}
/** The evidence with the story's kept crops in place (only those still stored and visible in `crops`). */
export function withKept(ev: StoryEvidence, kept: KeptCrop[], crops: CropRow[]): StoryEvidence {
  if (!kept.length) return ev;
  const byPath = new Map(crops.map(c => [c.path, c])), row = (k: KeptCrop | undefined) => (k ? byPath.get(k.path) ?? null : null);
  if (ev.grid) return { ...ev, grid: ev.grid.map(g => { const r = row(kept.find(k => k.role === "member" && k.domain === g.domain)); return r ? { domain: g.domain, crop: toCrop(r) } : g; }) };
  const b = row(kept.find(k => k.role === "before")), a = row(kept.find(k => k.role === "after"));
  if (b && a) return { ...ev, compare: { before: toCrop(b), after: toCrop(a) }, after: null, note: null };
  if (a && !ev.compare) return { ...ev, after: toCrop(a), note: null };
  return ev;
}
