// N1 · story state history (pure). States are read from what the pipeline already stores (stories, story_texts, story_edits), so
// recording them changes no behaviour: each state row names the stored row it came from (`ref`), and is written once.
// `reviewed` is the editor desk's sign-off (N2); nothing writes or requires it yet.
export const STORY_STATES = ["candidate", "drafted", "checked", "reviewed", "published", "held", "killed", "retired"] as const;
export type StoryState = (typeof STORY_STATES)[number];
export type StateRow = { story_id: string; state: StoryState; actor: string; reason: string | null; at: string; ref: string };

export type StoryIn = { id: string; status: string; reason: string | null; created_at: string };
export type TextIn = { id: number; story_id: string; model: string; checked: boolean; failures: string[] | null; created_at: string };
export type EditIn = { id: number; story_id: string; action: string; note: string | null; payload: unknown; at: string };

/** story_edits rows the engine writes by rule start with these words (the desk writes the rest). */
const RULE_NOTE = /^(Retired:|Re-planned:|Held:|Folded:|Updated [0-9]|Reworded)/;
export const editActor = (e: Pick<EditIn, "note">, logged?: string) => logged ?? (e.note && RULE_NOTE.test(e.note) ? "engine" : "editor");
const payloadReason = (p: unknown) => (p && typeof p === "object" && typeof (p as { reason?: unknown }).reason === "string" ? (p as { reason: string }).reason : null);
/** What a kill edit means: the engine's retirement and hold notes say so; otherwise it was taken down. */
export const killState = (e: Pick<EditIn, "note">): "retired" | "held" | "killed" => e.note?.startsWith("Retired:") ? "retired" : e.note?.startsWith("Held:") ? "held" : "killed";

/** Every state a story's stored rows imply, oldest first. `loggedActors` maps a story_edits id to the desk that wrote it. */
export function storyStates(s: StoryIn, texts: readonly TextIn[], edits: readonly EditIn[], loggedActors: ReadonlyMap<number, string> = new Map()): StateRow[] {
  const out: StateRow[] = [];
  const add = (state: StoryState, actor: string, reason: string | null, at: string, ref: string) => out.push({ story_id: s.id, state, actor, reason: reason && reason.trim().length >= 3 ? reason.slice(0, 600) : state === "held" || state === "killed" || state === "retired" ? `${state} (no reason stored)` : reason, at, ref });
  add("candidate", "engine", null, s.created_at, `story:${s.id}:candidate`);
  let cur: StoryState = s.status === "published" ? "published" : "held";
  add(cur, "engine", s.status === "published" ? null : s.reason, s.created_at, `story:${s.id}:${cur}`);
  type Ev = { at: string; order: number; f: () => void };
  const evs: Ev[] = [];
  for (const t of texts) if (t.story_id === s.id) evs.push({ at: t.created_at, order: 0, f: () => {
    const fb = t.model === "template";
    add("drafted", "story writer", fb ? "The check refused the writer's text; the facts-built text is shown." : null, t.created_at, `text:${t.id}:drafted`);
    if (t.checked && !fb) add("checked", "story writer", null, t.created_at, `text:${t.id}:checked`);
  } });
  for (const e of edits) if (e.story_id === s.id) evs.push({ at: e.at, order: 1, f: () => {
    const actor = editActor(e, loggedActors.get(e.id)), reason = payloadReason(e.payload) ?? e.note;
    if (e.action === "kill") { cur = killState(e); add(cur, actor, reason, e.at, `edit:${e.id}`); }
    else if (e.action === "restore") { cur = "published"; add(cur, actor, reason ?? "Restored by the desk.", e.at, `edit:${e.id}`); }
    else if (e.action === "pin" && cur === "held") { cur = "published"; add(cur, actor, reason ?? "Pinned: a held story runs.", e.at, `edit:${e.id}`); }
  } });
  evs.sort((a, b) => a.at.localeCompare(b.at) || a.order - b.order).forEach(e => e.f());
  return out;
}
/** The rows not yet written (by ref). */
export const missingStates = (rows: readonly StateRow[], have: ReadonlySet<string>) => rows.filter(r => !have.has(r.ref));
/** A story's current state: its newest row. */
export const currentState = (rows: readonly Pick<StateRow, "state" | "at">[]) => rows.length ? rows[rows.length - 1]!.state : null;
