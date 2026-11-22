// N4b · THE DESK PASSES AND JOB HOLDS (pure). The graphics desk's share-image and study-chart checks no longer run in the job tail:
// once a UTC day they run in small scheduled passes (at most five items a pass, one pass per ten-minute slot, each under 20 seconds,
// resuming where the last pass stopped), reading stored records only. Before any work a pass writes its start row; a start row with no
// finish row after two minutes is a failed pass, and two failed passes stop that check for the day (a bug item says so). A pass never
// runs while another product job is inside its own time limit. Any scheduled desk job can be held until a time (at most seven days).
export const PASS_CHECKS = ["share", "chart"] as const;
export type PassCheck = (typeof PASS_CHECKS)[number];
export const PASS_ITEMS_MAX = 5;
export const PASS_SLOT_MIN = 10;
export const PASS_LIMIT_MS = 20_000;
/** No new item starts after this much of a pass (an item may take ITEM_LIMIT_MS more, so a pass stays under PASS_LIMIT_MS). */
export const PASS_START_BY_MS = 13_000;
export const ITEM_LIMIT_MS = 5_000;
/** A chart pass makes at most one model call, only when it can start this early, and gives it this long. */
export const CHART_CALL_START_BY_MS = 4_000;
export const CHART_CALL_MS = 12_000;
export const PASS_STALE_MS = 120_000;
export const PASS_FAILS_STOP = 2;
/** The scheduled call: minutes 7, 17, … 57 of 01:00–03:59 UTC (never :00, :15, :30 or :45), at most 18 passes a day. */
export const PASS_SCHEDULE = { name: "desk-passes", cron: "7-57/10 1-3 * * *", path: "/api/public/jobs/desk-passes", body: { kind: "desk-passes" } } as const;
/** The product's own scheduled jobs and how long each may run after its minute (names and timing only). */
export const JOB_WINDOWS = [
  { job: "ingest-wire", everyMin: 15, limitMs: 60_000 },
  { job: "library-ai-worker", everyMin: 5, limitMs: 60_000 },
  { job: "library-history-refresh", everyMin: 10, limitMs: 60_000 },
] as const;

/** The product job inside its time limit now, or one that starts before a pass could finish; null when the clock is clear. */
export function busyJob(now: number): string | null {
  for (const w of JOB_WINDOWS) {
    const every = w.everyMin * 60_000, since = ((now % every) + every) % every;
    if (since < w.limitMs) return `${w.job} is inside its time limit`;
    if (every - since < PASS_LIMIT_MS) return `${w.job} starts within ${PASS_LIMIT_MS / 1000} s`;
  }
  return null;
}
export const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10);
/** The ten-minute slot a pass takes (unique in the store: never two passes in one slot). */
export function slotOf(now: number): string {
  const d = new Date(now); d.setUTCSeconds(0, 0); d.setUTCMinutes(d.getUTCMinutes() - (d.getUTCMinutes() % PASS_SLOT_MIN));
  return d.toISOString().slice(0, 16);
}

export type PassStart = { id: number; at: string; check: PassCheck; day: string; slot: string; items: string[]; plan: string[] | null };
export type PassResult = { id: string; ok: boolean; done: boolean; error: string | null; ms?: number };
export type PassEnd = { pass_id: number; at: string; ok: boolean; ms: number; results: PassResult[]; error: string | null };
export type CheckDay = {
  check: PassCheck; plan: string[] | null; done: string[]; failing: { id: string; error: string }[]; next: string[];
  passes: number; failedPasses: number; open: PassStart | null;
  status: "not planned" | "due" | "running" | "complete" | "stopped";
};
/** One check's day from its start and finish rows: what is done, what fails (never retried today), how many passes failed. */
export function checkDay(check: PassCheck, starts: readonly PassStart[], ends: readonly PassEnd[], now: number): CheckDay {
  const mine = starts.filter(s => s.check === check).sort((a, b) => a.id - b.id), endOf = new Map(ends.map(e => [e.pass_id, e]));
  const done = new Set<string>(), failing = new Map<string, string>();
  let failedPasses = 0, open: PassStart | null = null;
  for (const s of mine) {
    const e = endOf.get(s.id);
    if (!e) {
      if (now - Date.parse(s.at) > PASS_STALE_MS) { failedPasses++; for (const id of s.items) if (!done.has(id)) failing.set(id, "its pass did not finish"); }
      else open = s;
      continue;
    }
    if (!e.ok) failedPasses++;
    for (const r of e.results) { if (r.ok && r.done) { done.add(r.id); failing.delete(r.id); } else if (!r.ok) failing.set(r.id, r.error ?? "failed"); }
    // An item a failed pass named but did not report is failing too: it is never retried in the same day.
    if (!e.ok) for (const id of s.items) if (!done.has(id) && !e.results.some(r => r.id === id)) failing.set(id, e.error ?? "its pass failed");
  }
  const plan = mine.find(s => s.plan)?.plan ?? null;
  const next = (plan ?? []).filter(id => !done.has(id) && !failing.has(id)).slice(0, PASS_ITEMS_MAX);
  const status: CheckDay["status"] = failedPasses >= PASS_FAILS_STOP ? "stopped" : open ? "running" : !plan ? "not planned" : next.length ? "due" : "complete";
  return { check, plan, done: [...done], failing: [...failing].map(([id, error]) => ({ id, error })), next, passes: mine.length, failedPasses, open, status };
}

// JOB HOLDS -----------------------------------------------------------------------------------------------------------------------------
export const HOLD_JOBS = ["share", "chart", "picks", "checks", "health", "design review", "backtest", "proposal", "reviews"] as const;
export type HoldJob = (typeof HOLD_JOBS)[number];
export const HOLD_MAX_DAYS = 7;
export const HOLD_ACTORS = ["engineering", "owner"] as const;
/** Why a hold's end time is refused, or null: it must be in the future and at most seven days ahead. */
export function holdUntilProblem(until: string, now: number): string | null {
  const t = Date.parse(until);
  if (!Number.isFinite(t)) return "until is not a time";
  if (t <= now) return "until must be in the future";
  if (t - now > HOLD_MAX_DAYS * 864e5) return `until is at most ${HOLD_MAX_DAYS} days ahead`;
  return null;
}
export type HoldRow = { id: number; at: string; actor: string; action: "job_hold" | "job_release"; job: string; until: string | null; reason: string | null };
export type Hold = { job: string; actor: string; reason: string | null; until: string; at: string; log: number };
/** The holds in force: per job, its newest hold or release; a hold counts until its end time. */
export function activeHolds(rows: readonly HoldRow[], now: number): Hold[] {
  const newest = new Map<string, HoldRow>();
  for (const r of [...rows].sort((a, b) => a.id - b.id)) newest.set(r.job, r);
  return [...newest.values()].filter(r => r.action === "job_hold" && r.until && Date.parse(r.until) > now)
    .map(r => ({ job: r.job, actor: r.actor, reason: r.reason, until: r.until!, at: r.at, log: r.id }));
}
