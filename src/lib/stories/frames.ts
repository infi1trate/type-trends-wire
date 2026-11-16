// Story before/after pictures, pure: which picture a story's change gets, in a fixed order — the stored section crops (credited),
// else the two captures either side of the change redrawn from their stored skeletons in their own colours (the data-story frames),
// else the typographic before/after, else nothing. No image is fetched or invented.
import type { Frame } from "../data-stories/types";
import { toFrame, type CaptureRaw } from "../data-stories/templates/frames";
import type { CropRow } from "../crops";

export const FRAME_LABEL = "Redrawn from the stored layout";
export type CompareKind = "crops" | "frames" | "text" | "none";
/** The fallback order, first that exists wins. */
export function compareKind(o: { crops: boolean; frames: boolean; text: boolean }): CompareKind {
  return o.crops ? "crops" : o.frames ? "frames" : o.text ? "text" : "none";
}
/** The two stored captures either side of the change (the last before the pivot, the first at or after it), redrawn; null when
 * either side is missing or has no stored skeleton boxes to draw. */
export function storyFrames(domain: string, captures: CaptureRaw[], pivot: string, crops: CropRow[] = []): { before: Frame; after: Frame } | null {
  const sorted = [...captures].sort((a, b) => a.captured_at.localeCompare(b.captured_at) || a.id - b.id);
  const before = sorted.filter(c => c.captured_at < pivot).at(-1), after = sorted.find(c => c.captured_at >= pivot);
  if (!before || !after) return null;
  const b = toFrame(domain, before, crops), a = toFrame(domain, after, crops);
  return b.boxes.length && a.boxes.length ? { before: b, after: a } : null;
}
