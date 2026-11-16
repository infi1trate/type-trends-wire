import { describe, expect, it } from "vitest";
import { createPoller, POLL_MS, type PollEnv } from "./poll";
import { announcement, insertPending, newStoriesText, pendingStories, sinceVisit, visitStore, LAST_VISIT_KEY } from "./new-stories";
import { updatesEtag, updatesResponse, UPDATES_PATH } from "./updates";
import { frontModel, updatesOf } from "./front";
import { gate, isOpenPath } from "../gate";
import { H, NOW, input, iso, st } from "./fixtures";

function fakeEnv(o: { hidden?: boolean; saveData?: boolean } = {}) {
  const timers: { fn: () => void; ms: number }[] = []; let vis: (() => void) | null = null;
  const env: PollEnv & { hide: (h: boolean) => void } = {
    hidden: () => !!o.hidden, saveData: () => !!o.saveData,
    setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimer: () => {},
    onVisibility: fn => { vis = fn; return () => { vis = null; }; },
    hide: h => { o.hidden = h; vis?.(); },
  };
  const run = async () => { const t = timers.shift(); t?.fn(); await new Promise(r => setTimeout(r, 0)); return t?.ms; };
  return { env, timers, run };
}

describe("polling helper", () => {
  it("polls every 60 seconds while visible and sends the last ETag", async () => {
    const { env, timers, run } = fakeEnv(), sent: (string | null)[] = [], got: number[] = [];
    const p = createPoller<number>(async etag => { sent.push(etag); return { status: 200, etag: `e${sent.length}`, data: sent.length }; }, d => got.push(d), env);
    p.start(); expect(timers[0]!.ms).toBe(POLL_MS);
    await run(); await run();
    expect(sent).toEqual([null, "e1"]); expect(got).toEqual([1, 2]);
  });
  it("pauses when the tab is hidden and resumes when it is visible", async () => {
    const { env, timers, run } = fakeEnv(); let calls = 0;
    const p = createPoller(async () => { calls++; return { status: 304 as const }; }, () => {}, env);
    p.start(); env.hide(true); expect(p.state()).toBe("paused");
    timers.length = 0; env.hide(false); await new Promise(r => setTimeout(r, 0));
    expect(calls).toBe(1); expect(p.state()).toBe("waiting"); await run();
  });
  it("backs off on errors (doubling, capped) and resets after a success", async () => {
    const { env, run } = fakeEnv(); let fail = 3;
    const p = createPoller(async () => { if (fail-- > 0) throw new Error("x"); return { status: 304 as const }; }, () => {}, env, { interval: 1000, max: 5000 });
    p.start(); await run(); expect(p.delay()).toBe(2000); await run(); expect(p.delay()).toBe(4000); await run(); expect(p.delay()).toBe(5000); await run(); expect(p.delay()).toBe(1000);
  });
  it("does not poll under Save-Data", async () => {
    const { env, timers } = fakeEnv({ saveData: true });
    const p = createPoller(async () => ({ status: 304 as const }), () => {}, env); p.start();
    expect([p.state(), timers.length]).toEqual(["save-data", 0]);
  });
});

describe("new-stories control", () => {
  const shown = [{ id: "a", at: "2026-11-16T10:00:00Z" }, { id: "b", at: "2026-11-16T09:00:00Z" }];
  const incoming = [{ id: "c", at: "2026-11-16T12:00:00Z" }, { id: "a", at: "2026-11-16T10:00:00Z" }, { id: "d", at: "2026-11-16T13:00:00Z" }];
  it("counts only unseen stories and inserts them newest first, focusing the first inserted", () => {
    const pending = pendingStories(shown, incoming);
    expect(pending.map(p => p.id)).toEqual(["d", "c"]);
    expect(newStoriesText(pending.length)).toBe("2 new stories");
    const r = insertPending(shown, pending);
    expect(r.items.map(i => i.id)).toEqual(["d", "c", "a", "b"]);
    expect(r.focusId).toBe("d");
  });
  it("announces a count once", () => {
    expect(announcement(0, 2)).toBe("2 new stories");
    expect(announcement(2, 2)).toBeNull();
    expect(announcement(2, 0)).toBeNull();
    expect(announcement(2, 1)).toBe("1 new story");
  });
  it("since your last visit: count and marker position, stored on this device only", () => {
    expect(sinceVisit(shown, "2026-11-16T09:30:00Z")).toEqual({ count: 1, beforeId: "b" });
    expect(sinceVisit(shown, null)).toBeNull();
    const mem = new Map<string, string>(), store = visitStore(() => ({ getItem: k => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v) }));
    store.write("2026-11-16T09:30:00Z"); expect([store.read(), [...mem.keys()]]).toEqual(["2026-11-16T09:30:00Z", [LAST_VISIT_KEY]]);
    expect(visitStore(() => { throw new Error("blocked"); }).read()).toBeNull();
  });
});

describe("/front.json", () => {
  const model = (now = NOW) => frontModel(input({ now, stories: [st("a", { happened_at: iso(NOW - 2 * H), number: 1 })] }));
  it("is gated like the pages", async () => {
    expect(isOpenPath(UPDATES_PATH)).toBe(false);
    const res = await gate(new Request(`http://localhost${UPDATES_PATH}`));
    expect(res?.status).toBe(401);
  });
  it("answers the changeable parts with an ETag, and 304 when nothing changed (the clock alone is not a change)", async () => {
    const u = updatesOf(model());
    expect(Object.keys(u).sort()).toEqual(["freshness", "items", "lead", "moving", "now", "state"]);
    const r = await updatesResponse(u, null);
    expect([r.status, r.headers.get("cache-control"), r.headers.get("content-type")]).toEqual([200, "private, max-age=30", "application/json; charset=utf-8"]);
    const etag = r.headers.get("etag")!;
    expect(etag).toMatch(/^W\/"[0-9a-f]{24}"$/);
    expect((await updatesResponse({ ...u, now: iso(NOW + 5000) }, etag)).status).toBe(304);
    expect(await updatesEtag({ ...u, state: "busy" })).not.toBe(etag);
    const body = await r.json() as typeof u;
    expect([body.lead?.id, body.state]).toEqual(["a", "steady"]);
  });
});
