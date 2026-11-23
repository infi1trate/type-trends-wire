// N3 · the data, engineering and design review desks' scheduled work, after the story build when time is left. N4b: the news desk runs
// from the wire ingest's own job (wire-ingest.server.ts) and the share-image and study-chart checks run in their own scheduled passes
// (passes.server.ts), so neither is here. What stays, each behind its once-a-day or once-a-week record, written BEFORE the work starts
// (a run that is cut off is not retried by the next job): the data desk's daily checks, the backtest (daily), the data desk's proposal
// (Mondays, once a week), the engineering health run (daily) and the design review of a complete weekly run (one pass a day until every
// page has its answer). A held job (job_hold) does not start. Each step is skipped when too little time is left; none ever fails the job.
import type { Admin } from "./review.server";
const dayStart = (now: number) => { const d = new Date(now); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };
const ACTOR = { checks: "data", backtest: "data", proposal: "data", health: "engineering", "design review": "design review", package: "publisher", drafts: "publisher", candidates: "scout" } as const;
type Job = keyof typeof ACTOR;

export async function runDeskJobs(deadline: number): Promise<Record<string, string>> {
  const out: Record<string, string> = {}, left = () => deadline - Date.now(), now = Date.now();
  // N4c · the job tail's desk work has its own run row; the health run has one of its own inside it.
  const { startRun, withRun } = await import("../jobs/runs.server");
  const run = await startRun("desk-jobs");
  try {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const [{ deskDoor }, { heldJobs }] = await Promise.all([import("../stories/desk.server"), import("./passes.server")]);
    const held = new Set((await heldJobs(db, now).catch(() => [])).map(h => h.job));
    const ranSince = async (subject: string, since: string) => { const { count, error } = await db.from("desk_log").select("id", { count: "exact", head: true }).in("actor", ["data", "graphics", "engineering", "design review", "publisher", "scout", "owner"]).eq("action", "data_run").eq("subject_id", subject).gte("at", since); if (error) throw new Error("desk_log_read_failed"); return (count ?? 0) > 0; };
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
    if (left() > 15_000 && await begin("health", today)) { const h = await withRun("health", async () => (await import("./engineering.server")).runHealth(db, { write: true, force: true }), x => ({ ok: !x.errors.length, note: x.why || x.errors[0] || "ok" })); out["health"] = h.why || (h.errors[0] ?? "ok"); }
    // N5 · the publisher (Mondays, after the Digest's week closes): the package check on the newest issue, then the drafts call only
    // after that issue's check passed (a later job may make it); the scout's candidates call (Mondays, once a week).
    const weekAgo = new Date(now - 7 * 864e5 + 3600_000).toISOString(), monday = new Date(now).getUTCDay() === 1;
    if (monday && left() > 20_000 && await begin("package", weekAgo)) {
      const r = await (await import("./publisher.server")).runPackageCheck(db, { signal: AbortSignal.timeout(Math.max(5000, left() - 8000)) }).catch(e => ({ why: e instanceof Error ? e.message : "error", row: null, week: null, pass: false, items: [] as { ok: boolean }[] }));
      out["package"] = r.why;
      await deskDoor("publisher", { action: "data_run", run: "package", ...(r.week ? { ref: `package:${r.week}` } : {}), summary: `Package check ${r.week ?? ""}: ${r.why}${r.row ? ` (row ${r.row})` : ""}.`.slice(0, 600), counts: { items: r.items.length, failed: r.items.filter(x => !x.ok).length } }).catch(() => null);
    }
    // D1c · the publisher can try again: the newest issue's failed check runs again (every six hours at most, four times an issue);
    // a cut-off re-check stores nothing and counts for nothing.
    if (left() > 8_000 && !held.has("package")) {
      const r = await (await import("./publisher.server")).runPackageRecheck(db, { signal: AbortSignal.timeout(Math.max(4000, left() - 500)) }).catch(e => ({ ran: false, why: e instanceof Error ? e.message : "error", run: undefined, closed: null }));
      if (r.ran && r.run) {
        out["package recheck"] = r.why;
        await deskDoor("publisher", { action: "data_run", run: "package", ...(r.run.week ? { ref: `package:${r.run.week}:recheck` } : {}), summary: `Package re-check ${r.run.week ?? ""}: ${r.run.why}${r.run.row ? ` (row ${r.run.row})` : ""}${r.closed ? `; closed queue item ${r.closed}` : ""}.`.slice(0, 600), counts: { items: r.run.items.length, failed: r.run.items.filter(x => !x.ok).length } }).catch(() => null);
      }
    }
    // The drafts call follows the newest issue's passing check within the week (D1c: also when a re-check passed after Monday).
    if (left() > 30_000 && !held.has("drafts")) {
      const { data: chk } = await db.from("package_checks").select("id,week,pass").eq("test", false).gte("at", weekAgo).order("id", { ascending: false }).limit(1);
      const c = chk?.[0];
      if (c?.pass && await begin("drafts", weekAgo)) { const r = await (await import("./publisher.server")).runDrafts(db, { week: c.week, checkId: c.id, signal: AbortSignal.timeout(Math.max(5000, left() - 5000)) }); out["drafts"] = r.why; await deskDoor("publisher", { action: "data_run", run: "drafts", ref: `drafts:${c.week}`, summary: `Drafts for ${c.week}: ${r.why}.`.slice(0, 600), counts: { kept: r.kept.length, dropped: r.dropped.length } }).catch(() => null); }
    }
    if (monday && left() > 35_000 && await begin("candidates", weekAgo)) {
      const r = await (await import("./scout.server")).runCandidates(db, { signal: AbortSignal.timeout(Math.max(5000, left() - 5000)) });
      out["candidates"] = r.why;
      await deskDoor("scout", { action: "data_run", run: "candidates", summary: `Brand candidates: ${r.why} (${r.returned} returned from ${r.items} items).`.slice(0, 600), counts: { returned: r.returned, kept: r.kept.length, dropped: r.dropped.length } }).catch(() => null);
    }
    if (left() > 35_000 && !held.has("design review")) {
      const r = await (await import("./design-review.server")).runDesignReview(db, { deadline: deadline - 5000, gate: run => begin("design review", today, `design review:${run}:${today.slice(0, 10)}`) });
      out["design review"] = r.why || (r.errors[0] ?? "ok");
    }
  } catch (e) { out["error"] = e instanceof Error ? e.message.slice(0, 80) : "error"; }
  await run.finish(!out["error"], Object.entries(out).map(([k, v]) => `${k}: ${v}`).join("; ") || "nothing due");
  return out;
}
