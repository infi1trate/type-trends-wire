// Job health: pure staleness + status rules over timestamps from the public health_facts() RPC.
// Shared by GET /api/public/health and the terminal status bar so both always agree.
import { z } from "zod";
import { pauseNote } from "./ai-probe";
import { historyNote } from "./history-refresh";
import { WRITER_PER_DAY } from "./stories/writer";
import { STUDY_PER_DAY } from "./data-stories/writer";
import { DIGEST_PER_DAY } from "./digest/writer";
import { DESK_CAPS, DESK_LIMITS } from "./newsroom/caps";

export type Every = "15m" | "6h" | "1d" | "7d";
export const EVERY_MS: Record<Every, number> = { "15m": 15 * 60_000, "6h": 6 * 3_600_000, "1d": 86_400_000, "7d": 7 * 86_400_000 };
export const STALE_FACTOR = 2;
export const QUEUE_MAX_AGE_MS = 6 * 3_600_000;
export const DISCOURSE_MAX_AGE_MS = 10 * 3_600_000;
export const WAYBACK_ACTIVE_MS = 14 * 86_400_000;
export const CHART_MAX_AGE_MS = 14 * 86_400_000;
export const STUCK_RUN_MS = 15 * 60_000;
export const MIN_CRAWL_OK_RATE = 0.7;
export const CORE_JOBS = ["wire", "crawl", "forecast"] as const;
export const TIMEOUT_NOTE = "callback timeout 5s — worker may be cut off";

export type HealthStatus = "ok" | "degraded" | "down";
export type JobHealth = { job: string; last_ok_at: string | null; last_run_at: string | null; last_status: string; expected_every: Every; stale: boolean; consecutive_failures: number; note?: string };
/** I3b · health only (never reader-facing, never changes `status`): tracked brands whose name is missing from their latest home page title and headline. */
export type BrandNameFacts = { checked_at: string; checked: number; not_captured: string[]; failing: { domain: string; name: string; title: string | null; h1: string | null }[] };
/** N1 · the weekly spend cap as health states it: set or not, reached or not, and one plain line (no amounts on this public payload). */
export type SpendFacts = { week_start: string | null; cap_set: boolean; reached: boolean; line: string };
export type HealthPayload = { status: HealthStatus; checked_at: string; jobs: JobHealth[]; brand_names?: BrandNameFacts | null; spend?: SpendFacts | null; art?: { met: number; aic: number; newest_last_seen: string | null } | null;
  /** T1 · each stored page kind's age against its limit (never changes `status`). */
  stored_pages?: { line: string; past_limit: number; kinds: import("./records/records").StoredAge[] } | null;
  /** T1 · this Eastern-time week's model dollars, build credits and total dollars (totals only; the owner asked for these amounts). */
  spend_week?: { line: string; model_usd: number; build_credits: number; agent_usd: number } | null };
/** N1 · read the public spend_facts() facade's answer. */
export function spendFacts(raw: unknown): SpendFacts | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>, cap_set = r["cap_set"] === true, reached = cap_set && r["reached"] === true;
  return { week_start: typeof r["week_start"] === "string" ? r["week_start"] : null, cap_set, reached,
    line: !cap_set ? "No weekly spend cap is set; nothing is blocked." : reached ? "The weekly spend cap is reached: writer runs and desk actions that cost wait until Monday (Eastern time)." : "Under the weekly spend cap." };
}

const ts = z.string().nullable().optional().transform(v => v ?? null);
const num = z.coerce.number().nullable().optional().transform(v => v ?? 0);
const ingest = z.object({ last_run_at: ts, last_ok_at: ts, last_ok: z.boolean().nullable().optional(), failures_since_ok: num }).partial();
export const healthFactsSchema = z.object({
  now: z.string().optional(),
  ingest: z.record(z.string(), ingest).nullable().optional().transform(v => v ?? {}),
  library_check_at: ts, library_full_at: ts, wayback_received_at: ts,
  crawl_runs: z.array(z.object({ status: z.string().nullable().optional(), started_at: ts, finished_at: ts, ok: z.coerce.number().nullable().optional(), tried: z.coerce.number().nullable().optional() })).nullable().optional().transform(v => v ?? []),
  forecast_runs: z.array(z.object({ status: z.string().nullable().optional(), computed_at: ts, error: z.string().nullable().optional() })).nullable().optional().transform(v => v ?? []),
  ai_jobs: z.object({ pending: num, oldest_pending_at: ts, last_done_at: ts, last_activity_at: ts, paused: z.boolean().nullable().optional() }).nullable().optional(),
  ai_interrupted_24h: num,
  // The AI worker's pause, from the public ai_pause_facts() facade (reason and times only), merged in by health.server.ts.
  ai_pause: z.object({ paused: z.boolean().nullable().optional(), reason: z.string().nullable().optional(), paused_at: ts, probed_at: ts }).nullable().optional(),
  render_queue: z.object({ pending: num, oldest_pending_at: ts, last_done_at: ts }).nullable().optional(),
  bluesky_window_end: ts, taste_refreshed_at: ts,
  // W2 · leading indicators: the newest outside_series run (time and point count), merged in by health.server.ts.
  indicators: z.object({ last_run_at: ts, points: num }).nullable().optional(),
  // Library history: when the aggregate series last finished refreshing, and (U2c) how many brands' stored rows have waited more than
  // 30 minutes, from the public library_history_facts() facade, merged in by health.server.ts.
  library_history: z.object({ refreshed_at: ts, rows_behind: num, views_too_slow: z.array(z.string()).nullable().optional() }).nullable().optional(),
  // E2b · the story writer: calls today and the last call / checked text, from the public story_writer_facts() facade.
  story_writer: z.object({ calls_today: num, last_call_at: ts, last_checked_at: ts }).nullable().optional(),
  // N2 · the writer model's calls today split by who made them (story writer, study writer, Digest writer, the desks), the desks'
  // calls against their caps, and stories that passed standards today without the second reader, from newsroom_call_facts().
  newsroom_calls: z.object({ writer_model_calls: num, story: num, study: num, digest: num, desks_writer_model: num, standards: num, chief: num, without_second_reader: num }).nullable().optional(),
  // N3 · every desk's model calls today keyed "desk:purpose" (fixtures excluded), from newsroom_desk_facts().
  desk_calls: z.record(z.string(), num).nullable().optional(),
  brief: z.object({ week: z.string(), created_at: ts, card_at: ts }).nullable().optional(),
  // Optional cron-introspection flags (job name → has callback timeout). Not available on managed Cloud.
  timeouts: z.array(z.object({ job: z.string(), has_timeout: z.boolean() })).nullable().optional().transform(v => v ?? []),
});
export type HealthFacts = z.input<typeof healthFactsSchema>;

const ms = (iso: string | null | undefined) => { if (!iso) return null; const t = Date.parse(iso); return Number.isFinite(t) ? t : null; };
/** True when there is no successful run, or the last one is older than maxAgeMs. */
export function olderThan(lastOk: string | null | undefined, maxAgeMs: number, now: number): boolean { const t = ms(lastOk); return t === null || now - t > maxAgeMs; }
/** Stale = last ok older than 2× the expected interval (or never ok). */
export function isStale(lastOk: string | null | undefined, every: Every, now: number): boolean { return olderThan(lastOk, STALE_FACTOR * EVERY_MS[every], now); }

/** down if any core job (wire, crawl, forecast) is stale; degraded if any other job is stale or flagged. */
export function overallStatus(jobs: Pick<JobHealth, "job" | "stale" | "last_status">[]): HealthStatus {
  if (jobs.some(j => j.stale && (CORE_JOBS as readonly string[]).includes(j.job))) return "down";
  if (jobs.some(j => j.stale || j.last_status === "low_ok_rate")) return "degraded";
  return "ok";
}

const age = (iso: string | null, now: number) => { const t = ms(iso); if (t === null) return "—"; const m = Math.max(0, Math.round((now - t) / 60_000)); return m < 120 ? `${m}m` : m < 2880 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };
const notes = (...n: (string | false | null | undefined)[]) => { const s = n.filter(Boolean).join("; "); return s ? { note: s } : {}; };

export function buildHealth(raw: HealthFacts, now: Date): HealthPayload {
  const f = healthFactsSchema.parse(raw), t = now.getTime();
  const timeoutMissing = (cronJob: string) => f.timeouts.some(x => x.job === cronJob && !x.has_timeout);
  const jobs: JobHealth[] = [];
  for (const [job, key, every] of [["wire", "ingest-wire", "15m"], ["gfonts", "ingest-gfonts", "1d"]] as const) {
    const r = f.ingest[key] ?? {};
    jobs.push({ job, last_ok_at: r.last_ok_at ?? null, last_run_at: r.last_run_at ?? null, last_status: r.last_ok == null ? "never" : r.last_ok ? "ok" : "error", expected_every: every, stale: isStale(r.last_ok_at, every, t), consecutive_failures: r.failures_since_ok ?? 0 });
  }
  jobs.push({ job: "library_check", last_ok_at: f.library_check_at, last_run_at: f.library_check_at, last_status: f.library_check_at ? "ok" : "never", expected_every: "1d", stale: isStale(f.library_check_at, "1d", t), consecutive_failures: 0, note: ["newest live capture (daily check or Saturday full)", historyNote(f.library_history ?? null, t)].filter(Boolean).join("; ") });
  {
    // Never stale: a quiet news day writes nothing. The count is the hard daily limit's meter.
    const w = f.story_writer;
    jobs.push({ job: "story_writer", last_ok_at: w?.last_checked_at ?? null, last_run_at: w?.last_call_at ?? null, last_status: w ? (w.last_call_at ? "ok" : "never") : "unknown", expected_every: "1d", stale: false, consecutive_failures: 0,
      note: f.newsroom_calls ? callsLine(f.newsroom_calls, f.desk_calls ?? null) : w ? `${w.calls_today} writer-model calls today (UTC), all writers together` : "writer facts unavailable" });
  }
  jobs.push({ job: "library_full", last_ok_at: f.library_full_at, last_run_at: f.library_full_at, last_status: f.library_full_at ? "ok" : "never", expected_every: "7d", stale: isStale(f.library_full_at, "7d", t), consecutive_failures: 0, note: "newest Saturday full capture" });
  {
    // Older rows only carry a day-level receipt (run id date at 00:00 UTC): count it as end of that day.
    const wb = f.wayback_received_at, w = ms(wb);
    const dayLevel = w !== null && new Date(w).toISOString().endsWith("T00:00:00.000Z");
    const effective = w === null ? null : new Date(dayLevel ? Math.min(t, w + 86_399_999) : w).toISOString();
    const active = effective !== null && !olderThan(effective, WAYBACK_ACTIVE_MS, t);
    jobs.push(active
      ? { job: "wayback", last_ok_at: wb, last_run_at: wb, last_status: "ok", expected_every: "6h", stale: isStale(effective, "6h", t), consecutive_failures: 0, ...notes("backfill active", dayLevel && "day-level receipt (run date only); counted as end of that day") }
      : { job: "wayback", last_ok_at: wb, last_run_at: wb, last_status: "idle", expected_every: "6h", stale: false, consecutive_failures: 0, note: "backfill idle (no archive captures in 14 days) — ignored" });
  }
  {
    const runs = f.crawl_runs, latest = runs[0], i = runs.findIndex(r => r.status === "finished"), fin = i >= 0 ? runs[i] : undefined;
    const failures = (i >= 0 ? runs.slice(0, i) : runs).filter(r => r.status !== "running").length;
    const rate = fin && fin.tried ? (fin.ok ?? 0) / fin.tried : null, low = rate !== null && rate < MIN_CRAWL_OK_RATE;
    jobs.push({ job: "crawl", last_ok_at: fin?.finished_at ?? null, last_run_at: latest?.started_at ?? null, last_status: low ? "low_ok_rate" : latest?.status ?? "never", expected_every: "7d", stale: isStale(fin?.finished_at, "7d", t), consecutive_failures: failures,
      ...notes(rate !== null && `last finished run ok-rate ${Math.round(rate * 100)}% (${fin!.ok}/${fin!.tried})${low ? " — below 70%" : ""}`) });
  }
  {
    const runs = f.forecast_runs, latest = runs[0], i = runs.findIndex(r => r.status === "ok"), ok = i >= 0 ? runs[i] : undefined;
    const stuck = latest?.status === "running" && olderThan(latest.computed_at, STUCK_RUN_MS, t);
    jobs.push({ job: "forecast", last_ok_at: ok?.computed_at ?? null, last_run_at: latest?.computed_at ?? null, last_status: stuck ? "stuck" : latest?.status ?? "never", expected_every: "7d", stale: isStale(ok?.computed_at, "7d", t), consecutive_failures: (i >= 0 ? runs.slice(0, i) : runs).filter(r => r.status === "error").length,
      ...notes(stuck && "latest run never finished — callback may be cut off", latest?.status === "error" && `last run failed: ${(latest.error ?? "no detail recorded").slice(0, 300)}`, timeoutMissing("forecast-weekly") && TIMEOUT_NOTE) });
  }
  {
    const q = f.ai_jobs, pending = q?.pending ?? 0, oldest = q?.oldest_pending_at ?? null;
    jobs.push({ job: "library_ai", last_ok_at: q?.last_done_at ?? null, last_run_at: q?.last_activity_at ?? null, last_status: q?.paused ? "paused" : pending ? "pending" : "ok", expected_every: "6h", stale: pending > 0 && olderThan(oldest, QUEUE_MAX_AGE_MS, t), consecutive_failures: 0,
      ...notes(f.ai_pause?.paused ? pauseNote({ paused: true, reason: f.ai_pause.reason ?? null, paused_at: f.ai_pause.paused_at, probed_at: f.ai_pause.probed_at }, t) : null, `${pending} pending${pending ? `, oldest ${age(oldest, t)}` : ""}`, f.ai_interrupted_24h > 0 && `${f.ai_interrupted_24h} text jobs interrupted in 24h — callback may be cut off`, timeoutMissing("dsgn-library-ai-worker") && TIMEOUT_NOTE) });
  }
  {
    const q = f.render_queue, pending = q?.pending ?? 0, oldest = q?.oldest_pending_at ?? null;
    jobs.push({ job: "render_queue", last_ok_at: q?.last_done_at ?? null, last_run_at: q?.last_done_at ?? null, last_status: pending ? "pending" : "ok", expected_every: "6h", stale: pending > 0 && olderThan(oldest, QUEUE_MAX_AGE_MS, t), consecutive_failures: 0, note: `${pending} pending${pending ? `, oldest ${age(oldest, t)}` : ""}` });
  }
  jobs.push({ job: "discourse", last_ok_at: f.bluesky_window_end, last_run_at: f.bluesky_window_end, last_status: f.bluesky_window_end ? "ok" : "never", expected_every: "6h", stale: olderThan(f.bluesky_window_end, DISCOURSE_MAX_AGE_MS, t), consecutive_failures: 0, note: "Bluesky sampler; stale after 10h" });
  jobs.push({ job: "taste_refresh", last_ok_at: f.taste_refreshed_at, last_run_at: f.taste_refreshed_at, last_status: f.taste_refreshed_at ? "ok" : "never", expected_every: "7d", stale: isStale(f.taste_refreshed_at, "7d", t), consecutive_failures: 0 });
  {
    const b = f.brief;
    jobs.push(!b
      ? { job: "chart_card", last_ok_at: null, last_run_at: null, last_status: "never", expected_every: "7d", stale: true, consecutive_failures: 0, note: "no weekly brief yet" }
      : { job: "chart_card", last_ok_at: b.card_at, last_run_at: b.card_at ?? b.created_at, last_status: b.card_at ? "ok" : "missing", expected_every: "7d", stale: !b.card_at || olderThan(b.card_at, CHART_MAX_AGE_MS, t), consecutive_failures: 0, note: b.card_at ? `latest brief ${b.week}` : `no card for latest brief ${b.week}` });
  }
  jobs.push(indicatorsJob(f.indicators ?? null, t));
  return { status: overallStatus(jobs), checked_at: now.toISOString(), jobs };
}

/** Leading indicators arrive once a day; nothing for more than this reads as late. */
export const INDICATORS_MAX_AGE_MS = 36 * 3_600_000;
export const INDICATORS_NOT_STARTED = "collection has not started; the first daily run has not arrived";
/** The `indicators` job: before the first run it is not a failure; afterwards it is stale when nothing arrived for 36 hours. */
export function indicatorsJob(i: { last_run_at: string | null; points: number } | null, now: number): JobHealth {
  if (!i?.last_run_at) return { job: "indicators", last_ok_at: null, last_run_at: null, last_status: "not_started", expected_every: "1d", stale: false, consecutive_failures: 0, note: INDICATORS_NOT_STARTED };
  const late = olderThan(i.last_run_at, INDICATORS_MAX_AGE_MS, now);
  return { job: "indicators", last_ok_at: i.last_run_at, last_run_at: i.last_run_at, last_status: "ok", expected_every: "1d", stale: late, consecutive_failures: 0,
    note: `${i.points} points in the last run${late ? `; nothing has arrived for ${age(i.last_run_at, now)} (more than 36 hours)` : ""}` };
}

/** D1b · the top-level status /api/public/health answers. */
export type TopStatus = HealthStatus | "starting";
/** D1b · the rule in one sentence: the answer is "down" only when the database lines say "bad" or a job that matters is failing (the
 *  job facts' own status); a server with no job facts yet says "starting", never "down" on that ground alone. */
export function topStatus(facts: HealthStatus | null, db: "ok" | "warn" | "bad" | null): TopStatus {
  if (db === "bad") return "down";
  return facts ?? "starting";
}
/** Fallback when the facts cannot be read at all (the status bar and desk readers; the public answer uses `topStatus`). */
export function unavailableHealth(now: Date): HealthPayload { return { status: "down", checked_at: now.toISOString(), jobs: [] }; }

/** N2 · what the writer meter counts, said plainly: each writer's calls against its own daily limit (UTC day), the desks' calls against
 *  theirs, and the stories that passed standards today without the second reader. (Before N2 one number counted every writer's calls
 *  against the story writer's limit, so it could read "18 of 12".) */
export function callsLine(c: { story: number; study: number; digest: number; standards: number; chief: number; without_second_reader: number }, desks?: Readonly<Record<string, number>> | null): string {
  // N3 · the news, graphics and data desks, each against its own limit (graphics has two: pictures and study charts).
  const n3 = DESK_LIMITS.filter(l => l.desk !== "standards" && l.desk !== "editor in chief").map(l => `${l.desk} ${l.what} ${desks?.[`${l.desk}:${l.purpose}`] ?? 0} of ${l.cap}`);
  return `story writer ${c.story} of ${WRITER_PER_DAY}, study writer ${c.study} of ${STUDY_PER_DAY}, Digest writer ${c.digest} of ${DIGEST_PER_DAY}, standards ${c.standards} of ${DESK_CAPS.standards}, editor in chief ${c.chief} of ${DESK_CAPS["editor in chief"]}${desks ? `, ${n3.join(", ")}` : ""} model calls today (UTC); ${c.without_second_reader} ${c.without_second_reader === 1 ? "story" : "stories"} reviewed without second reader today`;
}
