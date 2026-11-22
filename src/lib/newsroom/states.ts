// N1 · story state history (pure). States are read from what the pipeline already stores (stories, story_texts, story_edits), so
// recording them changes no behaviour: each state row names the stored row it came from (`ref`), and is written once.
// N2: `reviewed` is written when standards passed a story and the editor in chief placed it (a story_reviews row of the editor in
// chief, read here); a story waiting for review has no "held" row of its own (it is not held by a decision, it is queued).
// N3: `picture checked` is written when the graphics desk checked (or, failing or out of limit, left by rule) the story's lead picture.
export const STORY_STATES = ["candidate", "drafted", "checked", "picture checked", "reviewed", "published", "held", "killed", "retired"] as const;
export type StoryState = (typeof STORY_STATES)[number];
export type StateRow = { story_id: string; state: StoryState; actor: string; reason: string | null; at: string; ref: string };

export type StoryIn = { id: string; status: string; reason: string | null; created_at: string };
export type TextIn = { id: number; story_id: string; model: string; checked: boolean; failures: string[] | null; created_at: string };
export type EditIn = { id: number; story_id: string; action: string; note: string | null; payload: unknown; at: string };
/** N2 · the editor in chief's placements (run or lead), with the reviewed line (which also says when a desk fell back). */
export type ReviewIn = { id: number; story_id: string; desk: string; verdict: string; reason: string | null; at: string };
/** N3 · the graphics desk's picture choices (picture_choices rows by the graphics desk). */
export type PictureIn = { id: number; story_id: string; actor: string; verdict: string; reason: string; at: string };
const AWAITING_RE = /^awaiting review/;

/** story_edits rows the engine writes by rule start with these words (the desk writes the rest). */
const RULE_NOTE = /^(Retired:|Re-planned:|Held:|Folded:|Updated [0-9]|Reworded)/;
export const editActor = (e: Pick<EditIn, "note">, logged?: string) => logged ?? (e.note && RULE_NOTE.test(e.note) ? "engine" : "editor");
const payloadReason = (p: unknown) => (p && typeof p === "object" && typeof (p as { reason?: unknown }).reason === "string" ? (p as { reason: string }).reason : null);
/** What a kill edit means: the engine's retirement and hold notes say so; otherwise it was taken down. */
export const killState = (e: Pick<EditIn, "note">): "retired" | "held" | "killed" => e.note?.startsWith("Retired:") ? "retired" : e.note?.startsWith("Held:") ? "held" : "killed";

/** Every state a story's stored rows imply, oldest first. `loggedActors` maps a story_edits id to the desk that wrote it. */
export function storyStates(s: StoryIn, texts: readonly TextIn[], edits: readonly EditIn[], loggedActors: ReadonlyMap<number, string> = new Map(), reviews: readonly ReviewIn[] = [], pictures: readonly PictureIn[] = []): StateRow[] {
  const out: StateRow[] = [];
  const add = (state: StoryState, actor: string, reason: string | null, at: string, ref: string) => out.push({ story_id: s.id, state, actor, reason: reason && reason.trim().length >= 3 ? reason.slice(0, 600) : state === "held" || state === "killed" || state === "retired" ? `${state} (no reason stored)` : reason, at, ref });
  add("candidate", "engine", null, s.created_at, `story:${s.id}:candidate`);
  let cur: StoryState = s.status === "published" ? "published" : "held";
  if (s.status === "held" && AWAITING_RE.test(s.reason ?? "")) cur = "candidate";
  else add(cur, "engine", s.status === "published" ? null : s.reason, s.created_at, `story:${s.id}:${cur}`);
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
  for (const p of pictures) if (p.story_id === s.id && p.actor === "graphics") evs.push({ at: p.at, order: 0.25, f: () => { add("picture checked", "graphics", p.verdict === "fallback" ? p.reason : `${p.verdict === "keep" ? "Kept" : p.verdict === "none" ? "No picture" : "Changed"}: ${p.reason}`, p.at, `picture:${p.id}`); } });
  for (const r of reviews) if (r.story_id === s.id && r.desk === "editor in chief" && (r.verdict === "run" || r.verdict === "lead")) evs.push({ at: r.at, order: 0.5, f: () => { add("reviewed", "editor in chief", r.reason, r.at, `review:${r.id}`); } });
  evs.sort((a, b) => a.at.localeCompare(b.at) || a.order - b.order).forEach(e => e.f());
  return out;
}
/** The rows not yet written (by ref). */
export const missingStates = (rows: readonly StateRow[], have: ReadonlySet<string>) => rows.filter(r => !have.has(r.ref));
/** A story's current state: its newest row. */
export const currentState = (rows: readonly Pick<StateRow, "state" | "at">[]) => rows.length ? rows[rows.length - 1]!.state : null;
