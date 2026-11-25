// V3 · restoring a story's text from before the backlist rewrite (pure). story_texts is insert-only, so a restore stores the earlier
// version again as the newest one: every version stays in the story's history and the reader shows the newest. A V3 rewrite is the
// writer's newest version made after the story's "V3 ·" rewrite request; nothing to restore when there is none.
export const V3_REASON = "V3 · Voice guide 2 backlist: rewrite headline, deck and body to the guide; facts unchanged.";
export const isV3Request = (reason: string) => reason.startsWith("V3 ·");
export type TextVersion = { story_id: string; version: number; headline: string; deck: string; body: string[] | null; how_we_know: string; created_at: string; model: string; checked: boolean };
export type RestoreRow = { story_id: string; version: number; headline: string; deck: string; body: string[]; how_we_know: string; model: "restore"; cost: 0; checked: true; attempts: 0; failures: string[] };
/** The rows that put each story's pre-V3 text back (one per story that has a V3 rewrite still showing). */
export function restoreRows(texts: readonly TextVersion[], requests: readonly { story_id: string; at: string; reason: string }[], only?: ReadonlySet<string>): RestoreRow[] {
  const asked = new Map<string, string>();
  for (const r of requests) if (isV3Request(r.reason) && (!only || only.has(r.story_id))) { const a = asked.get(r.story_id); if (!a || r.at < a) asked.set(r.story_id, r.at); }
  const out: RestoreRow[] = [];
  for (const [id, at] of asked) {
    const mine = texts.filter(t => t.story_id === id).sort((a, b) => a.version - b.version), newest = mine.at(-1);
    const before = mine.filter(t => t.created_at < at && t.checked).at(-1);
    if (!newest || !before || newest.created_at < at || newest.model === "restore") continue;
    if (newest.headline === before.headline && newest.deck === before.deck && JSON.stringify(newest.body ?? []) === JSON.stringify(before.body ?? [])) continue;
    out.push({ story_id: id, version: newest.version + 1, headline: before.headline, deck: before.deck, body: before.body ?? [], how_we_know: before.how_we_know, model: "restore", cost: 0, checked: true, attempts: 0, failures: [`restored version ${before.version}`] });
  }
  return out;
}
