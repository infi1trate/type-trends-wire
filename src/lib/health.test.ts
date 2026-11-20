import { describe, it, expect } from "vitest";
import { buildHealth, isStale, overallStatus, EVERY_MS, type HealthFacts } from "./health";

const NOW = new Date("2026-11-14T17:00:00Z"), t = NOW.getTime();
const ago = (msAgo: number) => new Date(t - msAgo).toISOString();
const H = 3_600_000, D = 24 * H;
const fresh: HealthFacts = {
  ingest: { "ingest-wire": { last_ok_at: ago(10 * 60_000), last_run_at: ago(10 * 60_000), last_ok: true, failures_since_ok: 0 }, "ingest-gfonts": { last_ok_at: ago(11 * H), last_run_at: ago(11 * H), last_ok: true, failures_since_ok: 0 } },
  library_check_at: ago(4 * H), library_full_at: ago(4 * H), wayback_received_at: ago(3 * H),
  crawl_runs: [{ status: "finished", started_at: ago(4 * D), finished_at: ago(4 * D - H), ok: 1012, tried: 1290 }],
  forecast_runs: [{ status: "ok", computed_at: ago(17 * H) }],
  ai_jobs: { pending: 0, oldest_pending_at: null, last_done_at: ago(H), last_activity_at: ago(H), paused: false }, ai_interrupted_24h: 0,
  render_queue: { pending: 0, oldest_pending_at: null, last_done_at: ago(D) },
  bluesky_window_end: ago(5 * H), taste_refreshed_at: ago(17 * H),
  brief: { week: "2026-W46", created_at: ago(D), card_at: ago(3 * H) },
};
const job = (f: HealthFacts, name: string) => buildHealth(f, NOW).jobs.find(j => j.job === name)!;

describe("staleness = last ok older than 2× interval", () => {
  for (const every of ["15m", "6h", "1d", "7d"] as const) {
    it(`${every}: fresh just under 2×`, () => expect(isStale(ago(2 * EVERY_MS[every] - 1000), every, t)).toBe(false));
    it(`${every}: stale just over 2×`, () => expect(isStale(ago(2 * EVERY_MS[every] + 1000), every, t)).toBe(true));
  }
  it("never-succeeded jobs are stale", () => expect(isStale(null, "1d", t)).toBe(true));
  it("wire stale after 30 minutes", () => expect(job({ ...fresh, ingest: { ...fresh.ingest, "ingest-wire": { last_ok_at: ago(31 * 60_000), last_ok: false, failures_since_ok: 2 } } }, "wire")).toMatchObject({ stale: true, last_status: "error", consecutive_failures: 2 }));
  it("queue stale when oldest pending > 6h", () => {
    expect(job({ ...fresh, ai_jobs: { pending: 3, oldest_pending_at: ago(7 * H) } }, "library_ai").stale).toBe(true);
    expect(job({ ...fresh, ai_jobs: { pending: 3, oldest_pending_at: ago(5 * H) } }, "library_ai").stale).toBe(false);
    expect(job({ ...fresh, render_queue: { pending: 1, oldest_pending_at: ago(6 * H + 60_000) } }, "render_queue").stale).toBe(true);
  });
  it("bluesky discourse stale after 10h", () => { expect(job({ ...fresh, bluesky_window_end: ago(11 * H) }, "discourse").stale).toBe(true); expect(job({ ...fresh, bluesky_window_end: ago(9 * H) }, "discourse").stale).toBe(false); });
  it("wayback ignored when no archive captures for 14 days", () => expect(job({ ...fresh, wayback_received_at: ago(20 * D) }, "wayback")).toMatchObject({ stale: false, last_status: "idle" }));
  it("wayback stale at 12h+ while active", () => expect(job({ ...fresh, wayback_received_at: ago(13 * H) }, "wayback").stale).toBe(true));
  it("chart card stale when the latest brief has no card", () => expect(job({ ...fresh, brief: { week: "2026-W47", created_at: ago(H), card_at: null } }, "chart_card")).toMatchObject({ stale: true, last_status: "missing" }));
  it("crawl below 70% ok-rate is flagged", () => expect(job({ ...fresh, crawl_runs: [{ status: "finished", started_at: ago(D), finished_at: ago(D), ok: 60, tried: 100 }] }, "crawl").last_status).toBe("low_ok_rate"));
  it("forecast counts errors since the last ok run", () => expect(job({ ...fresh, forecast_runs: [{ status: "error", computed_at: ago(H) }, { status: "error", computed_at: ago(2 * H) }, { status: "ok", computed_at: ago(D) }] }, "forecast").consecutive_failures).toBe(2));
});

describe("overall status", () => {
  it("ok when nothing is stale", () => expect(buildHealth(fresh, NOW).status).toBe("ok"));
  it("down when a core job (wire) is stale", () => expect(buildHealth({ ...fresh, ingest: { ...fresh.ingest, "ingest-wire": { last_ok_at: ago(H) } } }, NOW).status).toBe("down"));
  it("down when crawl is stale", () => expect(buildHealth({ ...fresh, crawl_runs: [{ status: "finished", started_at: ago(15 * D), finished_at: ago(15 * D), ok: 9, tried: 10 }] }, NOW).status).toBe("down"));
  it("down when forecast is stale", () => expect(buildHealth({ ...fresh, forecast_runs: [{ status: "ok", computed_at: ago(15 * D) }] }, NOW).status).toBe("down"));
  it("degraded when a non-core job is stale", () => expect(buildHealth({ ...fresh, taste_refreshed_at: ago(15 * D) }, NOW).status).toBe("degraded"));
  it("degraded when the crawl ok-rate is low", () => expect(overallStatus([{ job: "crawl", stale: false, last_status: "low_ok_rate" }])).toBe("degraded"));
});

describe("payload safety", () => {
  it("contains no secrets or URLs", () => {
    const s = JSON.stringify(buildHealth({ ...fresh, timeouts: [{ job: "forecast-weekly", has_timeout: false }] }, NOW));
    expect(s).not.toMatch(/https?:\/\//); expect(s).not.toMatch(/token|bearer|apikey|api_key|secret|sb_publishable|sb_secret|eyJ/i);
  });
  it("adds the timeout note when a job lacks a callback timeout", () => expect(job({ ...fresh, timeouts: [{ job: "dsgn-library-ai-worker", has_timeout: false }] }, "library_ai").note).toContain("callback timeout 5s — worker may be cut off"));
});
describe("wayback day-level receipts", () => {
  it("counts a midnight run-date receipt as end of that day and reports the date as-is", () => {
    const j = job({ ...fresh, wayback_received_at: "2026-11-14T00:00:00Z" }, "wayback");
    expect(j.stale).toBe(false); expect(j.last_ok_at).toBe("2026-11-14T00:00:00Z"); expect(j.note).toContain("day-level");
  });
});
describe("forecast failure note", () => {
  it("shows the stored error of a failed latest run", () => {
    const j = job({ ...fresh, forecast_runs: [{ status: "error", computed_at: ago(H), error: "taste: 57014 canceling statement due to statement timeout" }, { status: "ok", computed_at: ago(D) }] }, "forecast");
    expect(j.note).toBe("last run failed: taste: 57014 canceling statement due to statement timeout"); expect(j.consecutive_failures).toBe(1);
  });
  it("says no detail when an older failed run has no error text", () => expect(job({ ...fresh, forecast_runs: [{ status: "error", computed_at: ago(H) }] }, "forecast").note).toBe("last run failed: no detail recorded"));
  it("no failure note when the latest run is ok", () => expect(job(fresh, "forecast").note).toBeUndefined());
});

describe("library_check history note", () => {
  it("keeps the note unchanged when the history series are fresh or unknown", () => {
    expect(job(fresh, "library_check").note).toBe("newest live capture (daily check or Saturday full)");
    expect(job({ ...fresh, library_history: { refreshed_at: ago(30 * 60_000) } }, "library_check").note).toBe("newest live capture (daily check or Saturday full)");
  });
  it("adds when the history series were last refreshed once that is over an hour ago", () => {
    expect(job({ ...fresh, library_history: { refreshed_at: ago(2 * H) } }, "library_check").note).toBe("newest live capture (daily check or Saturday full); history series last refreshed 2h ago (2026-11-14 15:00 UTC)");
  });
});

describe("E2b · story writer on the health page", () => {
  it("shows today's writer calls against the daily limit and never goes stale", () => {
    const j = job({ ...fresh, story_writer: { calls_today: 3, last_call_at: ago(H), last_checked_at: ago(H) } } as HealthFacts, "story_writer");
    expect(j.note).toBe("3 of 12 writer calls today (UTC)"); expect(j.stale).toBe(false); expect(j.last_status).toBe("ok");
  });
  it("unreadable writer facts change nothing else", () => {
    expect(job(fresh, "story_writer").note).toBe("writer facts unavailable");
    expect(buildHealth(fresh, NOW).status).toBe("ok");
  });
});
