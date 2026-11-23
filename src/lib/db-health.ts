// D1 Part 6 · SEE IT COMING (pure). The database lines on /api/public/health, each with a state (ok, warn, bad) and a plain line; when
// an engineering alert is due; and the safe mode the site enters by itself. Inputs are this server's own probe readings (db-guard.ts,
// no database needed) plus the anonymous db_load_facts() counts when they can be read. Thresholds live here and nowhere else.
import { answerTimes, type Probe } from "./db-guard";

export type DbState = "ok" | "warn" | "bad";
export type DbLine = { state: DbState; line: string };
export type LoadFacts = { at?: string; connections?: number; max_connections?: number; wal_bytes_total?: number; wal_since?: string | null; wal_bytes_hour?: number | null; wal_span_min?: number | null;
  biggest_job?: { job: string; ms: number; at: string } | null; skipped_slow_hour?: number };

export const DB_THRESHOLDS = {
  /** Answer time: median over ten minutes, worst single reading. */
  answer_warn_median_ms: 300, answer_bad_median_ms: 1_000, answer_warn_worst_ms: 1_000,
  /** Two failed readings in a row (no answer within a second) is bad. */
  answer_bad_failed_in_row: 2,
  connections_warn_share: 0.7, connections_bad_share: 0.9,
  /** Write log per hour; the hours before the 23 Nov outage wrote about 400 MB. */
  wal_warn_mb_hour: 150, wal_bad_mb_hour: 400,
  job_warn_ms: 30_000, job_bad_ms: 60_000,
  skipped_warn: 1, skipped_bad: 6,
  /** A warn that has lasted this long writes an engineering alert; one bad writes one at once. */
  alert_warn_after_ms: 5 * 60_000,
  /** Safe mode is left after this long with every reading good. */
  safe_leave_after_ms: 5 * 60_000,
} as const;
const T = DB_THRESHOLDS;
const worst = (...s: DbState[]): DbState => (s.includes("bad") ? "bad" : s.includes("warn") ? "warn" : "ok");
const mb = (b: number) => b / 1_048_576;

export function failedInRow(list: readonly Probe[]): number { let n = 0; for (let i = list.length - 1; i >= 0 && !list[i]!.ok; i--) n++; return n; }

/** The answer-time line from this server's readings of the last ten minutes. */
export function answerLine(list: readonly Probe[], now: number): DbLine & { median_ms: number | null; worst_ms: number | null; readings: number; failed: number } {
  const a = answerTimes(list, now), row = failedInRow(list);
  if (!a.n) return { state: "ok", line: "No reading on this server in the last ten minutes.", median_ms: null, worst_ms: null, readings: 0, failed: 0 };
  const state: DbState = row >= T.answer_bad_failed_in_row || (a.median_ms ?? 0) > T.answer_bad_median_ms ? "bad"
    : (a.median_ms ?? 0) > T.answer_warn_median_ms || (a.worst_ms ?? 0) >= T.answer_warn_worst_ms ? "warn" : "ok";
  const line = `The database answered in ${a.median_ms} ms (median), ${a.worst_ms} ms at worst, over ${a.n} reading${a.n === 1 ? "" : "s"} in the last ten minutes${a.failed ? `; ${a.failed} got no answer within a second` : ""}.`;
  return { state, line, median_ms: a.median_ms, worst_ms: a.worst_ms, readings: a.n, failed: a.failed };
}

/** D1b · the stored-pages sweep's last finish row (anonymous records_sweep_facts(): counts and step names only). Older rows carry only
 *  the note ("wire · 6 written, 13 skipped, timed out, 2 errors"), which is read for the same counts. */
export type SweepFacts = { at: string; ok: boolean | null; ms: number | null; note?: string | null; written?: number | null; retimed?: number | null; skipped?: number | null; timed_out?: boolean | null; error_steps?: string[] | null };
export type SweepLine = DbLine & { at: string | null; written: number | null; retimed: number | null; errors: number | null; timed_out: boolean | null; error_steps: string[] };
export const SWEEP_THRESHOLDS = { warn_after_ms: 40 * 60_000, bad_after_ms: 2 * 3_600_000 } as const;
export function sweepLine(f: SweepFacts | null | undefined, now: number): SweepLine {
  if (!f?.at) return { state: "warn", line: "The stored-pages sweep's last result could not be read this time.", at: null, written: null, retimed: null, errors: null, timed_out: null, error_steps: [] };
  const note = f.note ?? "", num = (re: RegExp) => { const m = re.exec(note); return m ? Number(m[1]) : null; };
  const written = f.written ?? num(/(\d+) written/), retimed = f.retimed ?? num(/(\d+) re-timed/) ?? (f.written != null ? 0 : null);
  const errors = f.error_steps ? f.error_steps.length : num(/(\d+) errors?\b/) ?? 0, timed_out = f.timed_out ?? /timed out/.test(note);
  const age = now - Date.parse(f.at), mins = Math.max(0, Math.round(age / 60_000));
  const state: DbState = !Number.isFinite(age) || age >= SWEEP_THRESHOLDS.bad_after_ms ? "bad" : age >= SWEEP_THRESHOLDS.warn_after_ms || errors > 0 || timed_out ? "warn" : "ok";
  const parts = [`${written ?? "?"} written`, ...(retimed != null ? [`${retimed} re-timed`] : []), ...(errors ? [`${errors} error${errors === 1 ? "" : "s"}${f.error_steps?.length ? ` (${f.error_steps.join(", ")})` : ""}`] : []), ...(timed_out ? ["ran out of time, rest next pass"] : ["finished"])];
  return { state, line: `The stored-pages sweep last finished ${mins} min ago in ${f.ms != null ? `${(f.ms / 1000).toFixed(1)} s` : "?"}: ${parts.join(", ")}.`, at: f.at, written, retimed, errors, timed_out, error_steps: f.error_steps ?? [] };
}

export type DbHealth = { state: DbState; answer: ReturnType<typeof answerLine>; connections: DbLine & { open: number | null; limit: number | null };
  write_log: DbLine & { mb_hour: number | null }; disk_speed: DbLine & { readable: false }; biggest_job: DbLine & { job: string | null; ms: number | null };
  skipped_slow: DbLine & { count: number | null }; load_read: boolean;
  /** D1b · the sweep's own line; its state is not folded into `state` (a stuck sweep is no reason for safe mode or a database alert). */
  records_sweep?: SweepLine };

export function dbHealth(probes: readonly Probe[], load: LoadFacts | null, now: number, sweep?: SweepFacts | null): DbHealth {
  const answer = answerLine(probes, now);
  const unread = (what: string): DbLine => ({ state: "ok", line: `${what} could not be read this time.` });
  let connections: DbHealth["connections"] = { ...unread("Open connections"), open: null, limit: null };
  let write_log: DbHealth["write_log"] = { ...unread("The write log"), mb_hour: null };
  let biggest_job: DbHealth["biggest_job"] = { ...unread("The biggest job run"), job: null, ms: null };
  let skipped_slow: DbHealth["skipped_slow"] = { ...unread("Stood-down job runs"), count: null };
  if (load) {
    const open = load.connections ?? null, limit = load.max_connections ?? null;
    if (open != null && limit) {
      const share = open / limit;
      connections = { state: share >= T.connections_bad_share ? "bad" : share >= T.connections_warn_share ? "warn" : "ok", line: `${open} of ${limit} database connections are open.`, open, limit };
    }
    let perHour: number | null = load.wal_bytes_hour != null ? mb(load.wal_bytes_hour) : null, how = "in the last hour";
    if (perHour == null && load.wal_bytes_total != null && load.wal_since) {
      const hours = (Date.parse(load.at ?? new Date(now).toISOString()) - Date.parse(load.wal_since)) / 3_600_000;
      if (hours > 0.05) { perHour = mb(load.wal_bytes_total) / hours; how = `an hour on average since ${load.wal_since.slice(11, 16)} UTC (less than an hour of samples so far)`; }
    }
    if (perHour != null) {
      const v = Math.round(perHour * 10) / 10;
      write_log = { state: v >= T.wal_bad_mb_hour ? "bad" : v >= T.wal_warn_mb_hour ? "warn" : "ok", line: `The database wrote ${v} MB to its write log ${how}.`, mb_hour: v };
    }
    const b = load.biggest_job;
    biggest_job = b ? { state: b.ms >= T.job_bad_ms ? "bad" : b.ms >= T.job_warn_ms ? "warn" : "ok", line: `The longest job run in the last hour was ${b.job}, ${(b.ms / 1000).toFixed(1)} s.`, job: b.job, ms: b.ms }
      : { state: "ok", line: "No job run finished in the last hour.", job: null, ms: null };
    const n = load.skipped_slow_hour ?? null;
    if (n != null) skipped_slow = { state: n >= T.skipped_bad ? "bad" : n >= T.skipped_warn ? "warn" : "ok", line: n ? `${n} job run${n === 1 ? "" : "s"} stood down for a slow database in the last hour.` : "No job run stood down for a slow database in the last hour.", count: n };
  }
  const disk_speed: DbHealth["disk_speed"] = { state: "ok", readable: false, line: "The disk-speed allowance is kept by the hosting platform and cannot be read from the site; its alerts reach the owner there." };
  return { state: worst(answer.state, connections.state, write_log.state, biggest_job.state, skipped_slow.state), answer, connections, write_log, disk_speed, biggest_job, skipped_slow, load_read: !!load, ...(sweep !== undefined ? { records_sweep: sweepLine(sweep, now) } : {}) };
}

/** One engineering alert per level per hour (the key's hour is the episode's), for a warn lasting five minutes or any bad. */
export function alertDue(state: DbState, warnSince: number | null, now: number): { level: "warn" | "bad"; key: string } | null {
  const hour = new Date(now).toISOString().slice(0, 13);
  if (state === "bad") return { level: "bad", key: `db:bad:${hour}` };
  if (state === "warn" && warnSince != null && now - warnSince >= T.alert_warn_after_ms) return { level: "warn", key: `db:warn:${hour}` };
  return null;
}

export type SafeMode = { on: boolean; by: "auto" | "owner" | null; since: number | null; goodSince: number | null; why: string };
export const SAFE_OFF: SafeMode = { on: false, by: null, since: null, goodSince: null, why: "" };
/**
 * The safe mode this server is in after one more answer-time reading. Bad (two readings in a row with no answer within a second, or a
 * ten-minute median over a second) enters it; five minutes with every reading good leaves it. The owner's switch wins while it is on.
 */
export function nextSafeMode(s: SafeMode, answer: DbState, lastOk: boolean, now: number, owner: { on: boolean; why: string } | null): { next: SafeMode; changed: "entered" | "left" | null } {
  if (owner?.on) return { next: { on: true, by: "owner", since: s.by === "owner" ? s.since : now, goodSince: null, why: owner.why }, changed: s.on ? null : "entered" };
  // The owner turned it off: off now; a database still bad puts it back on by itself at the next reading.
  if (s.by === "owner") return { next: { ...SAFE_OFF }, changed: "left" };
  if (!s.on) {
    if (answer === "bad") return { next: { on: true, by: "auto", since: now, goodSince: null, why: "the database is not answering in time" }, changed: "entered" };
    return { next: s, changed: null };
  }
  const goodSince = lastOk ? (s.goodSince ?? now) : null;
  if (goodSince != null && answer !== "bad" && now - goodSince >= T.safe_leave_after_ms) return { next: { ...SAFE_OFF }, changed: "left" };
  return { next: { ...s, goodSince }, changed: null };
}

/** What the desk shows above the fold (loaded by db-desk.server.ts). */
export type DbDesk = { alerts: { at: string; level: "warn" | "bad"; line: string }[]; safe_mode: { on: boolean; by: string | null; why: string }; changes: { at: string; is_on: boolean; actor: string; reason: string }[] };
