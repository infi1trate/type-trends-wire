import { describe, expect, it } from "vitest";
import { alertDue, answerLine, dbHealth, nextSafeMode, SAFE_OFF } from "./db-health";

const NOW = Date.parse("2026-11-23T06:00:00Z");
const p = (agoS: number, ms: number, ok = true) => ({ at: NOW - agoS * 1000, ms, ok });

describe("D1 Part 6 · database lines on health", () => {
  it("answer time: ok under a 300 ms median, warn above it or with a reading of a second, bad after two misses in a row", () => {
    expect(answerLine([p(60, 40), p(30, 60), p(5, 50)], NOW).state).toBe("ok");
    expect(answerLine([p(60, 400), p(30, 500), p(5, 350)], NOW).state).toBe("warn");
    expect(answerLine([p(60, 40), p(30, 1000), p(5, 50)], NOW).state).toBe("warn");
    expect(answerLine([p(60, 40), p(30, 1000, false), p(5, 1000, false)], NOW).state).toBe("bad");
    expect(answerLine([p(60, 1200), p(30, 1300), p(5, 50)], NOW).state).toBe("bad");
    // readings older than ten minutes do not count
    expect(answerLine([p(700, 1000, false), p(650, 1000, false)], NOW).readings).toBe(0);
  });
  it("connections warn at 70% and bad at 90% of the limit of 60", () => {
    const at = (n: number) => dbHealth([], { connections: n, max_connections: 60 }, NOW).connections.state;
    expect([at(41), at(42), at(53), at(54)]).toEqual(["ok", "warn", "warn", "bad"]);
  });
  it("write log: warn from 150 MB an hour, bad from 400; before an hour of samples, the average since the counters began", () => {
    const at = (mb: number) => dbHealth([], { wal_bytes_hour: mb * 1_048_576 }, NOW).write_log.state;
    expect([at(149), at(150), at(399), at(400)]).toEqual(["ok", "warn", "warn", "bad"]);
    const avg = dbHealth([], { at: "2026-11-23T06:00:00Z", wal_since: "2026-11-23T04:00:00Z", wal_bytes_total: 20 * 1_048_576, wal_bytes_hour: null }, NOW).write_log;
    expect(avg.mb_hour).toBe(10);
  });
  it("biggest job: warn from 30 s, bad from 60 s; stood-down runs: warn from 1, bad from 6", () => {
    const job = (ms: number) => dbHealth([], { biggest_job: { job: "wire-followups", ms, at: "x" } }, NOW).biggest_job.state;
    expect([job(29_999), job(30_000), job(60_000)]).toEqual(["ok", "warn", "bad"]);
    const sk = (n: number) => dbHealth([], { skipped_slow_hour: n }, NOW).skipped_slow.state;
    expect([sk(0), sk(1), sk(6)]).toEqual(["ok", "warn", "bad"]);
  });
  it("the disk-speed allowance is never read by the site, and says so", () => {
    expect(dbHealth([], null, NOW).disk_speed.readable).toBe(false);
  });
});

describe("D1 Part 6 · engineering alerts", () => {
  it("a warn writes an alert only after five minutes; a bad at once; one key per level per hour", () => {
    expect(alertDue("warn", NOW - 4 * 60_000, NOW)).toBeNull();
    expect(alertDue("warn", NOW - 5 * 60_000, NOW)).toEqual({ level: "warn", key: "db:warn:2026-11-23T06" });
    expect(alertDue("bad", null, NOW)).toEqual({ level: "bad", key: "db:bad:2026-11-23T06" });
    expect(alertDue("bad", null, NOW + 59 * 60_000)?.key).toBe("db:bad:2026-11-23T06");
    expect(alertDue("ok", NOW - 3600_000, NOW)).toBeNull();
  });
});

describe("D1 Part 6 · safe mode", () => {
  it("enters on bad and leaves only after five minutes with every reading good", () => {
    let s = nextSafeMode(SAFE_OFF, "bad", false, NOW, null);
    expect(s.changed).toBe("entered"); expect(s.next.on).toBe(true);
    s = nextSafeMode(s.next, "warn", true, NOW + 60_000, null); expect(s.next.on).toBe(true);
    s = nextSafeMode(s.next, "warn", false, NOW + 120_000, null); expect(s.next.goodSince).toBeNull(); // a miss starts the five minutes again
    s = nextSafeMode(s.next, "ok", true, NOW + 180_000, null);
    s = nextSafeMode(s.next, "ok", true, NOW + 180_000 + 4 * 60_000, null); expect(s.next.on).toBe(true);
    s = nextSafeMode(s.next, "ok", true, NOW + 180_000 + 5 * 60_000, null); expect(s.changed).toBe("left"); expect(s.next.on).toBe(false);
  });
  it("the owner's switch holds it on whatever the readings, and turning it off leaves it at once", () => {
    let s = nextSafeMode(SAFE_OFF, "ok", true, NOW, { on: true, why: "maintenance" });
    expect(s).toMatchObject({ changed: "entered", next: { on: true, by: "owner" } });
    s = nextSafeMode(s.next, "ok", true, NOW + 3600_000, { on: true, why: "maintenance" }); expect(s.next.on).toBe(true);
    s = nextSafeMode(s.next, "ok", true, NOW + 3600_000, { on: false, why: "done" }); expect(s).toMatchObject({ changed: "left", next: { on: false } });
  });
});
