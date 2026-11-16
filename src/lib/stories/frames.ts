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
/** A change is often stamped seconds after the capture that showed it: the newest capture this close before the pivot counts as "after". */
export const AFTER_SLACK_MS = 2 * 864e5;
/** The two stored captures either side of a change: the first at or after the pivot (or the newest one just before it, within
 * AFTER_SLACK_MS) and the capture before that; null when either side is missing. */
export function capturePair(captures: CaptureRaw[], pivot: string): { before: CaptureRaw; after: CaptureRaw } | null {
  const sorted = [...captures].sort((a, b) => a.captured_at.localeCompare(b.captured_at) || a.id - b.id);
  const t = Date.parse(pivot), late = sorted.filter(c => Date.parse(c.captured_at) <= t).at(-1);
  const after = sorted.find(c => c.captured_at >= pivot) ?? (late && t - Date.parse(late.captured_at) <= AFTER_SLACK_MS ? late : undefined);
  const before = after ? sorted.filter(c => c !== after && c.captured_at < after.captured_at).at(-1) : undefined;
  return before && after ? { before, after } : null;
}
/** The pair redrawn; null when either side is missing or has no stored skeleton boxes to draw. */
export function storyFrames(domain: string, captures: CaptureRaw[], pivot: string, crops: CropRow[] = []): { before: Frame; after: Frame } | null {
  const p = capturePair(captures, pivot);
  if (!p) return null;
  const b = toFrame(domain, p.before, crops), a = toFrame(domain, p.after, crops);
  return b.boxes.length && a.boxes.length ? { before: b, after: a } : null;
}
