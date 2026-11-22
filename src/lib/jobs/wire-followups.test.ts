import { describe, expect, it, vi } from "vitest";
import { WIRE_FOLLOWUPS_SCHEDULE, WIRE_FOLLOWUP_STEPS, WIRE_STEPS, followupsNote, wireFollowupsSlot } from "./wire-followups";
import { REVIEW_MINUTES } from "../newsroom/review-pass";

describe("L2 · the wire follow-ups pass", () => {
  it("runs one minute after each wire job, never on a review-pass minute", () => {
    expect(WIRE_FOLLOWUPS_SCHEDULE).toMatchObject({ name: "wire-followups", cron: "1-59/15 * * * *", path: "/api/public/jobs/wire-followups" });
    for (const m of [1, 16, 31, 46]) expect(REVIEW_MINUTES as readonly number[]).not.toContain(m);
  });
  it("keeps every step: the wire job ingests and gives the news desk its turn; the pass builds stories then sweeps records", () => {
    expect([...WIRE_STEPS, ...WIRE_FOLLOWUP_STEPS]).toEqual(["ingest", "news desk", "story build", "records sweep"]);
  });
  it("takes one fifteen-minute slot and notes each step's seconds", () => {
    expect(wireFollowupsSlot(Date.parse("2026-11-22T14:31:05Z"))).toBe("wire-followups:2026-11-22T14:30");
    expect(followupsNote([{ step: "story build", ms: 21_100 }, { step: "records sweep", ms: 14_960 }])).toBe("story build 21.1 s · records sweep 15 s");
  });
  it("runs the story build before the records sweep, with the pass's own start time", async () => {
    const order: string[] = [];
    vi.doMock("../stories/build.server", () => ({ afterJob: async (job: string) => { order.push(`build:${job}`); } }));
    vi.doMock("../records/refresh.server", () => ({ refreshAfterJob: async (job: string) => { order.push(`sweep:${job}`); return null; } }));
    vi.doMock("./runs.server", () => ({ startRun: async () => ({ id: 1, slotTaken: false, finish: async (_ok: boolean, note: string) => { order.push(`finish:${note.replace(/[\d.]+ s/g, "n s")}`); } }) }));
    const { runWireFollowups } = await import("./wire-followups.server");
    const q = { select: () => q, eq: () => q, gte: () => q, order: () => q, in: () => q, limit: async () => ({ data: [] }) };
    const r = await runWireFollowups({ from: () => q } as never);
    expect(r.ran).toBe(true);
    expect(order).toEqual(["build:wire", "sweep:wire", "finish:story build n s · records sweep n s"]);
  });
});

describe("L2 · the records sweep keeps its time after the build", () => {
  it("gets what is left before the pass's end, from its own start", async () => {
    const { sweepLimitMs, PASS_END_MS } = await import("./wire-followups");
    expect(PASS_END_MS).toBe(52_000);
    expect(sweepLimitMs(0, 32_000)).toBe(20_000);
    expect(sweepLimitMs(0, 60_000)).toBe(0);
  });
});
