// Writer pass · the story writer's pass runs only after the review-passes route has answered (handed to the host), never before it.
import { describe, expect, it } from "vitest";
import { quietReview, reviewThenWriter, type ReviewOut } from "./review-passes.server";
import { HOST_AFTER_ANSWER_MS } from "./wire-followups";
import * as wp from "../stories/writer-pass";

const quiet: ReviewOut = { ran: false, why: "nothing waiting", items: [], ms: 80 };
const setup = (review: ReviewOut) => {
  const seen = { writer: [] as number[], handed: [] as Promise<unknown>[] };
  const deps = { review: async () => review, writer: async (t0: number) => { seen.writer.push(t0); return null; }, now: () => 5000 };
  return { seen, deps, waitUntil: (p: Promise<unknown>) => { seen.handed.push(p); } };
};
describe("review passes and the writer pass", () => {
  it("a quiet review pass hands the writer pass to the host and answers; the pass's window starts at the hand-over", async () => {
    const s = setup(quiet), r = await reviewThenWriter(s.deps, { waitUntil: s.waitUntil });
    expect(r.writer).toBe("handed"); expect(s.seen.handed).toHaveLength(1); expect(s.seen.writer).toEqual([5000]);
  });
  it("without waitUntil the writer pass does not run at all (a pass before the answer never finished)", async () => {
    const s = setup(quiet), r = await reviewThenWriter(s.deps, {});
    expect(r.writer).toBe("not run: no waitUntil"); expect(s.seen.writer).toEqual([]);
  });
  it("a busy review pass keeps the time: no writer pass", async () => {
    for (const busy of [{ ...quiet, items: [{}] }, { ...quiet, drafts: { n: 1 } }, { ...quiet, why: "another pass is running" }, { ...quiet, why: "started" }]) {
      const s = setup(busy as ReviewOut), r = await reviewThenWriter(s.deps, { waitUntil: s.waitUntil });
      expect(r.writer).toBe("not run: review was busy"); expect(s.seen.writer).toEqual([]);
    }
    expect(quietReview({ why: "held", items: [] })).toBe(true);
  });
  it("a host whose waitUntil throws is treated as having none", async () => {
    const s = setup(quiet), r = await reviewThenWriter(s.deps, { waitUntil: () => { throw new Error("no"); } });
    expect(r.writer).toBe("not run: no waitUntil");
  });
  it("the pass's window is the time the host keeps work alive after an answer", () => {
    expect(wp.HOST_MS).toBe(HOST_AFTER_ANSWER_MS);
  });
  it("a pass that was cut off (a start row and no finish) backs the next passes off", () => {
    const now = Date.parse("2026-11-27T02:40:00Z"), starts = [{ id: 1, at: "2026-11-27T02:28:02Z" }, { id: 2, at: "2026-11-27T02:33:01Z" }, { id: 3, at: "2026-11-27T02:39:30Z" }];
    expect(wp.cutOffAgoMs(starts, new Set([]), now)).toBe(now - Date.parse("2026-11-27T02:33:01Z"));   // the newest stale one; id 3 may still be running
    expect(wp.cutOffAgoMs(starts, new Set([1, 2]), now)).toBeNull();
    expect(wp.passStandDown({ held: false, safeMode: false, buildRunning: false, passRunning: false, lastNoRoomAgoMs: wp.sooner(null, wp.cutOffAgoMs(starts, new Set([]), now)) })).toBe(wp.BACKING_OFF);
    expect(wp.sooner(5, null)).toBe(5); expect(wp.sooner(null, null)).toBeNull(); expect(wp.sooner(9, 4)).toBe(4);
    expect(wp.backsOff("writer pass · failed: boom")).toBe(true);
  });
});
