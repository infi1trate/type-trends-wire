import { describe, expect, it } from "vitest";
import { standDown } from "./gate.server";
import { answerTimes, retryAfterS, SKIPPED_SLOW } from "../db-guard";

describe("D1 Part 4 · jobs never queue behind a slow database", () => {
  it("a job stands down at once and records 'skipped: database slow' when the check does not answer within a second", async () => {
    const rec: string[] = [];
    const why = await standDown("review-passes", { probe: async () => ({ ok: false, ms: 1000 }), record: async (j, n) => { rec.push(`${j}: ${n}`); } });
    expect(why).toBe(`${SKIPPED_SLOW} (no answer within 1000 ms)`);
    expect(rec).toEqual([`review-passes: ${SKIPPED_SLOW} (no answer within 1000 ms)`]);
  });
  it("runs when the database answers", async () => {
    expect(await standDown("review-passes", { probe: async () => ({ ok: true, ms: 40 }), record: async () => { throw new Error("must not record"); } })).toBeNull();
  });
  it("a record that hangs never holds the job more than a second", async () => {
    const t = Date.now();
    await standDown("ai-worker", { probe: async () => ({ ok: false, ms: 1000 }), record: () => new Promise(() => {}) });
    expect(Date.now() - t).toBeLessThan(1_500);
  });
  it("safe mode stands every job down but the wire", async () => {
    const safe = async () => ({ on: true, why: "database bad" });
    expect(await standDown("wire-followups", { probe: async () => ({ ok: true, ms: 50 }), safe, record: async () => {} })).toBe("skipped: safe mode (database bad)");
    expect(await standDown("ingest-wire", { wire: true, probe: async () => ({ ok: true, ms: 50 }), safe, record: async () => {} })).toBeNull();
  });
  it("tells a refused post to wait a minute, longer when the database has been slow for a while", () => {
    const now = 1_000_000;
    expect(retryAfterS([], now)).toBe(60);
    expect(retryAfterS([0, 1, 2].map(i => ({ at: now - i * 1000, ms: 1000, ok: false })), now)).toBe(120);
    expect(retryAfterS([0, 1, 2, 3, 4].map(i => ({ at: now - i * 1000, ms: 1000, ok: false })), now)).toBe(300);
  });
  it("health's answer time: median and worst of the last ten minutes, a failed reading counted at its limit", () => {
    const now = 10 * 60_000;
    expect(answerTimes([{ at: now - 1000, ms: 40, ok: true }, { at: now - 2000, ms: 60, ok: true }, { at: now - 3000, ms: 300, ok: false }, { at: -1, ms: 5, ok: true }], now)).toEqual({ n: 3, median_ms: 60, worst_ms: 1000, failed: 1 });
  });
});
