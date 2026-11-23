import { describe, expect, it } from "vitest";
import { archiveTopic, markPlan, MARK_AGGREGATES, MARK_RECORDS_FORCE } from "./marks";
import { runMarkedWork } from "./marked-work.server";

const m = (topic: string, marked_at: string) => ({ topic, marked_at });
describe("D1 Part 2 · the follow-up worker's marked work", () => {
  it("does the summaries first, then archive brands oldest mark first, and notes the forced sweep", () => {
    const plan = markPlan([m("archive:b.com", "2026-11-23T02:00:00Z"), m(MARK_RECORDS_FORCE, "2026-11-23T01:00:00Z"), m("archive:a.com", "2026-11-23T01:30:00Z"), m(MARK_AGGREGATES, "2026-11-23T02:10:00Z")]);
    expect(plan.aggregates?.topic).toBe(MARK_AGGREGATES);
    expect(plan.archives.map(x => x.topic)).toEqual(["archive:a.com", "archive:b.com"]);
    expect(plan.force?.topic).toBe(MARK_RECORDS_FORCE);
    expect(archiveTopic("Example.COM")).toBe("archive:example.com");
  });
  it("a brand marked by ten posts is replayed once; a failed summaries refresh keeps its mark open", async () => {
    const done: string[] = [], replays: string[] = [];
    const r = await runMarkedWork(Date.now() + 10_000, {
      open: async () => [m(MARK_AGGREGATES, "2026-11-23T02:00:00Z"), m("archive:a.com", "2026-11-23T02:00:00Z")],
      clear: async x => { done.push(x.topic); },
      aggregates: async () => { throw new Error("timeout"); },
      replay: async d => { replays.push(d); },
    });
    expect(replays).toEqual(["a.com"]);
    expect(done).toEqual(["archive:a.com"]);
    expect(r.errors).toBe(1);
    expect(r.note).toBe("crawl summaries failed (next pass), archive replays 1");
  });
  it("stops at its deadline and leaves the rest marked for the next pass", async () => {
    let t = 0;
    const r = await runMarkedWork(3_000, { now: () => t, open: async () => ["a", "b", "c"].map(d => m(`archive:${d}.com`, "2026-11-23T02:00:00Z")), clear: async () => {}, aggregates: async () => {}, replay: async () => { t += 1_000; } });
    expect(r.left).toBe(1);
    expect(r.note).toBe("archive replays 2, 1 next pass");
  });
  it("says so when nothing was marked", async () => {
    expect((await runMarkedWork(Date.now() + 1000, { open: async () => [], clear: async () => {}, aggregates: async () => {}, replay: async () => {} })).note).toBe("nothing marked");
  });
});
