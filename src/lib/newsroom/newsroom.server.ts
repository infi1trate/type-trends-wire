// N1 · the newsroom's database I/O: the desk log, the board, story states, spend, the wire-only switch and the memory. Service-role
// reads and writes happen only after the desk endpoint verified the editor key (or inside the pipeline); readers get two yes/no facts
// through public facades (desk_switch_on, spend_facts). The rules themselves are pure modules beside this file.
import type { SpendStatus } from "./spend";
import { missingStates, storyStates, type EditIn, type ReviewIn, type StateRow, type StoryIn, type TextIn } from "./states";
import type { HistoryRow, LogRow } from "./log";
export type { HistoryRow, LogRow } from "./log";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

export async function insertLog(db: Admin, r: LogRow): Promise<void> {
  const row = { ...r, actor: r.actor.slice(0, 40), action: r.action.slice(0, 40), subject_id: r.subject_id?.slice(0, 200) ?? null, reason: r.reason?.slice(0, 600) ?? null, detail: r.detail ?? {} };
  const { error } = await db.from("desk_log").insert(row as never);
  if (error) throw new Error("desk_log_insert_failed");
}
/** The desk history (log plus story edits), newest first. */
export async function loadHistory(db: Admin, o: { days: number; actor?: string | null; limit?: number }): Promise<HistoryRow[]> {
  let q = db.from("desk_history" as never).select("ref,at,actor,action,level,subject_kind,subject_id,decision,reason,source").gte("at", new Date(Date.now() - o.days * 864e5).toISOString()).order("at", { ascending: false }).limit(Math.min(o.limit ?? 300, 1000));
  if (o.actor) q = q.eq("actor", o.actor);
  const { data, error } = await q;
  if (error) throw new Error("desk_history_read_failed");
  return (data ?? []) as unknown as HistoryRow[];
}

// SPEND ----------------------------------------------------------------------------------------------------------------------------
export async function spendStatus(db: Admin): Promise<SpendStatus> {
  const { data, error } = await db.rpc("spend_status" as never);
  if (error || !data) throw new Error("spend_status_failed");
  const j = data as unknown as Record<string, unknown>, n = (x: unknown) => (x == null ? null : Number(x));
  const cap = j["cap"] as Record<string, unknown> | null;
  return {
    week_start: String(j["week_start"]), model_usd: Number(j["model_usd"] ?? 0), build_credits: Number(j["build_credits"] ?? 0),
    by_kind: ((j["by_kind"] as Record<string, unknown>[] | null) ?? []).map(k => ({ kind: String(k["kind"]), model: String(k["model"]), calls: Number(k["calls"]), usd: Number(k["usd"]) })),
    cap: cap ? { model_usd: n(cap["model_usd"]), build_credits: n(cap["build_credits"]), set_at: String(cap["set_at"]) } : null,
  };
}
let capMemo: { at: number; reached: boolean } | null = null;
/** Whether the weekly cap is reached (memoised a minute per isolate). An unreadable status counts as reached: spend fails closed. */
export async function capReachedNow(db: Admin, now = Date.now()): Promise<boolean> {
  if (capMemo && now - capMemo.at < 60_000) return capMemo.reached;
  const { capReached } = await import("./spend");
  const reached = await spendStatus(db).then(capReached).catch(() => true);
  capMemo = { at: now, reached };
  return reached;
}
export const resetCapMemo = () => { capMemo = null; };
export async function insertSpend(db: Admin, r: { credits: number; what: string; actor: string }) {
  const { data, error } = await db.from("spend_entries" as never).insert({ kind: "build", ...r } as never).select("id,at").single();
  if (error || !data) throw new Error("spend_insert_failed");
  return data as unknown as { id: number; at: string };
}
export async function insertCap(db: Admin, r: { model_usd: number | null; build_credits: number | null; reason: string }) {
  const { error } = await db.from("spend_caps" as never).insert({ ...r, actor: "owner" } as never);
  if (error) throw new Error("cap_insert_failed");
  resetCapMemo();
}

// THE WIRE-ONLY SWITCH -------------------------------------------------------------------------------------------------------------
let wireMemo: { at: number; on: boolean } | null = null;
/** Read through the public facade (anonymous); an unreadable switch reads as off, so the front page never empties by accident. */
export async function wireOnlyOn(now = Date.now()): Promise<boolean> {
  if (wireMemo && now - wireMemo.at < 30_000) return wireMemo.on;
  const { supabaseAnon } = await import("../mcp/supabase");
  const { data, error } = await supabaseAnon().rpc("desk_switch_on" as never, { p_name: "wire_only" } as never);
  const on = !error && data === true;
  wireMemo = { at: now, on };
  return on;
}
export async function setWireOnly(db: Admin, on: boolean, reason: string) {
  const { error } = await db.from("desk_switches" as never).insert({ name: "wire_only", is_on: on, actor: "owner", reason } as never);
  if (error) throw new Error("switch_insert_failed");
  wireMemo = null;
}

// THE BOARD ------------------------------------------------------------------------------------------------------------------------
export type Assignment = { pitch_id: number; desk: string; status: string; actor: string; reason: string | null; at: string };
export async function insertAssignment(db: Admin, r: Omit<Assignment, "at">) {
  const { data: p, error: e1 } = await db.from("pitches").select("id").eq("id", r.pitch_id).maybeSingle();
  if (e1) throw new Error("pitch_lookup_failed");
  if (!p) return null;
  const { data, error } = await db.from("pitch_assignments" as never).insert(r as never).select("pitch_id,desk,status,actor,reason,at").single();
  if (error || !data) throw new Error("assignment_insert_failed");
  return data as unknown as Assignment;
}
/** Pitches (newest 50) with their engine verdict and their latest assignment. */
export async function loadBoard(db: Admin) {
  const { listPitches } = await import("../stories/pitch.server");
  const items = await listPitches(db, 50);
  const ids = items.map(i => i.pitch.id);
  const { data, error } = ids.length ? await db.from("pitch_assignments" as never).select("pitch_id,desk,status,actor,reason,at").in("pitch_id", ids).order("id", { ascending: false }) : { data: [], error: null };
  if (error) throw new Error("assignments_read_failed");
  const latest = new Map<number, Assignment>();
  for (const a of (data ?? []) as unknown as Assignment[]) if (!latest.has(a.pitch_id)) latest.set(a.pitch_id, a);
  return items.map(i => ({ ...i, assignment: latest.get(i.pitch.id) ?? null }));
}

// STORY STATES ---------------------------------------------------------------------------------------------------------------------
const chunks = <T,>(xs: readonly T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
let syncedAt = 0;
/**
 * Write the states the stored rows imply for stories created in the last `days` days (each state once, keyed by the row it came
 * from). Called after every build and desk edit; a failure never fails either. Returns how many rows were written.
 */
export async function syncStoryStates(db: Admin, o: { days: number; force?: boolean; now?: number }): Promise<number> {
  const now = o.now ?? Date.now();
  if (!o.force && now - syncedAt < 5 * 60_000) return 0;
  syncedAt = now;
  const since = new Date(now - o.days * 864e5).toISOString(), stories: StoryIn[] = [];
  for (let f = 0; ; f += 1000) {
    const { data, error } = await db.from("stories").select("id,status,reason,created_at").gte("created_at", since).order("created_at").range(f, f + 999);
    if (error) throw new Error("stories_read_failed");
    stories.push(...(data ?? [])); if (!data || data.length < 1000) break;
  }
  const ids = stories.map(s => s.id), texts: TextIn[] = [], edits: EditIn[] = [], reviews: ReviewIn[] = [], pictures: import("./states").PictureIn[] = [], have = new Set<string>(), logged = new Map<number, string>();
  for (const part of chunks(ids, 150)) {
    const [t, e, s, r] = await Promise.all([
      db.from("story_texts").select("id,story_id,model,checked,failures,created_at").in("story_id", part),
      db.from("story_edits").select("id,story_id,action,note,payload,at").in("story_id", part),
      db.from("story_states" as never).select("ref").in("story_id", part),
      db.from("story_reviews").select("id,story_id,desk,verdict,reason,at").eq("desk", "editor in chief").in("story_id", part),
    ]);
    const pc = await db.from("picture_choices").select("id,story_id,actor,verdict,reason,at").eq("actor", "graphics").in("story_id", part);
    if (t.error || e.error || s.error || r.error || pc.error) throw new Error("states_inputs_read_failed");
    pictures.push(...((pc.data ?? []) as import("./states").PictureIn[]));
    texts.push(...((t.data ?? []) as TextIn[])); edits.push(...((e.data ?? []) as unknown as EditIn[])); reviews.push(...((r.data ?? []) as ReviewIn[]));
    for (const r of (s.data ?? []) as unknown as { ref: string }[]) have.add(r.ref);
  }
  for (const part of chunks(edits.map(e => e.id), 300)) {
    const { data, error } = await db.from("desk_log").select("edit_id,actor").in("edit_id", part);
    if (error) throw new Error("desk_log_read_failed");
    for (const r of data ?? []) if (r.edit_id != null) logged.set(r.edit_id, r.actor);
  }
  const rows: StateRow[] = missingStates(stories.flatMap(s => storyStates(s, texts, edits, logged, reviews, pictures)), have);
  let written = 0;
  for (const part of chunks(rows, 500)) {
    const { data, error } = await db.from("story_states" as never).upsert(part as never, { onConflict: "ref", ignoreDuplicates: true }).select("id");
    if (error) throw new Error("states_insert_failed");
    written += (data as unknown[] | null)?.length ?? 0;
  }
  return written;
}
/** State history for these stories, oldest first per story. */
export async function statesFor(db: Admin, ids: readonly string[]): Promise<Map<string, Pick<StateRow, "state" | "actor" | "reason" | "at">[]>> {
  const out = new Map<string, Pick<StateRow, "state" | "actor" | "reason" | "at">[]>();
  for (const part of chunks(ids, 150)) {
    const { data, error } = await db.from("story_states" as never).select("story_id,state,actor,reason,at").in("story_id", part).order("at").order("id");
    if (error) throw new Error("states_read_failed");
    for (const r of (data ?? []) as unknown as (StateRow & { story_id: string })[]) { const l = out.get(r.story_id) ?? []; l.push({ state: r.state, actor: r.actor, reason: r.reason, at: r.at }); out.set(r.story_id, l); }
  }
  return out;
}

// N2 · NOTES, PROPOSALS, THE DESKS' CAPS AND REVIEWS ------------------------------------------------------------------------------
export type Note = { id: number; at: string; actor: string; subject_kind: string; subject_id: string; text: string };
export async function insertNote(db: Admin, r: Omit<Note, "id" | "at">): Promise<Note> {
  const { data, error } = await db.from("desk_notes").insert(r).select("id,at,actor,subject_kind,subject_id,text").single();
  if (error || !data) throw new Error("note_insert_failed");
  return data as Note;
}
export async function loadNotes(db: Admin, days = 14): Promise<Note[]> {
  const { data, error } = await db.from("desk_notes").select("id,at,actor,subject_kind,subject_id,text").gte("at", new Date(Date.now() - days * 864e5).toISOString()).order("id", { ascending: false }).limit(200);
  if (error) throw new Error("notes_read_failed");
  return (data ?? []) as Note[];
}
export type Proposal = { id: number; at: string; desk: string; kind: string; subject: string | null; text: string; status: "open" | "accepted" | "declined"; status_at: string | null; status_reason: string | null };
/** Every `propose` call (the desk log's proposed rows) with the owner's latest status (open until set). */
export async function loadProposals(db: Admin, limit = 100): Promise<Proposal[]> {
  const { data, error } = await db.from("desk_log").select("id,at,actor,subject_id,reason,detail").eq("action", "propose").eq("decision", "proposed").order("id", { ascending: false }).limit(limit);
  if (error) throw new Error("proposals_read_failed");
  const ids = (data ?? []).map(r => r.id);
  const st = ids.length ? await db.from("proposal_statuses").select("log_id,status,reason,at").in("log_id", ids).order("id", { ascending: false }) : { data: [], error: null };
  if (st.error) throw new Error("proposal_statuses_read_failed");
  const latest = new Map<number, { status: string; reason: string | null; at: string }>();
  for (const s of st.data ?? []) if (!latest.has(s.log_id)) latest.set(s.log_id, s);
  return (data ?? []).map(r => { const d = (r.detail ?? {}) as Record<string, unknown>, s = latest.get(r.id); return { id: r.id, at: r.at, desk: r.actor, kind: typeof d["kind"] === "string" ? d["kind"] : "proposal", subject: r.subject_id, text: typeof d["text"] === "string" ? d["text"] : r.reason ?? "", status: (s?.status ?? "open") as Proposal["status"], status_at: s?.at ?? null, status_reason: s?.reason ?? null }; });
}
export async function insertProposalStatus(db: Admin, r: { log_id: number; status: string; reason: string | null }) {
  const { data: p, error: e1 } = await db.from("desk_log").select("id").eq("id", r.log_id).eq("action", "propose").eq("decision", "proposed").maybeSingle();
  if (e1) throw new Error("proposal_lookup_failed");
  if (!p) return null;
  const { error } = await db.from("proposal_statuses").insert({ ...r, actor: "owner" });
  if (error) throw new Error("proposal_status_insert_failed");
  return r.status;
}
/** Each desk's model calls today (UTC) against its cap, the stories that passed standards today without the second reader, and the
 *  week's desk spend. Fixture runs are not counted against the caps. */
export async function deskCaps(db: Admin) {
  const { DESK_LIMITS } = await import("./caps");
  const start = new Date(); start.setUTCHours(0, 0, 0, 0);
  const { etWeekStart } = await import("./spend");
  const [today, week, rv] = await Promise.all([
    db.from("desk_calls").select("desk,purpose,ok").gte("at", start.toISOString()),
    db.from("desk_calls").select("desk,cost,purpose").gte("at", etWeekStart(Date.now())),
    db.from("story_reviews").select("id", { count: "exact", head: true }).eq("desk", "standards").eq("verdict", "pass").neq("second_reader", "ran").gte("at", start.toISOString()),
  ]);
  if (today.error || week.error) throw new Error("desk_calls_read_failed");
  // N3 · one row per limit (graphics has two: pictures and study charts).
  const by = (desk: string, purpose: string) => (today.data ?? []).filter(x => x.desk === desk && x.purpose === purpose);
  return {
    desks: DESK_LIMITS.map(l => ({ desk: l.desk === "graphics" ? `${l.desk} · ${l.what}` : l.desk, cap: l.cap, used: by(l.desk, l.purpose).length, failed: by(l.desk, l.purpose).filter(x => !x.ok).length, week_usd: Math.round((week.data ?? []).filter(x => x.desk === l.desk && x.purpose === l.purpose).reduce((a, x) => a + Number(x.cost), 0) * 1e4) / 1e4 })),
    fixture_calls_today: (today.data ?? []).filter(x => x.purpose === "fixture").length,
    without_second_reader_today: rv.count ?? 0,
  };
}
export type ReviewView = { at: string; desk: string; verdict: string; reason: string | null; checklist: unknown; problems: unknown; second_reader: string | null; placement: number | null; basis: string };
/** The newest standards review and the newest editor-in-chief decision per story. */
export async function reviewsFor(db: Admin, ids: readonly string[]): Promise<Map<string, { standards: ReviewView | null; chief: ReviewView | null }>> {
  const out = new Map<string, { standards: ReviewView | null; chief: ReviewView | null }>();
  for (const part of chunks(ids, 150)) {
    const { data, error } = await db.from("story_reviews").select("story_id,at,desk,verdict,reason,checklist,problems,second_reader,placement,basis").in("story_id", part).order("id", { ascending: false });
    if (error) throw new Error("reviews_read_failed");
    for (const r of data ?? []) {
      const cur = out.get(r.story_id) ?? { standards: null, chief: null }, key = r.desk === "standards" ? "standards" : "chief";
      if (!cur[key]) cur[key] = r as ReviewView;
      out.set(r.story_id, cur);
    }
  }
  return out;
}
/** N3 · a standards hold made by the second reader alone (every checklist item passed or did not apply). Pure. */
export const secondReaderHoldOnly = (r: { verdict: string; checklist?: unknown; problems?: unknown; second_reader?: string | null }) =>
  r.verdict === "hold" && r.second_reader === "ran" && Array.isArray(r.checklist) && (r.checklist as { result?: string }[]).every(i => i.result !== "fail")
  && Array.isArray(r.problems) && (r.problems as { severity?: string }[]).some(p => p.severity === "blocker");
/** N3 · standards releases a story only its second reader held: a pass "over its second reader", on the same facts it held. */
export async function insertOverrule(db: Admin, r: { story_id: string; reason: string }): Promise<boolean> {
  const { data, error } = await db.from("story_reviews").select("facts_hash,checklist,problems,second_reader,verdict,prompt_version").eq("story_id", r.story_id).eq("desk", "standards").order("id", { ascending: false }).limit(1).maybeSingle();
  if (error || !data || !secondReaderHoldOnly(data)) return false;
  const { error: e2 } = await db.from("story_reviews").insert({ story_id: r.story_id, desk: "standards", verdict: "pass", reason: `Passed over its second reader: ${r.reason}`.slice(0, 600), facts_hash: data.facts_hash, checklist: data.checklist, problems: data.problems, second_reader: "overruled", basis: "desk", prompt_version: data.prompt_version } as never);
  return !e2;
}
/** A standards pass still stands when it is newer than the story's last reader-visible change. Pure. */
export const standardsPassStands = (pass: { verdict: string; at: string } | null, lastChange: string | null): boolean =>
  !!pass && pass.verdict === "pass" && (!lastChange || Date.parse(pass.at) >= Date.parse(lastChange));
/** Where a story stands for the door's release rule. */
export async function holdOf(db: Admin, id: string) {
  const [{ applyEdits, isHoldEdit }, { isPending }] = await Promise.all([import("../stories/edits"), import("./review")]);
  const cols = "id,type,status,reason,score,components,why_ran,kicker,headline,deck,facts,why_line,why_model,why_at,sector,signal_keys,domains,evidence,source_ids,basis,happened_at,created_at";
  const [st, ed, rv, tx] = await Promise.all([db.from("stories").select(cols).eq("id", id).maybeSingle(), db.from("story_edits").select("id,story_id,action,payload,note,at").eq("story_id", id).order("id"), db.from("story_reviews").select("verdict,facts_hash,at,checklist,problems,second_reader").eq("story_id", id).eq("desk", "standards").order("id", { ascending: false }).limit(1), db.from("story_texts").select("created_at").eq("story_id", id).order("created_at", { ascending: false }).limit(1)]);
  if (st.error || ed.error || rv.error || tx.error || !st.data) return null;
  const v = applyEdits(st.data as unknown as import("../stories/edits").StoredStory, (ed.data ?? []) as never, Date.now());
  const lastHold = [...v.edits].reverse().find(e => isHoldEdit(e));
  const heldBy = v.state === "held" && lastHold ? (typeof lastHold.payload?.["desk"] === "string" ? String(lastHold.payload["desk"]) : "engine") : null;
  // Standards passed it: its newest standards review is a pass made after the last thing that changed what a reader sees (a new
  // written text or a correction). A later change needs a new review before the editor in chief can release the story.
  const pass = rv.data?.[0], changed = [tx.data?.[0]?.created_at, ...v.edits.filter(e => e.action === "correct").map(e => e.at)].filter((x): x is string => !!x).sort().at(-1);
  const standardsPassed = standardsPassStands(pass ?? null, changed ?? null);
  // N3 · held by its second reader alone: the newest standards review is a hold, every checklist item passed and a blocker stood.
  const secondReaderOnly = !!pass && secondReaderHoldOnly(pass);
  return { state: v.state, pending: isPending(v), heldBy, standardsPassed, secondReaderOnly };
}
/** /desk · the last few days' reviewed stories: each story's newest standards review (checklist and second-reader problems) and the
 *  editor in chief's newest decision, with the story's headline. */
export async function recentReviews(db: Admin, days = 3) {
  const { data, error } = await db.from("story_reviews").select("story_id,at,desk,verdict,reason,checklist,problems,second_reader,placement,basis,prompt_version").gte("at", new Date(Date.now() - days * 864e5).toISOString()).order("id", { ascending: false }).limit(400);
  if (error) throw new Error("reviews_read_failed");
  const by = new Map<string, { story_id: string; standards: ReviewView | null; chief: ReviewView | null }>();
  for (const r of data ?? []) { const cur = by.get(r.story_id) ?? { story_id: r.story_id, standards: null, chief: null }, k = r.desk === "standards" ? "standards" : "chief"; if (!cur[k]) cur[k] = r as ReviewView; by.set(r.story_id, cur); }
  const ids = [...by.keys()];
  const heads = new Map<string, string>();
  for (const part of chunks(ids, 150)) { const { data: s } = await db.from("stories").select("id,headline").in("id", part); for (const x of s ?? []) heads.set(x.id, x.headline); }
  return [...by.values()].map(x => ({ ...x, headline: heads.get(x.story_id) ?? x.story_id }));
}
