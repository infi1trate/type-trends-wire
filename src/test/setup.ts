import "@testing-library/jest-dom/vitest";

if (typeof window !== "undefined") {
Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
}

// Tests never read the live forecast: the signal snapshot loader returns an empty run unless a test mocks it itself.
import { vi } from "vitest";
vi.mock("@/lib/signals.server", () => ({
  loadSignalSnapshot: async () => ({ run_id: null, computed_at: null, prev_runs: [], rows: [], prev: [] }),
  latestSignals: async () => ({ tiers: new Map(), signals: [], snap: { run_id: null, computed_at: null, prev_runs: [], rows: [], prev: [] } }),
}));
