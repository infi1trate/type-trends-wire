// A stored copy past its age limit: rebuilt live when the rebuild is quick, otherwise (slow or failed) the old copy is served.
import { describe, expect, it, vi } from "vitest";
import { liveOrOld } from "./store.server";
import { STALE_SERVE_MS } from "../deadline";

describe("liveOrOld", () => {
  it("serves the fresh rebuild when it finishes in time", async () => {
    await expect(liveOrOld(async () => "fresh", () => "old", "rebrands")).resolves.toBe("fresh");
  });
  it("serves the old copy when the rebuild runs past STALE_SERVE_MS", async () => {
    vi.useFakeTimers();
    const p = liveOrOld(() => new Promise<string>(() => {}), () => "old", "rebrands");
    await vi.advanceTimersByTimeAsync(STALE_SERVE_MS);
    await expect(p).resolves.toBe("old");
    vi.useRealTimers();
  });
  it("serves the old copy when the rebuild fails", async () => {
    await expect(liveOrOld(() => Promise.reject(new Error("statement timeout")), () => "old", "rebrands")).resolves.toBe("old");
  });
});
