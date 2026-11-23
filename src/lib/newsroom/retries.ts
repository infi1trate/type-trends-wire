// PH1 Part 5 · when a desk job that marks itself started before it runs may try again. Pure; desks-run.server.ts reads the day's (or the
// week's) desk_log rows and asks. Daily jobs (the data desk's checks, the backtest, the engineering health run): a failed or stood-down
// run (started, no result) tries again at most once every six hours, at most three more times that day. Weekly jobs that spend a model
// call (the data desk's proposal, the scout's candidates): one more try only, six hours later, and only when the failure came before
// any model call was made, so nothing is paid for twice; otherwise the job waits for next week and the desk says so.
export const RETRY_EVERY_MS = 6 * 3_600_000;
export const DAILY_RETRIES_MAX = 3, WEEKLY_RETRIES_MAX = 1;
export const DAILY_RETRY_JOBS = ["checks", "backtest", "health"] as const;
export const WEEKLY_RETRY_JOBS = ["proposal", "candidates"] as const;
/** One desk_log row of a job's attempts: a start (first run or retry), or the outcome desks-run writes after the work. A legacy
 *  result row (the job's own, written before outcomes existed) counts as an ok outcome. */
export type Attempt = { at: string; kind: "start" | "outcome"; failed?: boolean; called?: boolean };
export type RetryVerdict = { due: true; retry: number; why: string } | { due: false; why: string; waitsForNextWeek?: boolean };
const hm = (t: number) => new Date(t).toISOString().slice(11, 16);

export function retryDue(kind: "daily" | "weekly", rows: readonly Attempt[], now: number, o: { callSince?: (iso: string) => boolean } = {}): RetryVerdict {
  const sorted = [...rows].sort((a, b) => a.at.localeCompare(b.at));
  const starts = sorted.filter(r => r.kind === "start");
  const last = starts.at(-1);
  if (!last) return { due: false, why: "not started yet" };
  const after = sorted.filter(r => r.kind === "outcome" && r.at >= last.at);
  const outcome = after.at(-1);
  if (outcome && !outcome.failed) return { due: false, why: "ran" };
  const retries = starts.length - 1, max = kind === "daily" ? DAILY_RETRIES_MAX : WEEKLY_RETRIES_MAX;
  if (kind === "weekly") {
    if (!outcome) return { due: false, why: "cut off before its result was stored, so it may have reached its model call; it waits for next week", waitsForNextWeek: true };
    if (outcome.called || o.callSince?.(last.at)) return { due: false, why: "failed after its model call was made; it waits for next week so nothing is paid for twice", waitsForNextWeek: true };
    if (retries >= max) return { due: false, why: "its one more try is used; it waits for next week", waitsForNextWeek: true };
  } else if (retries >= max) return { due: false, why: `all ${max} tries again used today` };
  const next = Date.parse(last.at) + RETRY_EVERY_MS;
  if (now < next) return { due: false, why: `${outcome ? "failed" : "stood down"} at ${hm(Date.parse(last.at))} UTC; tries again after ${hm(next)} UTC` };
  return { due: true, retry: retries + 1, why: `${outcome ? "failed" : "stood down"} at ${hm(Date.parse(last.at))} UTC; try again ${retries + 1} of ${max}` };
}
/** desk_log rows → attempts: starts are the "Started at" rows of the job and its retries; outcomes are `<job>:outcome` rows, and (for
 *  runs from before outcomes were written) the job's own result row under its own name. */
export function attemptsOf(job: string, rows: readonly { at: string; subject_id: string | null; reason: string | null; detail: unknown }[]): Attempt[] {
  return rows.flatMap((r): Attempt[] => {
    const counts = (r.detail && typeof r.detail === "object" ? (r.detail as { counts?: Record<string, unknown> }).counts : null) ?? {};
    if (r.subject_id === `${job}:retry`) return [{ at: r.at, kind: "start" }];
    if (r.subject_id === `${job}:outcome`) return [{ at: r.at, kind: "outcome", failed: counts["failed"] === 1, called: counts["called"] === 1 }];
    if (r.subject_id === job) return (r.reason ?? "").startsWith("Started at") ? [{ at: r.at, kind: "start" }] : [{ at: r.at, kind: "outcome", failed: false }];
    return [];
  });
}
