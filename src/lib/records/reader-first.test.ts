// D1 · a stored copy past its age limit: a reader gets the old copy at once (rebuilt behind it); a job never gets an old copy.
import { describe, expect, it, vi } from "vitest";
const ctx = { reader: true };
vi.mock("../reader-context.server", () => ({ readerNow: () => ctx.reader }));
const OLD = { key: "gallery:default", body: { v: "old" }, computed_at: new Date(Date.now() - 12 * 3600_000).toISOString() };
vi.mock("../mcp/supabase", () => ({ supabaseAnon: () => ({ from: () => { const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: OLD, error: null }) }; return q; } }) }));
import { storedBy } from "./store.server";

describe("reader-first stored copies", () => {
  it("a reader gets the twelve-hour-old gallery at once and the rebuild serves the next reader", async () => {
    ctx.reader = true;
    let builds = 0, release!: () => void;
    const gate = new Promise<void>(r => { release = r; });
    const g = storedBy((_: null) => "gallery:default", async () => { builds++; await gate; return { v: "new" }; });
    const t0 = Date.now();
    expect(await g(null)).toEqual({ v: "old" });
    expect(Date.now() - t0).toBeLessThan(200);
    await new Promise(r => setTimeout(r, 10));
    expect(builds).toBe(1);
    release(); await new Promise(r => setTimeout(r, 10));
    expect(await g(null)).toEqual({ v: "new" });
  });
  it("a job is never given the old copy: it waits for the rebuild", async () => {
    ctx.reader = false;
    const g = storedBy((_: null) => "gallery:default", async () => ({ v: "rebuilt" }));
    expect(await g(null)).toEqual({ v: "rebuilt" });
  });
});
