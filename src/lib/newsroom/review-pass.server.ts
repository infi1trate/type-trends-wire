// N4c · the review pass's I/O (rules in review-pass.ts): the facts sheets the story build stores for stories waiting for review, and one
// scheduled pass of at most two stories (picture check, standards, editor in chief) between a start and a finish row in job_runs.
// Service role only. Never throws.
import type { Admin, ReviewCtx } from "./review.server";
import * as rp from "./review-pass";

/** The build's part: the facts sheet it has for each story the review pass will read (waiting for review, held by a checklist item under
 *  an earlier checklist, or published and corrected lately), written only when it changed. Stops at the deadline. Returns rows written. */
export async function storeSheets(db: Admin, r: ReviewCtx, deadline: number): Promise<number> {
  const [{ reviewIO, sheetOf }, { fnv }] = await Promise.all([import("./review.server"), import("./golden/versions")]);
  const io = reviewIO(db, r);
  const [pending, fixed, rechecks] = await Promise.all([io.pending().catch(() => []), io.checklistRechecks?.().catch(() => []) ?? [], io.rechecks().catch(() => [])]);
  const ids = [...new Set([...pending, ...fixed, ...rechecks].map(p => p.id))].slice(0, 40);
  if (!ids.length) return 0;
  const { data } = await db.from("review_sheets").select("story_id,hash,id").in("story_id", ids).order("id", { ascending: false }).limit(400);
  const had = new Map<string, string>(); for (const x of data ?? []) if (!had.has(x.story_id)) had.set(x.story_id, x.hash);
  const rows: { story_id: string; hash: string; sheet: never }[] = [];
  for (const id of ids) {
    if (Date.now() > deadline) break;
    const sheet = await sheetOf(id, r).catch(() => null);
    if (!sheet) continue;
    const hash = fnv(JSON.stringify(sheet));
    if (had.get(id) !== hash) rows.push({ story_id: id, hash, sheet: sheet as never });
  }
  if (!rows.length) return 0;
  const { error } = await db.from("review_sheets").insert(rows);
  if (error) { console.error("review sheets insert failed", error.code); return 0; }
  return rows.length;
}

export type ReviewPassRun = { ran: boolean; why: string; items: string[]; ms: number; summary: import("./review").ReviewSummary | null; numbered: number; kept: number; run_id: number | null };
/** One scheduled pass: not when held, when the clock is busy or another pass is open; otherwise the start row (unique five-minute slot,
 *  the chosen stories) before any work, at most two stories, then numbers and kept crops for what was released, then the finish row. */
export async function runReviewPass(db: Admin, o: { now?: () => number; byHand?: boolean } = {}): Promise<ReviewPassRun> {
  const clock = o.now ?? Date.now, t0 = clock();
  const out: ReviewPassRun = { ran: false, why: "", items: [], ms: 0, summary: null, numbered: 0, kept: 0, run_id: null };
  try {
    const busy = rp.reviewBusy(t0);
    if (busy && !o.byHand) { out.why = `not now: ${busy}`; return out; }
    const { isHeld } = await import("./passes.server");
    if (await isHeld(db, "reviews")) { out.why = "reviews are held"; return out; }
    const open = await db.from("job_runs").select("id,at").eq("job", "review-passes").eq("phase", "start").gte("at", new Date(t0 - rp.REVIEW_STALE_MS).toISOString()).order("id", { ascending: false }).limit(3);
    if (open.data?.length) {
      const fin = await db.from("job_runs").select("start_id").eq("phase", "finish").in("start_id", open.data.map(x => x.id));
      const done = new Set((fin.data ?? []).map(x => x.start_id));
      if (open.data.some(x => !done.has(x.id))) { out.why = "another review pass is running"; return out; }
    }
    const [{ reviewIO }, { runDesks }, { startRun }] = await Promise.all([import("./review.server"), import("./review"), import("../jobs/runs.server")]);
    let run: Awaited<ReturnType<typeof startRun>> | null = null;
    const work = runDesks(reviewIO(db, null, clock), {
      deadline: t0 + rp.REVIEW_WORK_MS, limit: rp.REVIEW_ITEMS_MAX, waitOnTime: true,
      onStart: async ids => {
        out.items = ids;
        run = await startRun("review-passes", { db, slot: rp.reviewSlot(t0), items: ids, note: ids.length ? `${ids.length} stories` : "nothing waiting" });
        out.run_id = run.id;
        return !run.slotTaken && run.id != null;
      },
    });
    // The pass's own limit: the work stops at its deadline; this only makes sure the finish row is written in time.
    const summary = await Promise.race([work, new Promise<null>(res => setTimeout(() => res(null), rp.REVIEW_PASS_MS - 4000 - (clock() - t0)))]);
    out.summary = summary; out.ran = !!run && !(run as { slotTaken?: boolean }).slotTaken;
    if (summary?.released.length && rp.REVIEW_PASS_MS - (clock() - t0) > 6000) {
      const b = await import("../stories/build.server");
      out.numbered = await b.assignStoryNumbers(db as never, { sinceDays: b.NUMBER_LOOKBACK_DAYS }).catch(() => 0);
      out.kept = await (await import("../stories/kept-crops.server")).keepStoryCrops(db as never).catch(() => 0);
    }
    out.ms = clock() - t0;
    const s = summary;
    out.why = !s ? "the pass hit its time limit" : !out.items.length ? "nothing waiting" : [`${s.checked} checked`, s.pictures ? `${s.pictures.checked} pictures` : null, s.held.length ? `${s.held.length} held` : null, s.released.length ? `${s.released.length} released` : null, s.waiting?.length ? `${s.waiting.length} wait` : null, s.chief !== "none" ? `chief: ${s.chief}` : null, s.errors.length ? `${s.errors.length} errors` : null].filter(Boolean).join(", ");
    const r = run as Awaited<ReturnType<typeof startRun>> | null;
    if (r && !r.slotTaken) await r.finish(!!s && !s.errors.length, out.why, s ? { held: s.held, released: s.released, passed: s.passed, waiting: s.waiting ?? [], lead: s.lead, chief: s.chief, pictures: s.pictures ?? null, errors: s.errors.slice(0, 6) } : null);
    else if (!out.why) out.why = "another pass took this slot";
  } catch (e) { out.why = `failed: ${e instanceof Error ? e.message.slice(0, 120) : "error"}`; }
  return out;
}
