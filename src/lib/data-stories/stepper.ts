// The stepper's pure rules: clamping, keys, the `?step=` deep link (1-based) and the one-per-change announcement.
export const clampStep = (k: number, n: number) => (n <= 0 ? 0 : Math.max(0, Math.min(n - 1, Number.isFinite(k) ? Math.trunc(k) : 0)));
export type KeyAction = "next" | "prev" | "first" | "last" | null;
const NEXT = new Set(["ArrowRight", "ArrowDown", "j", "J"]), PREV = new Set(["ArrowLeft", "ArrowUp", "k", "K"]);
/** Keys the stepper answers; modifier chords and typing in form fields are left alone. */
export function keyAction(e: { key: string; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; target?: { tagName?: string; isContentEditable?: boolean } | null }): KeyAction {
  if (e.altKey || e.ctrlKey || e.metaKey) return null;
  const tag = e.target?.tagName?.toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target?.isContentEditable) return null;
  return NEXT.has(e.key) ? "next" : PREV.has(e.key) ? "prev" : e.key === "Home" ? "first" : e.key === "End" ? "last" : null;
}
export const applyAction = (k: number, a: KeyAction, n: number) => clampStep(a === "next" ? k + 1 : a === "prev" ? k - 1 : a === "first" ? 0 : a === "last" ? n - 1 : k, n);
/** `?step=3` ↔ index 2. Missing, junk or out-of-range values clamp. */
export const parseStep = (raw: unknown, n: number) => clampStep((typeof raw === "number" ? raw : typeof raw === "string" ? Number.parseInt(raw, 10) : 1) - 1, n);
export const stepParam = (k: number) => k + 1;
export const counter = (k: number, n: number) => `${k + 1} of ${n}`;
/** The live-region text: announced once per change (null when the step did not change). */
export function announcement(prev: number | null, next: number, n: number, caption: string): string | null {
  return prev === next ? null : `Step ${counter(next, n)}. ${caption}`;
}
