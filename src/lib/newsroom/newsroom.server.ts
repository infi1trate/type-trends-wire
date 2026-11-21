// N1 · the newsroom's database I/O: the desk log, the board, story states, spend, the wire-only switch and the memory. Service-role
// reads and writes happen only after the desk endpoint verified the editor key (or inside the pipeline); readers get two yes/no facts
// through public facades (desk_switch_on, spend_facts). The rules themselves are pure modules beside this file.
import type { SpendStatus } from "./spend";
import { missingStates, storyStates, type EditIn, type StateRow, type StoryIn, type TextIn } from "./states";
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
  const ids = stories.map(s => s.id), texts: TextIn[] = [], edits: EditIn[] = [], have = new Set<string>(), logged = new Map<number, string>();
  for (const part of chunks(ids, 150)) {
    const [t, e, s] = await Promise.all([
      db.from("story_texts").select("id,story_id,model,checked,failures,created_at").in("story_id", part),
      db.from("story_edits").select("id,story_id,action,note,payload,at").in("story_id", part),
      db.from("story_states" as never).select("ref").in("story_id", part),
    ]);
    if (t.error || e.error || s.error) throw new Error("states_inputs_read_failed");
    texts.push(...((t.data ?? []) as TextIn[])); edits.push(...((e.data ?? []) as unknown as EditIn[]));
    for (const r of (s.data ?? []) as unknown as { ref: string }[]) have.add(r.ref);
  }
  for (const part of chunks(edits.map(e => e.id), 300)) {
    const { data, error } = await db.from("desk_log").select("edit_id,actor").in("edit_id", part);
    if (error) throw new Error("desk_log_read_failed");
    for (const r of data ?? []) if (r.edit_id != null) logged.set(r.edit_id, r.actor);
  }
  const rows: StateRow[] = missingStates(stories.flatMap(s => storyStates(s, texts, edits, logged)), have);
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
