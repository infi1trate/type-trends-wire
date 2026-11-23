// D1 Part 2 · WORK MARKS (pure). A crawler post stores what it was sent and marks what is now out of date; the one follow-up worker
// (the wire follow-ups pass) does that work later, one pass at a time, from the newest state. A topic marked several times while the
// worker was busy is done once. Topics are fixed words plus, for an archive replay, the brand's domain.
export const MARK_AGGREGATES = "crawl-aggregates";
export const MARK_RECORDS_FORCE = "records-force";
export const ARCHIVE_PREFIX = "archive:";
export const archiveTopic = (domain: string) => `${ARCHIVE_PREFIX}${domain.toLowerCase()}`;
export type Mark = { topic: string; marked_at: string };
/** The worker's order: summaries first (one call), then archive replays oldest mark first, then the forced sweep flag. */
export function markPlan(marks: readonly Mark[]): { aggregates: Mark | null; archives: Mark[]; force: Mark | null } {
  const by = (t: string) => marks.find(m => m.topic === t) ?? null;
  const archives = marks.filter(m => m.topic.startsWith(ARCHIVE_PREFIX)).sort((a, b) => a.marked_at.localeCompare(b.marked_at) || a.topic.localeCompare(b.topic));
  return { aggregates: by(MARK_AGGREGATES), archives, force: by(MARK_RECORDS_FORCE) };
}
export const domainOf = (m: Mark) => m.topic.slice(ARCHIVE_PREFIX.length);
/** The marked-work step's share of a pass, and the pause between heavy steps so their reads and writes never run back to back. */
export const MARKS_STEP_MS = 6_000;
export const STEP_PAUSE_MS = 1_000;
