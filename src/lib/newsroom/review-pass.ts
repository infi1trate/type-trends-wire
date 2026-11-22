// N4c · THE REVIEW PASS (pure). Story review no longer runs in the job tail: it has its own scheduled pass, every five minutes on minutes
// that are never :00, :15, :30 or :45 (and clear of the AI worker's and the wire's own time limits), at most two stories a pass, one pass at
// a time, each under 40 seconds, with a start row before the work and a finish row after (job_runs). Inside a pass the order is the
// picture check, standards, then the editor in chief (one placement call at most, only when there is a choice, within its daily limit).
// A pass that runs out of time records nothing for what it did not reach: those stories wait for the next pass, never a fallback.
import { JOB_WINDOWS } from "./passes";
export const REVIEW_ITEMS_MAX = 2;
export const REVIEW_PASS_MS = 40_000;
/** The review work's own deadline inside the pass (numbers, kept crops and the finish row come after). */
export const REVIEW_WORK_MS = 33_000;
export const REVIEW_SLOT_MIN = 5;
/** A start row with no finish row after this long no longer blocks the next pass. */
export const REVIEW_STALE_MS = 120_000;
export const REVIEW_SCHEDULE = { name: "review-passes", cron: "3-58/5 * * * *", path: "/api/public/jobs/review-passes", body: { kind: "review-passes" } } as const;
export const REVIEW_MINUTES = [3, 8, 13, 18, 23, 28, 33, 38, 43, 48, 53, 58] as const;

/** The product job inside its time limit now, or one that starts before a review pass could finish; null when clear. */
export function reviewBusy(now: number): string | null {
  for (const w of JOB_WINDOWS) {
    const every = w.everyMin * 60_000, since = ((now % every) + every) % every;
    if (since < w.limitMs) return `${w.job} is inside its time limit`;
    if (every - since < REVIEW_PASS_MS) return `${w.job} starts within ${REVIEW_PASS_MS / 1000} s`;
  }
  return null;
}
/** The five-minute slot a pass takes (unique among review passes' start rows). */
export function reviewSlot(now: number): string {
  const d = new Date(now); d.setUTCSeconds(0, 0); d.setUTCMinutes(d.getUTCMinutes() - (d.getUTCMinutes() % REVIEW_SLOT_MIN));
  return `review:${d.toISOString().slice(0, 16)}`;
}
