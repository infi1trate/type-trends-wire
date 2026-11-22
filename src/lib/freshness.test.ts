import { describe, expect, it } from "vitest";
import { JOBS, LATE_FACTOR, READER_FACING, VANGUARD_RUN_PREFIX, freshness, freshnessLine, nextExpected, rhythmText, wireOnTime } from "./freshness";

const NOW = Date.parse("2026-11-16T12:00:00Z"), ago = (min: number) => new Date(NOW - min * 60_000).toISOString();
const row = (rows: ReturnType<typeof freshness>, id: string) => rows.find(r => r.id === id)!;

describe("freshness", () => {
  it("knows every recurring job once, in plain words, with its rhythm", () => {
    expect(new Set(JOBS.map(j => j.id)).size).toBe(JOBS.length);
    expect(JOBS.map(j => j.id)).toEqual(expect.arrayContaining(["wire", "library_ai", "gfonts", "producthunt", "library_check", "library_full", "crawl", "crops", "forecast", "follow_ups", "stories", "digest"]));
    expect(LATE_FACTOR).toBe(2);
    expect(rhythmText(JOBS.find(j => j.id === "wire")!.rhythm)).toBe("Every 15 minutes");
    expect(rhythmText(JOBS.find(j => j.id === "forecast")!.rhythm)).toBe("Weekly, Sunday 09:30 UTC");
    expect(rhythmText(JOBS.find(j => j.id === "gfonts")!.rhythm)).toBe("Daily at 06:17 UTC");
  });
  it("on time: wire finished 6 minutes ago; the line states the times", () => {
    const rows = freshness({ wire: { ran: ago(7), finished: ago(6) }, library_check: { ran: ago(3 * 1440) }, forecast: { ran: "2026-11-15T15:33:42Z" } }, NOW);
    expect(row(rows, "wire").state).toBe("on_time");
    expect(row(rows, "library_check").state).toBe("late"); // hourly slices, 3 days old
    expect(wireOnTime(rows)).toBe(true);
    const ok = freshness({ wire: { ran: ago(7), finished: ago(6) }, library_check: { ran: ago(40) }, forecast: { ran: "2026-11-15T15:33:42Z" } }, NOW, JOBS.filter(j => ["wire", "library_check", "forecast"].includes(j.id)));
    expect(freshnessLine(ok, NOW)).toEqual({ late: false, text: "Wire checked 6 minutes ago · Library crawl 40 minutes ago · Forecast 15 Nov" });
  });
  it("late: more than twice the interval since the last finish is late (on /status), and the reader line stays plain", () => {
    const rows = freshness({ wire: { ran: ago(47), finished: ago(47) } }, NOW, JOBS.filter(j => j.id === "wire"));
    expect(rows[0]!.state).toBe("late");
    expect(wireOnTime(rows)).toBe(false);
    expect(freshnessLine(rows, NOW)).toEqual({ late: false, text: "Wire checked 47 minutes ago" }); // N4c: lateness goes to /desk and /status, never the reader line
    // Exactly twice the interval is still on time.
    expect(freshness({ wire: { ran: ago(30) } }, NOW, JOBS.filter(j => j.id === "wire"))[0]!.state).toBe("on_time");
  });
  it("never ran, dormant, idle and waiting work", () => {
    const rows = freshness({ producthunt: { ran: null, dormant: "Waiting for a Product Hunt developer token" }, library_ai: { ran: ago(3000), idle: true }, follow_ups: { ran: ago(90), waiting_since: ago(90) } }, NOW);
    expect(row(rows, "crops").state).toBe("never");
    expect(row(rows, "producthunt").state).toBe("dormant");
    expect(row(rows, "library_ai").state).toBe("on_time");
    expect(row(rows, "follow_ups").state).toBe("late"); // 90 minutes > 2 × 30
    expect(freshnessLine(freshness({}, NOW, JOBS.filter(j => j.id === "crops")), NOW).late).toBe(false);
  });
  it("crawler-side lateness stays on /status: the shell line states its time but raises no warning", () => {
    const rows = freshness({ wire: { ran: ago(7), finished: ago(6) }, library_check: { ran: ago(3 * 1440) }, discourse: { ran: ago(22 * 60) }, forecast: { ran: "2026-11-15T15:33:42Z" } }, NOW);
    expect(row(rows, "library_check").state).toBe("late");
    expect(row(rows, "discourse").state).toBe("late");
    expect(freshnessLine(rows, NOW)).toEqual({ late: false, text: "Wire checked 6 minutes ago · Library crawl 3 days ago · Forecast 15 Nov" });
    for (const id of ["library_check", "vanguard", "library_full", "crawl", "crops", "discourse", "wayback"] as const) expect(READER_FACING.has(id)).toBe(false);
  });
  it("N4c · readers never get a lateness warning: a late story build shows on /status, the line stays the normal one", () => {
    expect([...READER_FACING].sort()).toEqual(["digest", "follow_ups", "forecast", "stories", "wire"]);
    const rows = freshness({ wire: { ran: ago(7), finished: ago(6) }, stories: { ran: ago(3 * 1440) } }, NOW, JOBS.filter(j => ["wire", "stories"].includes(j.id)));
    expect(row(rows, "stories").state).toBe("late");
    expect(freshnessLine(rows, NOW)).toEqual({ late: false, text: "Wire checked 6 minutes ago" });
  });
  it("knows the crawler's rhythms: hourly check slices and the daily vanguard crawl", () => {
    const rows = freshness({ vanguard: { ran: ago(30 * 60) } }, NOW);
    expect(row(rows, "library_check").rhythm).toBe("Hourly slices, every site once a day");
    expect(row(rows, "vanguard")).toMatchObject({ name: "Vanguard crawl", rhythm: "Daily", state: "on_time", runs_on: "crawler" });
    expect(VANGUARD_RUN_PREFIX).toBe("lib-vanguard-");
    expect(row(freshness({}, NOW), "vanguard").state).toBe("never");
  });
  it("next expected follows the stored schedules", () => {
    expect(nextExpected({ kind: "every", ms: 15 * 60_000, aligned: true }, null, NOW)).toBe("16 Nov 12:15 UTC");
    expect(nextExpected({ kind: "daily", h: 6, m: 17 }, null, NOW)).toBe("17 Nov 06:17 UTC");
    expect(nextExpected({ kind: "weekly", dow: 0, h: 9, m: 30 }, null, NOW)).toBe("22 Nov 09:30 UTC"); // Monday the 16th → next Sunday
    expect(nextExpected({ kind: "weekly", dow: 6 }, null, NOW)).toBe("Saturday 21 Nov");
  });
});
