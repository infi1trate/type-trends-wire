// L2b · rewrite requests (pure). A desk asks through the door (`rewrite`) for a published story's rewrite; the story writer takes it
// first at its next allowance. Kept out of writer.ts so the standards checklist's code fingerprint does not move.
import { AI_MODELS } from "../ai-models";

/** A request stays open until the writer makes a version after it (the writer model ran, or failed twice before the fallback); the
 *  oldest open request per story is the one that counts. Returns story id → request time. */
export function openRewrites(requests: readonly { story_id: string; at: string }[], newest: ReadonlyMap<string, { created_at: string; model: string; attempts: number }>): Map<string, string> {
  const out = new Map<string, string>();
  for (const q of [...requests].sort((a, b) => a.at.localeCompare(b.at))) {
    const v = newest.get(q.story_id);
    if (v && v.created_at > q.at && (v.model === AI_MODELS.writer || v.attempts >= 3)) continue;
    if (!out.has(q.story_id)) out.set(q.story_id, q.at);
  }
  return out;
}

/** The writer's queue with requested stories first of all (oldest request first), then the usual order (`writePriority`) unchanged. */
export function requestedFirst<T extends { id: string }>(ordered: readonly T[], requested: ReadonlyMap<string, string>): T[] {
  const asked = ordered.filter(s => requested.has(s.id)).sort((a, b) => requested.get(a.id)!.localeCompare(requested.get(b.id)!));
  return [...asked, ...ordered.filter(s => !requested.has(s.id))];
}

/** Writer pass · a request whose rewrite failed its check on this many separate tries since it was made stops jumping the line. */
export const REQUEST_FIRST_FAILURES = 2;
/** Where an open request stands: `first` while fewer than two versions since the request failed their check; after that it waits
 *  behind the normal queue and `today` is false once it was tried this UTC day (at most one try a day). Pure. */
export function requestStanding(at: string, tries: readonly { created_at: string; checked: boolean }[], now: number): { first: boolean; today: boolean } {
  const failed = tries.filter(t => t.created_at > at && !t.checked);
  if (failed.length < REQUEST_FIRST_FAILURES) return { first: true, today: true };
  const day = new Date(now).toISOString().slice(0, 10);
  return { first: false, today: !failed.some(t => t.created_at.slice(0, 10) === day) };
}
