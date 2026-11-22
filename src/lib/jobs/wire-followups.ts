// L2 · THE WIRE FOLLOW-UPS PASS (pure). The 15-minute wire job used to run the story build (with the desk jobs in its tail) and the
// records sweep after its ingest and the news desk's turn, so every wire run used its whole time limit. That work can wait a minute: it
// now runs in its own scheduled pass one minute after each wire job, one pass at a time, with a start row before the work and a finish
// row after (job_runs). Nothing is dropped: the same build and the same sweep, in the same order, with the same deadlines.
export const WIRE_FOLLOWUPS_SCHEDULE = { name: "wire-followups", cron: "1-59/15 * * * *", path: "/api/public/jobs/wire-followups", body: { kind: "wire-followups" } } as const;
export const WIRE_FOLLOWUPS_SLOT_MIN = 15;
/** A start row with no finish row after this long no longer blocks the next pass. */
export const WIRE_FOLLOWUPS_STALE_MS = 120_000;
/** The steps, in order (the wire job's former tail). */
export const WIRE_FOLLOWUP_STEPS = ["story build", "records sweep"] as const;
/** The wire job's own steps after this change. */
export const WIRE_STEPS = ["ingest", "news desk"] as const;
/** The fifteen-minute slot a pass takes (unique among start rows). */
export function wireFollowupsSlot(now: number): string {
  const d = new Date(now); d.setUTCSeconds(0, 0); d.setUTCMinutes(d.getUTCMinutes() - (d.getUTCMinutes() % WIRE_FOLLOWUPS_SLOT_MIN));
  return `wire-followups:${d.toISOString().slice(0, 16)}`;
}
const s1 = (ms: number) => `${Math.round(ms / 100) / 10} s`;
/** The finish row's note: each step with its seconds. */
export const followupsNote = (steps: readonly { step: string; ms: number }[]) => steps.map(x => `${x.step} ${s1(x.ms)}`).join(" · ") || "nothing ran";
/** The pass ends by this long after its start (inside the 60 s job limit, with margin for the finish row). */
export const PASS_END_MS = 52_000;
/** The records sweep's own limit, from its start: whatever is left before the pass's end (0 when the build used it all). */
export const sweepLimitMs = (passStart: number, sweepStart: number) => Math.max(0, passStart + PASS_END_MS - sweepStart);
