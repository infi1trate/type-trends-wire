import { describe, expect, it } from "vitest";
import { buildHealth, phReason, type HealthFacts } from "./health";

const NOW = new Date("2026-11-23T13:33:00Z"), t = NOW.getTime(), H = 3_600_000;
const ago = (ms: number) => new Date(t - ms).toISOString();
const base: HealthFacts = { ingest: {}, library_check_at: ago(H), library_full_at: ago(H), wayback_received_at: null, crawl_runs: [], forecast_runs: [], bluesky_window_end: ago(5 * H), taste_refreshed_at: ago(H) };
const job = (f: HealthFacts, name: string) => buildHealth(f, NOW).jobs.find(j => j.job === name);

describe("D1c · records health can read", () => {
  it("a discourse sample older than 10 hours reads late, not ok", () => {
    const j = job({ ...base, bluesky_window_end: "2026-11-23T01:15:37Z" }, "discourse")!;
    expect([j.stale, j.last_status]).toEqual([true, "late"]);
    expect(j.note).toBe("Bluesky sampler (crawler); nothing has arrived for 12h (stale after 10h)");
    expect(job(base, "discourse")!.last_status).toBe("ok");
  });
  it("the Product Hunt ingest is in the jobs list with what it fetched", () => {
    const j = job({ ...base, producthunt: { last_run_at: ago(5 * H), last_ok_at: ago(5 * H), last_ok: true, failures_since_ok: 0, fetched: 20, written: 20, error: null } }, "producthunt")!;
    expect([j.last_status, j.stale, j.note]).toEqual(["ok", false, "20 launches fetched in the last run, 20 new"]);
  });
  it("a refused token reads as refused, and stays out of the list when its receipts are unreadable", () => {
    const j = job({ ...base, producthunt: { last_run_at: ago(H), last_ok_at: ago(60 * H), last_ok: false, failures_since_ok: 3, error: "Product Hunt: HTTP 401" } }, "producthunt")!;
    expect([j.last_status, j.stale, j.consecutive_failures, j.note]).toEqual(["error", true, 3, "last run failed: the token was refused"]);
    expect(job(base, "producthunt")).toBeUndefined();
  });
  it("plain reasons, never the request", () => {
    expect(["Product Hunt: HTTP 403", "Product Hunt: HTTP 500", "PRODUCT_HUNT_TOKEN not set", "The operation timed out."].map(phReason))
      .toEqual(["the token was refused", "Product Hunt answered 500", "no token is set", "Product Hunt did not answer in 15 s"]);
  });
});
