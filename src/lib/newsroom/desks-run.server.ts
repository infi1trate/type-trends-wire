// N3 · the data, engineering and design review desks' scheduled work, after the story build when time is left. N4b: the news desk runs
// from the wire ingest's own job (wire-ingest.server.ts) and the share-image and study-chart checks run in their own scheduled passes
// (passes.server.ts), so neither is here. What stays, each behind its once-a-day or once-a-week record, written BEFORE the work starts
// (a run that is cut off is not retried by the next job): the data desk's daily checks, the backtest (daily), the data desk's proposal
// (Mondays, once a week), the engineering health run (daily) and the design review of a complete weekly run (one pass a day until every
// page has its answer). A held job (job_hold) does not start. Each step is skipped when too little time is left; none ever fails the job.
import type { Admin } from "./review.server";
const dayStart = (now: number) => { const d = new Date(now); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };
const ACTOR = { checks: "data", backtest: "data", proposal: "data", health: "engineering", "design review": "design review" } as const;
type Job = keyof typeof ACTOR;

export async function runDeskJobs(deadline: number): Promise<Record<string, string>> {
  const out: Record<string, string> = {}, left = () => deadline - Date.now(), now = Date.now();
  try {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const [{ deskDoor }, { heldJobs }] = await Promise.all([import("../stories/desk.server"), import("./passes.server")]);
    const held = new Set((await heldJobs(db, now).catch(() => [])).map(h => h.job));
    const ranSince = async (subject: string, since: string) => { const { count, error } = await db.from("desk_log").select("id", { count: "exact", head: true }).in("actor", ["data", "graphics", "engineering", "design review", "owner"]).eq("action", "data_run").eq("subject_id", subject).gte("at", since); if (error) throw new Error("desk_log_read_failed"); return (count ?? 0) > 0; };
    /** The once-a-day (or once-a-week) record, written before the work. False when it already exists or cannot be written. */
    const begin = async (job: Job, since: string, ref?: string): Promise<boolean> => {
      if (held.has(job)) { out[job] = "held"; return false; }
      if (await ranSince(ref ?? job, since)) { out[job] = "already started"; return false; }
      const r = await deskDoor(ACTOR[job], { action: "data_run", run: job, ...(ref ? { ref } : {}), summary: `Started at ${new Date().toISOString().slice(11, 16)} UTC; the result follows in its own row (none means it was cut off).` });
      return r.status < 300;
    };
    const today = dayStart(now);
    if (left() > 25_000 && await begin("checks", today)) { const r = await (await import("./datadesk.server")).runDataChecks(db, { write: true, force: true }); out["checks"] = r.why || (r.errors[0] ?? "ok"); }
    if (left() > 15_000 && await begin("backtest", today)) { const b = await (await import("./datadesk.server")).runBacktest(db, { write: true }).catch(e => ({ scored: false as const, why: e instanceof Error ? e.message : "error", runs: 0 })); out["backtest"] = b.scored ? `scored ${b.calls}` : b.why; }
    if (left() > 25_000 && new Date(now).getUTCDay() === 1 && await begin("proposal", new Date(now - 7 * 864e5 + 3600_000).toISOString())) { const p = await (await import("./datadesk.server")).runProposal(db); out["proposal"] = p.why; }
    if (left() > 15_000 && await begin("health", today)) { const h = await (await import("./engineering.server")).runHealth(db, { write: true, force: true }); out["health"] = h.why || (h.errors[0] ?? "ok"); }
    if (left() > 35_000 && !held.has("design review")) {
      const r = await (await import("./design-review.server")).runDesignReview(db, { deadline: deadline - 5000, gate: run => begin("design review", today, `design review:${run}:${today.slice(0, 10)}`) });
      out["design review"] = r.why || (r.errors[0] ?? "ok");
    }
  } catch (e) { out["error"] = e instanceof Error ? e.message.slice(0, 80) : "error"; }
  return out;
}
