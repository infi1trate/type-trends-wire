// T2 · A: a carried reading is never a second sighting that confirms a change, and never a fresh reading for the steadiness rule.
import { describe, expect, it, vi } from "vitest";

const calls: { fn: string; args: Record<string, unknown> }[] = [], updates: unknown[] = [];
const baseline = { domain: "x.com", page_type: "home", viewport: "desktop", kind: "vision", signals: { ai_tags: { aesthetic: ["minimal"] } }, pending: { ai_tags: { value: { aesthetic: ["brutalist"] }, first_snapshot_id: 10, seen: 1 } }, snapshot_id: 9, last_snapshot_id: 10, captured_at: "2026-11-14T12:00:00Z", confirmed_at: "2026-11-01T00:00:00Z" };
vi.mock("@/integrations/supabase/client.server", () => {
  const q = (table: string) => {
    const self: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "order", "limit"]) self[m] = () => self;
    self["maybeSingle"] = async () => ({ data: table === "library_ai_baselines" ? baseline : null, error: null });
    self["update"] = (v: unknown) => { updates.push(v); return self; };
    self["then"] = (res: (v: unknown) => void) => res({ error: null });
    return self;
  };
  return { supabaseAdmin: { from: q, rpc: async (fn: string, args: Record<string, unknown>) => { calls.push({ fn, args }); return { data: true, error: null }; } } };
});
vi.mock("./library-archive.server", () => ({ replayArchive: async () => {} }));

describe("T2 carried readings stay honest", () => {
  it("store the baseline and pending change unchanged, with no event, and mark the row carried", async () => {
    const { storeCarriedVision } = await import("./ai-store.server");
    const ok = await storeCarriedVision({ id: 11, domain: "x.com", page_type: "home", viewport: "desktop", captured_at: "2026-11-21T12:00:00Z", source: "live" }, "m", { aesthetic: ["brutalist"] } as never, "2026-11-14T12:00:00Z", "v1");
    expect(ok).toBe(true);
    const state = calls.find(c => c.fn === "library_ai_store")!.args["p_state"] as { baseline: { signals: unknown; snapshot_id: number }; pending: unknown; events: unknown[] };
    expect(state.events).toEqual([]);
    expect(state.pending).toEqual(baseline.pending);
    expect(state.baseline).toEqual({ signals: baseline.signals, snapshot_id: 9, confirmed_at: baseline.confirmed_at });
    expect(updates).toEqual([{ carried_from: "2026-11-14T12:00:00Z", read_version: "v1" }]);
  });
  it("the steadiness rule reads the fresh reading a carried one came from, with its own date", async () => {
    const { runReadings } = await import("./stories/steady.server");
    const snaps = [{ id: 1, domain: "x.com", captured_at: "2026-11-14T12:00:00Z" }, { id: 2, domain: "x.com", captured_at: "2026-11-21T12:00:00Z" }];
    const tags = [{ snapshot_id: 1, created_at: "2026-11-14T12:01:00Z", tags: { hero_layout: "centered_stack" }, carried_from: null }, { snapshot_id: 2, created_at: "2026-11-21T12:01:00Z", tags: { hero_layout: "centered_stack" }, carried_from: "2026-11-14T12:00:00Z" }];
    const chain = (rows: unknown[]) => { const s: Record<string, unknown> = {}; for (const m of ["select", "in", "eq", "lte", "order"]) s[m] = () => s; s["range"] = async () => ({ data: rows, error: null }); s["then"] = (r: (v: unknown) => void) => r({ data: rows, error: null }); return s; };
    const db = { from: (t: string) => chain(t === "library_snapshots" ? snaps : tags) };
    const r = await runReadings(db, ["x.com"], ["2026-11-22T00:00:00Z"]);
    const x = r.get("2026-11-22T00:00:00Z")!.get("x.com")!;
    expect(Object.values(x).every(v => v!.at === "2026-11-14T12:00:00Z")).toBe(true);
    expect(Object.keys(x).length).toBeGreaterThan(0);
  });
});
