// L3 · the monthly design reading's I/O: one reading a month (insert-only, a second attempt in the same month is refused), stored from
// the L1 dry run over the leading brands; when the assembly has three to five moves, a proposed edition is written (living_editions,
// living_moves, living_edition_status "proposed") and ONE proposal "Edition N" is filed through the door for the owner. Nothing here
// makes an edition live. Service role; never throws into the job.
import { LIVE_EDITION, LIVE_VALUES, applyMoves, type Move } from "./editions";
import { dryRun } from "./rules";
import { assemble, editionProposal, monthName, monthOf, noEditionNote, readingLine, readingSignals, type DeskMove, type Reading } from "./reading";
import type { Value } from "./settings";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

/** The design review desk's setting moves (build queue kind "design move") with each one's latest queue status. */
export async function loadDeskMoves(db: Admin): Promise<DeskMove[]> {
  const q = await db.from("build_queue").select("id,at,title,move,test,proposal_log_id").eq("kind", "design move").order("id", { ascending: false }).limit(200);
  if (q.error) throw q.error;
  const ids = (q.data ?? []).map(x => x.id);
  const st = ids.length ? await db.from("build_queue_moves").select("item_id,status,id").in("item_id", ids).order("id") : { data: [], error: null };
  if (st.error) throw st.error;
  const last = new Map<number, string>(); for (const m of st.data ?? []) last.set(m.item_id, m.status);
  return (q.data ?? []).flatMap(x => { const mv = (x.move ?? null) as { setting?: unknown; from?: unknown; to?: unknown } | null;
    return mv && typeof mv.setting === "string" ? [{ item: x.id, log: x.proposal_log_id ?? null, at: x.at, setting: mv.setting, from: mv.from as Value, to: mv.to as Value, status: last.get(x.id) ?? "queued", test: !!x.test, title: x.title }] : []; });
}

export type ReadingResult = { ok: true; reading: Reading; line: string; proposal_log: number | null } | { ok: false; refused: string };
/** One month's reading. `dry` stores nothing and files nothing (the proof and the tests' shape). */
export async function runReading(db: Admin, o: { now?: string; dry?: boolean } = {}): Promise<ReadingResult> {
  const now = o.now ?? new Date().toISOString(), month = monthOf(now);
  const have = await db.from("living_readings").select("id").eq("month", month).limit(1);
  if (have.error) throw have.error;
  if (have.data?.length) return { ok: false, refused: `A reading for ${monthName(month)} is already stored; one reading a month.` };
  const { loadLeading, loadEditions } = await import("./living.server");
  const [leading, desk, eds] = await Promise.all([loadLeading(db as never), loadDeskMoves(db), loadEditions(db as never)]);
  const dry = dryRun(LIVE_VALUES, leading.rows), signals = readingSignals(dry.rows);
  const a = assemble({ live: LIVE_VALUES, signals, desk, now });
  const next = Math.max(LIVE_EDITION.number, ...eds.map(e => e.number)) + 1;
  const note = a.edition ? `Edition ${next} proposed: ${a.moves.length} moves, waiting on the owner.` : noEditionNote(a.ready);
  const reading: Reading = { month, read_at: now, run_id: leading.runId == null ? null : String(leading.runId), edition: LIVE_EDITION.number, signals, ready: a.ready, proposed_edition: a.edition ? next : null, note };
  const line = readingLine(reading);
  if (o.dry) return { ok: true, reading, line, proposal_log: null };
  // The month is claimed first (unique on month): a second attempt in the same month is refused by the database too.
  const ins = await db.from("living_readings").insert({ month, read_at: now, run_id: reading.run_id, edition: reading.edition, signals: signals as never, ready: a.ready, proposed_edition: reading.proposed_edition, note });
  if (ins.error) { if (ins.error.code === "23505") return { ok: false, refused: `A reading for ${monthName(month)} is already stored; one reading a month.` }; throw ins.error; }
  let proposal_log: number | null = null;
  if (a.edition) proposal_log = await writeProposed(db, next, a.moves, now);
  return { ok: true, reading, line, proposal_log };
}
/** The proposed edition's rows, then the one proposal through the door. */
async function writeProposed(db: Admin, n: number, moves: readonly Move[], now: string): Promise<number | null> {
  const e = await db.from("living_editions").insert({ number: n, dated: now.slice(0, 10), values: applyMoves(LIVE_VALUES, moves) as never });
  if (e.error) throw e.error;
  const m = await db.from("living_moves").insert(moves.map(x => ({ edition: n, setting: x.setting, old_value: x.from as never, new_value: x.to as never, signal: x.signal, share: x.share, count: x.count, base: x.base, rule: x.rule })));
  if (m.error) throw m.error;
  const s = await db.from("living_edition_status").insert({ edition: n, status: "proposed", note: `Edition ${n}: assembled from the ${monthName(monthOf(now))} reading; waiting on the owner.`, at: now });
  if (s.error) throw s.error;
  const { deskDoor } = await import("../stories/desk.server");
  const r = await deskDoor("design review", { action: "propose", kind: "design_edition", subject: `edition:${n}`, text: editionProposal(n, moves) });
  return (r.body as { log?: number }).log ?? null;
}
/** The colophon's readings, newest first (public read). */
export async function loadReadings(db: { from: Admin["from"] }): Promise<Pick<Reading, "month" | "signals" | "note" | "proposed_edition">[]> {
  const r = await db.from("living_readings").select("month,signals,note,proposed_edition").order("month", { ascending: false }).limit(60);
  if (r.error) throw r.error;
  return (r.data ?? []).map(x => ({ month: x.month, signals: x.signals as never, note: x.note, proposed_edition: x.proposed_edition }));
}
