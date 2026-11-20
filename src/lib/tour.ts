/** First-visit tours (one per mode) and step selection. Pure apart from the injected storage; storage failures fall back to memory. */
import type { Mode } from "./ia";
export const TOUR_KEY = "dsgn.tour.done";
export const READ_TOUR_KEY = "dsgn.tour.read.done";
export const tourKey = (mode: Mode) => (mode === "read" ? READ_TOUR_KEY : TOUR_KEY);
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const memory = new Map<string, string>();

export function tourStore(get: () => Store | null | undefined = () => (typeof window === "undefined" ? null : window.localStorage), key: string = TOUR_KEY) {
  const s = () => { try { return get() ?? null; } catch { return null; } };
  return {
    done(): boolean { try { const st = s(); if (st) return st.getItem(key) === "1" || memory.get(key) === "1"; } catch { /* memory */ } return memory.get(key) === "1"; },
    finish(): void { memory.set(key, "1"); try { s()?.setItem(key, "1"); } catch { /* memory only */ } },
    reset(): void { memory.delete(key); try { s()?.removeItem(key); } catch { /* memory only */ } },
  };
}
/** The tour store for one mode (shown once per mode per device). */
export const modeTour = (mode: Mode) => tourStore(undefined, tourKey(mode));
/** Test hook: forget the in-memory fallback. */
export const _resetTourMemory = () => { memory.clear(); };

export type TourStep = { id: string; target: string; caption: string };
/** Terminal tour: Live → a signal drawer → a brand record → console. */
export const TOUR_STEPS: TourStep[] = [
  { id: "today", target: '[data-tour="today"]', caption: "LIVE · TODAY sums up what moved since the last data. Each line links to its proof." },
  { id: "trait", target: '[data-tour="trait"]', caption: "Open a signal to see its curve, stage and receipts. The tag in brackets is its dimension." },
  { id: "site", target: '[data-tour="site"]', caption: "Open a brand for its measured fingerprint and every confirmed change." },
  { id: "console", target: '[data-tour="console"]', caption: "Press / for the console: ask for type, palettes or a critique. Press ? for the glossary, ` for Read mode." },
];
/** Read tour: Live → a signal → a brand → the Terminal switch. */
export const READ_TOUR_STEPS: TourStep[] = [
  { id: "live", target: '[data-tour="r-live"]', caption: "Today is the front page: the day's stories, the tape of confirmed changes, then the rest of the week. Every story links to its receipts." },
  { id: "signal", target: '[data-tour="r-signal"]', caption: "A signal page shows what it is now, the evidence, the so-what and related brands." },
  { id: "brand", target: '[data-tour="r-brand"]', caption: "A brand page shows its identity, every confirmed move and how it sits against its sector." },
  { id: "terminal", target: '[data-tour="r-terminal"]', caption: "Terminal switches to the dense, keyboard-first view of the same thing. Press ` anywhere to switch back." },
];
export const stepsFor = (mode: Mode) => (mode === "read" ? READ_TOUR_STEPS : TOUR_STEPS);
/** Steps whose target exists right now; a missing step is skipped. */
export const availableSteps = (has: (selector: string) => boolean, steps: TourStep[] = TOUR_STEPS) => steps.filter(s => has(s.target));
