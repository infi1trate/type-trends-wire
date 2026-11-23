// L2 · THE WIRE FOLLOW-UPS PASS (pure). The 15-minute wire job used to run the story build (with the desk jobs in its tail) and the
// records sweep after its ingest and the news desk's turn, so every wire run used its whole time limit. That work can wait a minute: it
// now runs in its own scheduled pass one minute after each wire job, one pass at a time, with a start row before the work and a finish
// row after (job_runs). Nothing is dropped: the same build and the same sweep, in the same order, with the same deadlines.
//
// T1 · the pass's caller (the managed schedule) gives up after CALLER_LIMIT_MS and the host cancels a handler still waiting on it, so
// from 16:16 UTC on 22 Nov every pass was cut off five seconds in. The route now writes the start row, answers at once with the run id
// and does the work after the answer (the host keeps work handed to it alive for 30 s after a response). Inside that window both steps
// no longer fit every time (together they took 35 to 51 s), so the slots take turns going first: :00 and :30 slots build first, :15
// and :45 slots sweep first, and the second step gets whatever the first left (the build needs 15 s, the sweep 6 s, else it waits for its own turn). A sweep that
// goes first leaves the build its 15 s, so stories are still built every fifteen minutes and the sweep has the whole window every half hour.
import { kindOf } from "../records/records";

export const WIRE_FOLLOWUPS_SCHEDULE = { name: "wire-followups", cron: "1-59/15 * * * *", path: "/api/public/jobs/wire-followups", body: { kind: "wire-followups" } } as const;
export const WIRE_FOLLOWUPS_SLOT_MIN = 15;
/** A start row with no finish row after this long no longer blocks the next pass. */
export const WIRE_FOLLOWUPS_STALE_MS = 120_000;
/** The steps, in order (the wire job's former tail). */
export const WIRE_FOLLOWUP_STEPS = ["story build", "records sweep"] as const;
export type FollowupStep = (typeof WIRE_FOLLOWUP_STEPS)[number];
/** The wire job's own steps after this change. */
export const WIRE_STEPS = ["ingest", "news desk"] as const;
/** The managed schedule's caller gives up after this long (read from its stored responses: "Timeout of 5000 ms reached"). */
export const CALLER_LIMIT_MS = 5_000;
/** How long the host keeps work alive after the answer has gone out. */
export const HOST_AFTER_ANSWER_MS = 30_000;
/** The fifteen-minute slot a pass takes (unique among start rows). */
export function wireFollowupsSlot(now: number): string {
  const d = new Date(now); d.setUTCSeconds(0, 0); d.setUTCMinutes(d.getUTCMinutes() - (d.getUTCMinutes() % WIRE_FOLLOWUPS_SLOT_MIN));
  return `wire-followups:${d.toISOString().slice(0, 16)}`;
}
/** Which step goes first in a pass: the :00 and :30 slots build first, the :15 and :45 slots sweep first. */
export function firstStep(now: number): FollowupStep {
  return Math.floor(new Date(now).getUTCMinutes() / WIRE_FOLLOWUPS_SLOT_MIN) % 2 === 0 ? "story build" : "records sweep";
}
/** Both steps, the first step's first. */
/** D1b · `held`: the story build is on hold (it only checks the hold and runs its writers' tail with what is left), so the sweep goes
 *  first in every slot and leaves it HELD_BUILD_ROOM_MS instead of BUILD_ROOM_MS. */
export const stepOrder = (now: number, held = false, urgent = false): FollowupStep[] => (!held && !urgent && firstStep(now) === "story build" ? ["story build", "records sweep"] : ["records sweep", "story build"]);
/** D1c · a stored page past its limit, or passing it before the next pass, is waiting: the sweep goes first in any slot and may take up
 *  to this long (the story build yields, as it does when held, and gets what is left). */
export const URGENT_SWEEP_MS = 20_000;
/** What a sweep going first leaves a held build. */
export const HELD_BUILD_ROOM_MS = 4_000;
const s1 = (ms: number) => `${Math.round(ms / 100) / 10} s`;
/** The finish row's note: each step with its seconds, and what it rewrote when it says. */
export const followupsNote = (steps: readonly { step: string; ms: number; note?: string | null }[]) => steps.map(x => `${x.step} ${s1(x.ms)}${x.note ? ` (${x.note})` : ""}`).join(" · ") || "nothing ran";
/** The pass ends by this long after its start row: inside the host's 30 s after the answer, with margin for the finish row. */
export const PASS_END_MS = 27_000;
/** A step still running this long after the pass's end is left behind and the finish row says so (still inside the host's window). */
export const FINISH_GRACE_MS = 1_500;
/** What the story build needs to do useful work (its own minimum); a sweep that goes first leaves at least this much. */
export const BUILD_ROOM_MS = 15_000;
/** The records sweep's own limit, from its start: going second, whatever is left before the pass's end (0 when the build used it all);
 *  going first, whatever is left less BUILD_ROOM_MS, so the story build still runs every fifteen minutes. */
export const sweepLimitMs = (passStart: number, sweepStart: number, first = false, room = BUILD_ROOM_MS, urgent = false) =>
  urgent && first ? Math.max(0, Math.min(URGENT_SWEEP_MS, passStart + PASS_END_MS - sweepStart)) : Math.max(0, passStart + PASS_END_MS - (first ? room : 0) - sweepStart);
/** What a sweep rewrote, by kind ("brand-card 12, signals 1"), for the finish row. */
export function writtenByKind(keys: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of keys) out[kindOf(k)] = (out[kindOf(k)] ?? 0) + 1;
  return out;
}
export const writtenLine = (by: Record<string, number>) => Object.entries(by).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, n]) => `${k} ${n}`).join(", ") || "nothing rewritten";
