// N4b · the desk jobs' new rules, from the brief's own words: at most 5 items a pass, one pass per 10 minutes, a start row with no
// finish after 2 minutes is a failed pass and two stop the check for the day; never while another product job is inside its limit and
// never at :00, :15, :30 or :45; job_hold is engineering's and the owner's, at most seven days ahead; the history refresh is never "late".
import { describe, expect, it } from "vitest";
import { PASS_ITEMS_MAX, PASS_SCHEDULE, activeHolds, busyJob, checkDay, holdUntilProblem, slotOf, type PassEnd, type PassStart, type HoldRow } from "./passes";
import { jobProblems } from "./engineering";
import { doorCall, type DeskDeps } from "../stories/desk.server";
import { NEWS_LIMIT_MS, NEWS_WHY_EVERY_MS } from "./news";

const at = (hhmmss: string) => Date.parse(`2026-11-23T${hhmmss}Z`);
const iso = (t: number) => new Date(t).toISOString();
const plan = ["story:a", "story:b", "story:c", "story:d", "story:e", "story:f", "story:g", "study:x"];
const start = (id: number, t: number, items: string[], withPlan = false): PassStart => ({ id, at: iso(t), check: "share", day: "2026-11-23", slot: slotOf(t), items, plan: withPlan ? plan : null });
const end = (id: number, t: number, results: PassEnd["results"], ok = true): PassEnd => ({ pass_id: id, at: iso(t), ok, ms: 4000, results, error: ok ? null : "boom" });
const done = (ids: string[]) => ids.map(id => ({ id, ok: true, done: true, error: null }));

describe("N4b · the scheduled share and chart passes", () => {
  it("the schedule runs every 10 minutes at minute 7 and never at :00, :15, :30 or :45", () => {
    expect(PASS_SCHEDULE.cron).toBe("7-57/10 1-3 * * *");
    const minutes = [7, 17, 27, 37, 47, 57];
    expect(minutes.some(m => m % 15 === 0)).toBe(false);
    for (const m of minutes) expect(busyJob(at(`02:${String(m).padStart(2, "0")}:00`))).toBeNull();
  });
  it("never while another product job is inside its time limit, or about to start", () => {
    expect(busyJob(at("02:15:30"))).toMatch(/ingest-wire/);
    expect(busyJob(at("02:05:40"))).toMatch(/library-ai-worker/);
    expect(busyJob(at("02:09:50"))).toMatch(/starts within 20 s/);
  });
  it("one pass per ten-minute slot", () => {
    expect(slotOf(at("02:07:00"))).toBe(slotOf(at("02:09:59")));
    expect(slotOf(at("02:07:00"))).not.toBe(slotOf(at("02:17:00")));
  });
  it("at most five items a pass, resuming where the last pass stopped", () => {
    expect(PASS_ITEMS_MAX).toBe(5);
    const s1 = start(1, at("02:07:00"), plan.slice(0, 5), true);
    const c = checkDay("share", [s1], [end(1, at("02:07:12"), [...done(["story:a", "story:b", "story:c"]), { id: "story:d", ok: false, done: true, error: "the image took over 5 s" }])], at("02:17:00"));
    expect(c.next).toEqual(["story:e", "story:f", "story:g", "study:x"]);
    expect(c.failing).toEqual([{ id: "story:d", error: "the image took over 5 s" }]);
    expect(c.status).toBe("due");
  });
  it("a start row with no finish row after 2 minutes is a failed pass; its items are not retried today", () => {
    const s1 = start(1, at("02:07:00"), plan.slice(0, 5), true);
    expect(checkDay("share", [s1], [], at("02:08:30")).status).toBe("running");
    const c = checkDay("share", [s1], [], at("02:09:01"));
    expect(c.failedPasses).toBe(1);
    expect(c.next).toEqual(["story:f", "story:g", "study:x"]);
  });
  it("two failed passes stop the check for the day", () => {
    const s1 = start(1, at("02:07:00"), plan.slice(0, 5), true), s2 = start(2, at("02:17:00"), ["story:f", "story:g", "study:x"]);
    expect(checkDay("share", [s1, s2], [end(2, at("02:17:05"), [], false)], at("02:27:00")).status).toBe("stopped");
  });
  it("a day whose every item is done or failing is complete", () => {
    const s1 = start(1, at("02:07:00"), plan.slice(0, 5), true), s2 = start(2, at("02:17:00"), plan.slice(5));
    const c = checkDay("share", [s1, s2], [end(1, at("02:07:10"), done(plan.slice(0, 5))), end(2, at("02:17:10"), done(plan.slice(5)))], at("02:27:00"));
    expect(c.status).toBe("complete");
  });
});

describe("N4b · the news desk's turn", () => {
  it("has its own 25-second limit and says why it did not call at most once an hour", () => {
    expect(NEWS_LIMIT_MS).toBe(25_000);
    expect(NEWS_WHY_EVERY_MS).toBe(3_600_000);
  });
});

describe("N4b · job holds", () => {
  const now = at("10:00:00");
  it("a hold ends at most 7 days ahead and in the future", () => {
    expect(holdUntilProblem(iso(now + 6 * 864e5), now)).toBeNull();
    expect(holdUntilProblem(iso(now + 8 * 864e5), now)).toMatch(/7 days/);
    expect(holdUntilProblem(iso(now - 1000), now)).toMatch(/future/);
  });
  it("a hold counts until its time or its release", () => {
    const rows: HoldRow[] = [
      { id: 1, at: iso(now - 1000), actor: "engineering", action: "job_hold", job: "share", until: iso(now + 3600_000), reason: "stalls" },
      { id: 2, at: iso(now - 900), actor: "owner", action: "job_hold", job: "chart", until: iso(now + 3600_000), reason: "stalls" },
      { id: 3, at: iso(now - 800), actor: "owner", action: "job_release", job: "chart", until: null, reason: "fixed" },
      { id: 4, at: iso(now - 700), actor: "engineering", action: "job_hold", job: "picks", until: iso(now - 1), reason: "old" },
    ];
    expect(activeHolds(rows, now).map(h => h.job)).toEqual(["share"]);
  });
  const deps = (holds: { job: string }[] = []): DeskDeps => ({ authorize: async () => true, allow: () => true, now: () => now, store: { exists: async () => false, insertEdit: async () => { throw new Error("no"); }, queue: async () => ({}), log: async () => 1, jobHolds: async () => holds.map(h => ({ ...h, actor: "engineering", reason: "x", until: iso(now + 1), at: iso(now), log: 1 })) } });
  const hold = { action: "job_hold", job: "share", until: iso(now + 864e5), reason: "the share check stalled the site" };
  it("job_hold and job_release are refused for other desks", async () => {
    for (const actor of ["graphics", "news", "data", "design review", "standards"]) {
      expect((await doorCall(deps(), { actor, ...hold })).status).toBe(403);
      expect((await doorCall(deps([{ job: "share" }]), { actor, action: "job_release", job: "share", reason: "done" })).status).toBe(403);
    }
  });
  it("engineering can hold and release; a release needs a hold in force; until over 7 days is refused", async () => {
    expect((await doorCall(deps(), { actor: "engineering", ...hold })).status).toBe(201);
    expect((await doorCall(deps(), { actor: "engineering", ...hold, until: iso(now + 8 * 864e5) })).status).toBe(400);
    expect((await doorCall(deps(), { actor: "engineering", ...hold, job: "everything" })).status).toBe(400);
    expect((await doorCall(deps([{ job: "share" }]), { actor: "engineering", action: "job_release", job: "share", reason: "fixed" })).status).toBe(201);
    expect((await doorCall(deps(), { actor: "engineering", action: "job_release", job: "share", reason: "fixed" })).status).toBe(409);
  });
});

describe("N4b · the health run", () => {
  it("the history refresh records a run only after captures arrive, so a long gap is never called late", () => {
    const runs = [0, 1, 2, 3, 4].map(i => ({ started_at: iso(at("02:50:00") - i * 600_000), finished_at: iso(at("02:50:01") - i * 600_000), ok: null }));
    expect(jobProblems("library-history-refresh", runs, at("10:19:00")).map(p => p.key)).toEqual([]);
    expect(jobProblems("ingest-wire", runs, at("10:19:00")).map(p => p.key)).toEqual(["health:job-late:ingest-wire"]);
  });
});
