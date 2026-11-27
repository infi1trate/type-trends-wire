// N4c · JOB RUNS (pure). Every scheduled job of the product writes a start row before its work and one finish row after (milliseconds,
// ok or not, one short note), so a stall can be read back afterwards: which jobs started, which finished, how long each took. The
// engineering health run reads them (a start with no finish, or a run over three times its 14-day median, is a bug item) and /desk
// shows the last 24 hours as one line per job. Names and timings only, never a job's command text.

/** Every job that writes run rows, with the longest it can legitimately take (a start row with no finish after this is unfinished). */
export const RUN_JOBS = {
  "ingest-wire": { name: "Wire ingest (scheduled)", limitMs: 60_000 },
  "wire-sampler": { name: "Wire sampler (crawler)", limitMs: 60_000 },
  "story-build": { name: "Story build (job tail)", limitMs: 60_000 },
  "wire-followups": { name: "Wire follow-ups (story build, records sweep)", limitMs: 60_000 },
  "records-refresh": { name: "Records refresh", limitMs: 60_000 },
  "ai-worker": { name: "AI worker", limitMs: 60_000 },
  "follow-up": { name: "Forecast follow-up step", limitMs: 60_000 },
  "crawl-ingest": { name: "Crawl ingest (crawler)", limitMs: 60_000 },
  "forecast": { name: "Weekly forecast", limitMs: 60_000 },
  "desk-passes": { name: "Share and chart passes", limitMs: 60_000 },
  "review-passes": { name: "Review passes", limitMs: 60_000 },
  "writer-pass": { name: "Story writer pass (in quiet review passes)", limitMs: 60_000 },
  "desk-jobs": { name: "Data checks, health run and design review (job tail)", limitMs: 60_000 },
  "health": { name: "Engineering health run", limitMs: 60_000 },
  "living-reading": { name: "Monthly design reading (L3)", limitMs: 60_000 },
  "ingest-producthunt": { name: "Product Hunt ingest (daily)", limitMs: 60_000 },
  "ingest-gfonts": { name: "Google Fonts ingest (daily)", limitMs: 60_000 },
} as const;
export type RunJob = keyof typeof RUN_JOBS;
/** A start row with no finish row this long after it is a run that never finished (every job is cut off well before). */
export const UNFINISHED_AFTER_MS = 5 * 60_000;
export const RUN_SLOW_FACTOR = 3, RUN_MEDIAN_DAYS = 14, RUN_MIN_FOR_MEDIAN = 5, RUN_SLOW_FLOOR_MS = 5_000;
export const RUN_NOTE_MAX = 200;
/** One short note: whitespace folded, web addresses removed (an error message can carry one, with its query), at most 200 characters. */
export const runNote = (s: string | null | undefined) => (s ?? "").replace(/\b(?:https?|wss?):\/\/\S+/gi, "[address]").replace(/\s+/g, " ").trim().slice(0, RUN_NOTE_MAX) || null;

export type RunRow = { id: number; at: string; job: string; phase: "start" | "finish"; start_id: number | null; ok: boolean | null; ms: number | null; note: string | null };
export type Run = { id: number; job: string; started_at: string; finished_at: string | null; ok: boolean | null; ms: number | null; note: string | null; unfinished: boolean };
/** Start rows joined to their finish rows, newest first. A start with no finish after UNFINISHED_AFTER_MS is unfinished. */
/** S1 follow-up · one story build at a time across every server instance. Each caller writes its start row first; it goes ahead only
 *  when no other story-build start row is earlier than its own and newer than this window (a build is cut at its job's 60 s limit, and
 *  a newer start means the stored stories were just caught up). On 23 Nov the crawler's posts and the follow-ups pass started builds
 *  seconds apart on separate instances (02:30:25 and 02:31:01) as the database stopped answering. */
export const BUILD_ONE_AT_A_TIME_MS = 120_000;
export function earlierBuildRunning(rows: readonly Pick<RunRow, "id" | "at" | "job" | "phase">[], mine: { id: number; at: number }): boolean {
  return earlierRunStarted(rows, mine, "story-build", BUILD_ONE_AT_A_TIME_MS);
}
/** D1 Part 2 · the same guard for any job: another start row of `job`, earlier than mine and newer than `windowMs`, goes first. */
export function earlierRunStarted(rows: readonly Pick<RunRow, "id" | "at" | "job" | "phase">[], mine: { id: number; at: number }, job: string, windowMs: number): boolean {
  return rows.some(r => r.job === job && r.phase === "start" && r.id < mine.id && mine.at - Date.parse(r.at) < windowMs && Date.parse(r.at) <= mine.at + 5_000);
}
export function pairRuns(rows: readonly RunRow[], now: number): Run[] {
  const fin = new Map<number, RunRow>();
  for (const r of rows) if (r.phase === "finish" && r.start_id != null) fin.set(r.start_id, r);
  return rows.filter(r => r.phase === "start").map(s => {
    const f = fin.get(s.id);
    return { id: s.id, job: s.job, started_at: s.at, finished_at: f?.at ?? null, ok: f ? f.ok : null, ms: f?.ms ?? null, note: runNote(f?.note ?? s.note), unfinished: !f && now - Date.parse(s.at) > UNFINISHED_AFTER_MS };
  }).sort((a, b) => b.started_at.localeCompare(a.started_at) || b.id - a.id);
}
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2) : null; };
const secs = (ms: number) => (ms < 120_000 ? `${Math.round(ms / 100) / 10} s` : `${Math.round(ms / 60_000)} min`);
const hhmm = (iso: string) => iso.slice(11, 16);

export type RunProblem = { key: string; title: string; why: string };
/** One job's problems from its run rows (14 days): its newest run that started never finished; its newest finished run took more
 *  than three times its 14-day median (never under five seconds). */
export function runProblems(job: string, runs: readonly Run[], prefix = "health:"): RunProblem[] {
  const mine = runs.filter(r => r.job === job), out: RunProblem[] = [], name = RUN_JOBS[job as RunJob]?.name ?? job;
  const unf = mine.find(r => r.finished_at || r.unfinished);
  if (unf?.unfinished) out.push({ key: `${prefix}run-unfinished:${job}`, title: `${name}: a run started and never finished`, why: `The run that started ${unf.started_at.slice(0, 16).replace("T", " ")} UTC wrote no finish row within ${UNFINISHED_AFTER_MS / 60_000} minutes${mine.filter(r => r.unfinished).length > 1 ? ` (${mine.filter(r => r.unfinished).length} such runs in ${RUN_MEDIAN_DAYS} days)` : ""}.` });
  const done = mine.filter(r => r.ms != null), last = done[0], med = done.length >= RUN_MIN_FOR_MEDIAN ? median(done.map(r => r.ms!)) : null;
  if (last && med && last.ms! > RUN_SLOW_FACTOR * med && last.ms! > RUN_SLOW_FLOOR_MS) out.push({ key: `${prefix}run-slow:${job}`, title: `${name} ran slowly`, why: `Its newest run (${last.started_at.slice(0, 16).replace("T", " ")} UTC) took ${secs(last.ms!)}, more than ${RUN_SLOW_FACTOR} times its ${RUN_MEDIAN_DAYS}-day median of ${secs(med)}.` });
  return out;
}

export type JobLine = { job: string; name: string; runs: number; failed: number; unfinished: number; running: number; median_ms: number | null; longest_ms: number | null; last: { at: string; ok: boolean | null; ms: number | null; note: string | null } | null; line: string };
/** /desk · the last 24 hours as one line per job (registry order; jobs with no rows say so). */
export function jobLines(runs: readonly Run[], now: number): JobLine[] {
  const since = now - 864e5;
  return (Object.keys(RUN_JOBS) as RunJob[]).map(job => {
    const rs = runs.filter(r => r.job === job && Date.parse(r.started_at) >= since), done = rs.filter(r => r.ms != null);
    const failed = done.filter(r => r.ok === false).length, unfinished = rs.filter(r => r.unfinished).length, running = rs.filter(r => !r.finished_at && !r.unfinished).length;
    const med = median(done.map(r => r.ms!)), longest = done.length ? Math.max(...done.map(r => r.ms!)) : null, last = rs[0] ?? null;
    const line = !rs.length ? "No runs in the last 24 hours."
      : [`${rs.length} run${rs.length === 1 ? "" : "s"}`, failed ? `${failed} failed` : null, unfinished ? `${unfinished} never finished` : null, running ? `${running} running` : null,
        med != null ? `median ${secs(med)}` : null, longest != null ? `longest ${secs(longest)}` : null,
        last ? `last ${hhmm(last.started_at)} UTC ${last.unfinished ? "never finished" : !last.finished_at ? "running" : last.ok ? "ok" : "failed"}${last.ms != null ? ` in ${secs(last.ms)}` : ""}${last.note ? ` (${last.note})` : ""}` : null].filter(Boolean).join(" · ");
    return { job, name: RUN_JOBS[job].name, runs: rs.length, failed, unfinished, running, median_ms: med, longest_ms: longest, last: last ? { at: last.started_at, ok: last.ok, ms: last.ms, note: last.note } : null, line };
  });
}
