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

// D1 Part 5 · the suite never reaches the live database (the preview and the live site share one): any request to the database host
// fails at once, as an unreachable database would, so a test that forgot a stand-in shows up instead of reading real rows.
{
  const real = globalThis.fetch;
  const host = (process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "").replace(/^https?:\/\//, "").split("/")[0];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if ((host && u.includes(host)) || /\.supabase\.co\//.test(u)) throw new TypeError("fetch failed: the test suite does not reach the database");
    return real(input as never, init);
  }) as typeof fetch;
}
