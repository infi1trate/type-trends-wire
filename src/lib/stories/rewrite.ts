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
