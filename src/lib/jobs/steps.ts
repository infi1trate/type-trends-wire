// Bounded scheduled work: every scheduled callback answers well inside the platform's request limit, and long jobs leave their
// remaining work as queued steps that later scheduled calls pick up one at a time. Pure; IO lives in steps.server.ts.

/** Every scheduled handler aims to answer within this (the platform limit is higher; this leaves room for cold starts). */
export const CALL_BUDGET_MS = 45_000;
/** A follow-up step only starts when its carrier call has used less than this, so the longest step (the AI brief) still fits. */
export const FOLLOW_UP_START_MS = 12_000;
/** A running step whose lease ran out was cut off; it is retried until it has been attempted STEP_MAX_ATTEMPTS times. */
export const STEP_LEASE_MS = 3 * 60_000;
export const STEP_MAX_ATTEMPTS = 2;
/** The weekly forecast's work after the run is stored, in the order the single long call used to do it. */
export const FORECAST_FOLLOW_UPS = ["structure", "taste", "brief", "vibe", "chart", "ledger", "stories"] as const;
export type ForecastFollowUp = (typeof FORECAST_FOLLOW_UPS)[number];
export const FOLLOW_UP_NAME: Record<ForecastFollowUp, string> = { structure: "page structure", taste: "taste tables", brief: "weekly brief", vibe: "vibe map", chart: "chart of the week", ledger: "forecast ledger", stories: "story build" };

export type StepStatus = "pending" | "running" | "done" | "error" | "skipped";
export type StepRow = { job: string; run_key: string; step: string; position: number; status: StepStatus; attempts: number; queued_at: string; started_at: string | null; finished_at: string | null; lease_until: string | null; detail: string | null };
const terminal = (s: StepStatus) => s === "done" || s === "error" || s === "skipped";

/** Rows to insert for a new run's follow-ups. */
export function queueRows(job: string, runKey: string, steps: readonly string[], now: string): StepRow[] {
  return steps.map((step, position) => ({ job, run_key: runKey, step, position, status: "pending", attempts: 0, queued_at: now, started_at: null, finished_at: null, lease_until: null, detail: null }));
}

export type StepPlan = { action: "run"; row: StepRow } | { action: "give_up"; row: StepRow } | null;
/**
 * The next step to work on: oldest queued run first, steps strictly in order (a step waits until every earlier one is done, failed or skipped).
 * A pending step runs; a running step whose lease expired runs again, or is given up once it has used every attempt.
 */
export function nextStep(rows: StepRow[], now: number): StepPlan {
  const runs = new Map<string, StepRow[]>();
  for (const r of rows) { const k = `${r.job}|${r.run_key}`; runs.set(k, [...(runs.get(k) ?? []), r]); }
  const ordered = [...runs.values()].map(rs => [...rs].sort((a, b) => a.position - b.position)).sort((a, b) => a[0]!.queued_at.localeCompare(b[0]!.queued_at) || a[0]!.run_key.localeCompare(b[0]!.run_key));
  for (const steps of ordered) {
    const open = steps.find(s => !terminal(s.status));
    if (!open) continue;
    if (open.status === "pending") return { action: "run", row: open };
    const expired = !open.lease_until || Date.parse(open.lease_until) <= now;
    if (!expired) return null; // someone is working on it; keep order
    return open.attempts >= STEP_MAX_ATTEMPTS ? { action: "give_up", row: open } : { action: "run", row: open };
  }
  return null;
}

export type RunProgress = { job: string; run_key: string; total: number; done: number; failed: string[]; open: string[]; queued_at: string; finished_at: string | null };
/** Honest progress per queued run, newest first. */
export function progress(rows: StepRow[]): RunProgress[] {
  const runs = new Map<string, StepRow[]>();
  for (const r of rows) { const k = `${r.job}|${r.run_key}`; runs.set(k, [...(runs.get(k) ?? []), r]); }
  return [...runs.values()].map(rs => {
    const s = [...rs].sort((a, b) => a.position - b.position), open = s.filter(x => !terminal(x.status)).map(x => x.step);
    const fins = s.map(x => x.finished_at).filter((x): x is string => !!x).sort();
    return { job: s[0]!.job, run_key: s[0]!.run_key, total: s.length, done: s.filter(x => x.status === "done").length, failed: s.filter(x => x.status === "error").map(x => x.step), open, queued_at: s[0]!.queued_at, finished_at: open.length ? null : fins.at(-1) ?? null };
  }).sort((a, b) => b.queued_at.localeCompare(a.queued_at));
}
