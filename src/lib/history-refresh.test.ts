// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HISTORY_VIEWS, historyNote, isHistoryView } from "./history-refresh";
import { refreshHistoryView, refreshLibraryHistory, resetHistoryEstimates, type HistoryRpc } from "./history-refresh.server";

// A fake database with the same rules as the SQL functions, on a fake clock.
type Db = { dirty: boolean; started_at: number | null; refreshed_at: number | null; locked: boolean };
const MIN = 60_000;
function fake(db: Db, clock: { t: number }, view: (name: string) => { ms: number; error?: boolean; during?: () => void } = () => ({ ms: 500 })) {
  const calls: string[] = [];
  const rpc: HistoryRpc = async (name, args) => {
    calls.push(name === "library_history_refresh_view" ? String(args["p_view"]) : name === "library_history_refresh_end" ? `end:${args["p_ok"]}` : name);
    if (name === "library_history_refresh_begin") {
      if (db.locked) return { data: { started: false, reason: "busy" }, error: null };
      if (!db.dirty) return { data: { started: false, reason: "clean" }, error: null };
      if (db.started_at !== null && db.started_at > clock.t - Number(args["p_min_age_seconds"]) * 1000) return { data: { started: false, reason: "recent" }, error: null };
      db.dirty = false; db.started_at = clock.t;
      return { data: { started: true, reason: "started" }, error: null };
    }
    if (name === "library_history_refresh_view") {
      if (!isHistoryView(args["p_view"])) return { data: null, error: { message: "unknown history view" } };
      const v = view(String(args["p_view"]));
      clock.t += v.ms; v.during?.();
      return v.error ? { data: null, error: { message: "canceling statement due to statement timeout" } } : { data: { ok: true, skipped: false, ms: v.ms }, error: null };
    }
    if (name === "library_history_refresh_end") { if (args["p_ok"]) db.refreshed_at = clock.t; else db.dirty = true; return { data: { dirty: db.dirty }, error: null }; }
    throw new Error(`unexpected ${name}`);
  };
  return { rpc, calls, views: () => calls.filter(c => isHistoryView(c)) };
}
let db: Db, clock: { t: number };
beforeEach(() => { resetHistoryEstimates(); clock = { t: Date.parse("2026-11-20T12:00:00Z") }; db = { dirty: true, started_at: null, refreshed_at: null, locked: false }; vi.spyOn(console, "info").mockImplementation(() => {}); });
const run = (rpc: HistoryRpc, ms = 15_000) => refreshLibraryHistory({ deadline: clock.t + ms, now: () => clock.t, rpc, job: "test" });

describe("library history refresh step", () => {
  it("not dirty → no view calls", async () => {
    db.dirty = false;
    const f = fake(db, clock), r = await run(f.rpc);
    expect(r.outcome).toBe("clean");
    expect(f.views()).toEqual([]);
    expect(f.calls).toEqual(["library_history_refresh_begin"]);
  });
  it("dirty → five calls in order, then the finish time is recorded and dirty stays clear", async () => {
    const f = fake(db, clock), r = await run(f.rpc);
    expect(f.views()).toEqual([...HISTORY_VIEWS]);
    expect(f.calls.at(-1)).toBe("end:true");
    expect(r).toMatchObject({ outcome: "started", complete: true });
    expect(db).toMatchObject({ dirty: false, refreshed_at: clock.t });
  });
  it("a failing view stops the step, leaves dirty true and does not throw", async () => {
    const f = fake(db, clock, v => (v === "library_signal_series_mat" ? { ms: 8_000, error: true } : { ms: 500 }));
    const r = await run(f.rpc);
    expect(f.views()).toEqual(["library_history_share_mat", "library_signal_series_mat"]);
    expect(r).toMatchObject({ complete: false, stopped: { view: "library_signal_series_mat", why: "failed" } });
    expect(db.dirty).toBe(true);
    expect(db.refreshed_at).toBeNull();
  });
  it("a refresh started under 5 minutes ago is skipped; after 5 minutes it runs", async () => {
    db.started_at = clock.t - 4 * MIN;
    const f = fake(db, clock);
    expect((await run(f.rpc)).outcome).toBe("recent");
    expect(f.views()).toEqual([]);
    expect(db.dirty).toBe(true);
    clock.t += 2 * MIN;
    expect((await run(f.rpc)).complete).toBe(true);
  });
  it("a batch arriving mid-refresh leaves dirty true afterwards", async () => {
    const f = fake(db, clock, v => (v === "library_css_series_mat" ? { ms: 500, during: () => { db.dirty = true; } } : { ms: 500 }));
    const r = await run(f.rpc);
    expect(r.complete).toBe(true);
    expect(db.dirty).toBe(true);
  });
  it("stops before a view whose usual time no longer fits, and puts dirty back", async () => {
    const f = fake(db, clock, () => ({ ms: 5_000 }));
    const r = await run(f.rpc, 6_000);
    expect(f.views()).toEqual(["library_history_share_mat"]);
    expect(r).toMatchObject({ complete: false, stopped: { view: "library_signal_series_mat", why: "deadline" } });
    expect(db.dirty).toBe(true);
  });
  it("a view that hangs is cut off at the deadline and the step still ends", async () => {
    const f = fake(db, clock);
    const hang: HistoryRpc = (name, args) => (name === "library_history_refresh_view" ? new Promise(() => {}) : f.rpc(name, args));
    const r = await refreshLibraryHistory({ deadline: Date.now() + 6_000, rpc: hang, job: "test" }).catch(e => e);
    expect(r).toMatchObject({ complete: false, stopped: { view: "library_history_share_mat", why: "cut_off" } });
    expect(db.dirty).toBe(true);
  }, 10_000);
  it("another refresh holding the lock → busy, nothing refreshed", async () => {
    db.locked = true;
    const f = fake(db, clock);
    expect((await run(f.rpc)).outcome).toBe("busy");
    expect(f.views()).toEqual([]);
  });
  it("never throws, even when the database call throws", async () => {
    const r = await run(async () => { throw new Error("network"); });
    expect(r.outcome).toBe("error");
  });
});

describe("view-name guard", () => {
  it("accepts exactly the five history views", () => {
    expect(HISTORY_VIEWS.every(isHistoryView)).toBe(true);
    for (const bad of ["library_sites", "public.library_history_share_mat", "library_history_share_live", "LIBRARY_TAG_SERIES_MAT", "", null, 3]) expect(isHistoryView(bad)).toBe(false);
  });
  it("refuses any other name without calling the database", async () => {
    const rpc = vi.fn<HistoryRpc>(async () => ({ data: { ok: true }, error: null }));
    await expect(refreshHistoryView(rpc, "library_sites; drop table x")).rejects.toThrow("unknown history view");
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("health note", () => {
  const now = Date.parse("2026-11-20T12:00:00Z");
  it("says nothing while the series were refreshed within the hour", () => expect(historyNote({ refreshed_at: new Date(now - 59 * MIN).toISOString() }, now)).toBeNull());
  it("says when they were last refreshed once that is more than an hour ago", () => expect(historyNote({ refreshed_at: new Date(now - 3 * 60 * MIN).toISOString() }, now)).toBe("history series last refreshed 3h ago (2026-11-20 09:00 UTC)"));
  it("unreadable facts leave the note as before", () => expect(historyNote(null, now)).toBeNull());
});
