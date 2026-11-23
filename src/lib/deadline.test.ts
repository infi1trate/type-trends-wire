import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HEALTH_DEADLINE_MS, READ_DEADLINE_MS, STALE_SERVE_MS, Timeout, isReaderFn, within } from "./deadline";

describe("time limits", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });
  it("are 4 s for reads and late blocks, under 2 s for health, and an old copy is preferred before the read limit", () => {
    expect(READ_DEADLINE_MS).toBe(4_000);
    expect(HEALTH_DEADLINE_MS).toBeLessThan(2_000);
    expect(STALE_SERVE_MS).toBeLessThan(READ_DEADLINE_MS);
  });
  it("a read that never answers fails at the limit instead of waiting", async () => {
    const p = within(new Promise<number>(() => {}), READ_DEADLINE_MS, "front");
    const seen = p.catch(e => e);
    await vi.advanceTimersByTimeAsync(READ_DEADLINE_MS);
    expect(await seen).toBeInstanceOf(Timeout);
  });
  it("with something in hand, the limit answers with it", async () => {
    const p = within(new Promise<string>(() => {}), STALE_SERVE_MS, "brands", () => "stored copy");
    await vi.advanceTimersByTimeAsync(STALE_SERVE_MS);
    expect(await p).toBe("stored copy");
  });
  it("a read that answers in time is not touched", async () => {
    const p = within(Promise.resolve(7), READ_DEADLINE_MS, "x");
    expect(await p).toBe(7);
  });
  it("applies only to the public pages' GET reads", () => {
    expect(isReaderFn("GET", "src/lib/read.functions.ts")).toBe(true);
    expect(isReaderFn("POST", "src/lib/read.functions.ts")).toBe(false);
    expect(isReaderFn("GET", "src/lib/agency.functions.ts")).toBe(false);
    expect(isReaderFn("GET", "src/lib/newsroom/desk.functions.ts")).toBe(false);
  });
});
