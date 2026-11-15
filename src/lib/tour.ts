/** First-visit tour state and step selection. Pure apart from the injected storage; storage failures fall back to memory. */
export const TOUR_KEY = "dsgn.tour.done";
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
let memory: string | null = null;

export function tourStore(get: () => Store | null | undefined = () => (typeof window === "undefined" ? null : window.localStorage)) {
  const s = () => { try { return get() ?? null; } catch { return null; } };
  return {
    done(): boolean { try { const st = s(); if (st) return st.getItem(TOUR_KEY) === "1" || memory === "1"; } catch { /* memory */ } return memory === "1"; },
    finish(): void { memory = "1"; try { s()?.setItem(TOUR_KEY, "1"); } catch { /* memory only */ } },
    reset(): void { memory = null; try { s()?.removeItem(TOUR_KEY); } catch { /* memory only */ } },
  };
}
/** Test hook: forget the in-memory fallback. */
export const _resetTourMemory = () => { memory = null; };

export type TourStep = { id: "today" | "trait" | "site" | "console"; target: string; caption: string };
export const TOUR_STEPS: TourStep[] = [
  { id: "today", target: '[data-tour="today"]', caption: "TODAY sums up what moved since the last data. Each line links to its proof." },
  { id: "trait", target: '[data-tour="trait"]', caption: "Open a trait to see its curve, stage and receipts. The tag in brackets is its dimension." },
  { id: "site", target: '[data-tour="site"]', caption: "Open a site for its measured fingerprint and every confirmed change." },
  { id: "console", target: '[data-tour="console"]', caption: "Press / for the console: ask for type, palettes or a critique. Press ? for the glossary." },
];
/** Steps whose target exists right now; a missing trait or site skips that step. */
export const availableSteps = (has: (selector: string) => boolean) => TOUR_STEPS.filter(s => has(s.target));
