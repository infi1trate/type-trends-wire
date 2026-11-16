import { describe, expect, it } from "vitest";
import { MIN_RUN_GAP_DAYS, gapChain } from "./run-gap";

describe("gapChain (watchlist run-to-run changes)", () => {
  it("keeps the newest run, then each run at least MIN_RUN_GAP_DAYS older than the last kept, oldest first", () => {
    const runs = [
      { id: 1, at: "2026-11-01T09:30:00Z" }, { id: 2, at: "2026-11-02T09:30:00Z" }, { id: 3, at: "2026-11-08T09:30:00Z" },
      { id: 4, at: "2026-11-13T09:30:00Z" }, { id: 5, at: "2026-11-15T09:30:00Z" },
    ];
    expect(MIN_RUN_GAP_DAYS).toBe(6);
    expect(gapChain(runs).map(r => r.id)).toEqual([2, 3, 5]);
    expect(gapChain([runs[4]!, runs[3]!])).toEqual([runs[4]]);
    expect(gapChain([])).toEqual([]);
  });
});
