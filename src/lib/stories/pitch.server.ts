// U4 · pitches: storage and the two ways the engine answers. Staff only: reached through /api/public/desk after the editor key, with
// the service-role client (pitches and pitch_verdicts have no visitor grants). Both tables are insert-only; a pitch's status is its
// newest verdict row. The answers come from runBuild's own plan (build.server.ts pitchView → pitch.ts pitchVerdict), so a pitch
// is judged by exactly the rules that build stories, and nothing here inserts or edits a story.
import { isOpen, verdictKey, verdictsToRecord, PITCH_BY, type EngineView, type Pitch, type PitchInput, type PitchedItem, type Verdict } from "./pitch";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
type VerdictRow = { pitch_id: number; status: Verdict["status"]; verdict: Verdict; created_at: string };
type PitchRow = { id: number; kind: Pitch["kind"]; ref: string; facts: unknown; note: string; pitched_by: string; created_at: string };
const toPitch = (r: PitchRow): Pitch => ({ id: r.id, kind: r.kind, ref: r.ref, facts: Array.isArray(r.facts) ? r.facts.map(String) : [], note: r.note, by: r.pitched_by, at: r.created_at });

/** The newest pitches with their newest verdict (the desk's Pitched list and the open set). */
export async function listPitches(db: Admin, limit = 100, before?: number): Promise<PitchedItem[]> {
  let q = db.from("pitches").select("id,kind,ref,facts,note,pitched_by,created_at").order("id", { ascending: false }).limit(limit);
  if (before != null) q = q.lt("id", before);
  const { data: ps, error } = await q;
  if (error) throw new Error("pitch_list_failed");
  const ids = (ps ?? []).map(p => p.id);
  const { data: vs, error: e2 } = ids.length ? await db.from("pitch_verdicts").select("pitch_id,status,verdict,source,created_at").in("pitch_id", ids).order("id", { ascending: false }) : { data: [], error: null };
  if (e2) throw new Error("pitch_verdicts_failed");
  const last = new Map<number, VerdictRow & { source: "desk" | "build" }>();
  for (const v of (vs ?? []) as unknown as (VerdictRow & { source: "desk" | "build" })[]) if (!last.has(v.pitch_id)) last.set(v.pitch_id, v);
  return ((ps ?? []) as unknown as PitchRow[]).map(r => { const v = last.get(r.id); return { pitch: toPitch(r), verdict: v?.verdict ?? null, answeredAt: v?.created_at ?? null, source: v?.source ?? null }; });
}
async function numbers(db: Admin): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("story_numbers").select("story_id,number").order("number").range(from, from + 999);
    if (error) throw new Error("story_numbers_failed");
    for (const r of data ?? []) out.set(r.story_id, r.number);
    if ((data ?? []).length < 1000) return out;
  }
}
/** Answer the open pitches (or only `ids`) from one build's view; appends a verdict row where the answer changed. */
export async function answerPitches(db: Admin, view: Omit<EngineView, "numberOf">, source: "desk" | "build", ids?: number[]): Promise<number> {
  // Every pitch, newest first, in pages (verdict reads are chunked by the page's ids), so no open pitch is ever left unanswered.
  const all: PitchedItem[] = [];
  for (let before: number | undefined; ;) { const page = await listPitches(db, 200, before); all.push(...page); if (page.length < 200) break; before = page.at(-1)!.pitch.id; }
  const todo = all.filter(x => (ids ? ids.includes(x.pitch.id) : isOpen(x.verdict?.status ?? null)));
  if (!todo.length) return 0;
  const n = await numbers(db);
  const last = new Map(todo.filter(x => x.verdict).map(x => [x.pitch.id, verdictKey(x.verdict!)]));
  const rows = verdictsToRecord(todo.map(x => x.pitch), last, { ...view, numberOf: id => n.get(id) ?? null });
  if (!rows.length) return 0;
  const { error } = await db.from("pitch_verdicts").insert(rows.map(r => ({ ...r, verdict: r.verdict as never, source })));
  if (error) throw new Error("pitch_verdict_insert_failed");
  return rows.length;
}
/** Store one pitch, then ask the engine now (a dry build that writes nothing but this pitch's verdict). */
export async function pitchNow(db: Admin, p: PitchInput): Promise<PitchedItem> {
  const { data, error } = await db.from("pitches").insert({ kind: p.kind, ref: p.ref, facts: p.facts, note: p.note, pitched_by: PITCH_BY }).select("id,kind,ref,facts,note,pitched_by,created_at").single();
  if (error || !data) throw new Error("pitch_insert_failed");
  const pitch = toPitch(data as unknown as PitchRow);
  // N3 · a study pitch asks no story build (the engine does not build studies); it waits on the board.
  if (p.kind === "study") return { pitch, verdict: null, answeredAt: null, source: null };
  const { runBuild, dbDeps } = await import("./build.server");
  const d = dbDeps(db, false);
  // Only load, existing and the pitch answer: no insert, no checks, no calls, no numbers, no writer.
  await runBuild({ load: d.load, existing: d.existing, insert: async () => 0, pitches: view => answerPitches(db, view, "desk", [pitch.id]) }, { pitchDry: true, aiPerBuild: 0 }).catch(() => null);
  return (await listPitches(db, 200)).find(x => x.pitch.id === pitch.id) ?? { pitch, verdict: null, answeredAt: null, source: null };
}
