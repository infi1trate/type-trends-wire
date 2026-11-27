// Writer pass (health:writer-starved) · THE WRITER'S OWN SHORT PASS (pure). Since T1 the follow-ups pass leaves the story build too little
// time to start a writer call, so the writer has its own pass: the first story of the writer's queue, written inside the review pass's
// handler when that pass found nothing waiting. The pass never outlives its host: the review-passes handler runs inline (no waitUntil)
// and is treated as alive for HOST_MS from its start; calls stop at HOST_MS − STORE_MS so the version and finish rows are stored in time;
// a call starts only with CALL_MS left before that, so the host never cuts one off mid-flight (an aborted call is charged in full).

/** How long the host handler is treated as alive from its start: the 30 s a cron-called route is given after its answer, the shortest
 *  window any scheduled route here works in (inline review passes have finished at up to 25.4 s; REVIEW_PASS_MS is 40 s). */
export const HOST_MS = 30_000;
/** Kept at the end for the version row and the finish row. */
export const STORE_MS = 4_000;
/** The room one writer call is given: the writer's own minimum (WRITER_CALL_MIN_MS); calls on 27 Nov took about 4 s. */
export const CALL_MS = 15_000;
/** After a pass found no room for a call, passes stand down this long (loading a build's input takes 12–18 s; never repeat it for nothing). */
export const NO_ROOM_BACKOFF_MS = 30 * 60_000;
export const NO_ROOM = "no time for a call after loading";
/** At most this many writer calls in one pass. */
export const PASS_CALLS_MAX = 3;
/** A writer-pass start row with no finish newer than this blocks the next pass (a pass cannot outlive HOST_MS). */
export const PASS_STALE_MS = 60_000;
/** An empty queue read is reused for this long while nothing it depends on has moved. */
export const EMPTY_TTL_MS = 2 * 3600_000;

/** When calls must stop: the host's end less the time kept for storing. */
export const writeEnd = (t0: number) => t0 + HOST_MS - STORE_MS;
/** Writer calls that fit in what is left before `writeEnd` (0 = none this pass; the story waits for the next). */
export const passCalls = (msLeft: number) => Math.max(0, Math.min(PASS_CALLS_MAX, Math.floor(msLeft / CALL_MS)));

/** Why the pass stands down, or null to go on. Order: hold, safe mode, a story build running, another writer pass running. */
export function passStandDown(s: { held: boolean; safeMode: boolean; buildRunning: boolean; passRunning: boolean; lastNoRoomAgoMs?: number | null }): string | null {
  if (s.held) return "held: job_hold on stories";
  if (s.safeMode) return "safe mode";
  if (s.buildRunning) return "a story build is running";
  if (s.passRunning) return "another writer pass is running";
  if (s.lastNoRoomAgoMs != null && s.lastNoRoomAgoMs < NO_ROOM_BACKOFF_MS) return "the last pass had no time for a call";
  return null;
}
/** The one story a pass takes: the first of the writer's queue (requested rewrites first, as `storiesToWrite` orders them). */
export const firstOfQueue = <T>(queue: readonly T[]): T | null => queue[0] ?? null;

/** The cheap print an empty queue is cached against: newest edit, request, text and story, and the UTC day (owed-ness can change daily). */
export type QueuePrint = { edits: number; asks: number; texts: number; stories: string; day: string };
export const samePrint = (a: QueuePrint | null, b: QueuePrint) => !!a && a.edits === b.edits && a.asks === b.asks && a.texts === b.texts && a.stories === b.stories && a.day === b.day;
/** Reuse a cached "nothing owed" when the print is unchanged and the cache is younger than EMPTY_TTL_MS. */
export const emptyStillGood = (cache: { print: QueuePrint; at: number } | null, print: QueuePrint, now: number) => !!cache && samePrint(cache.print, print) && now - cache.at < EMPTY_TTL_MS;

/** The run note: "writer pass · 1 written (checked), 2 calls" or "writer pass · skipped: <why>". */
export function passNote(r: { skipped?: string; written?: number; checked?: number; calls?: number; story?: string }): string {
  if (r.skipped) return `writer pass · skipped: ${r.skipped}`;
  const w = r.written ?? 0, c = r.checked ?? 0;
  return `writer pass · ${w} written${w ? (c === w ? " (checked)" : c ? ` (${c} checked)` : " (not checked)") : ""}, ${r.calls ?? 0} call${r.calls === 1 ? "" : "s"}`;
}
