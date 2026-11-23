// N3 · the data, engineering and design review desks' scheduled work, after the story build when time is left. N4b: the news desk runs
// from the wire ingest's own job (wire-ingest.server.ts) and the share-image and study-chart checks run in their own scheduled passes
// (passes.server.ts), so neither is here. What stays, each behind its once-a-day or once-a-week record, written BEFORE the work starts
// (a run that is cut off is not retried by the next job): the data desk's daily checks, the backtest (daily), the data desk's proposal
// (Mondays, once a week), the engineering health run (daily) and the design review of a complete weekly run (one pass a day until every
// page has its answer). A held job (job_hold) does not start. Each step is skipped when too little time is left; none ever fails the job.
// PH1 · a failed or cut-off daily job, and a weekly model-call job that failed before its call, may try again under retries.ts.
import type { Admin } from "./review.server";
const dayStart = (now: number) => { const d = new Date(now); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };
const ACTOR = { checks: "data", backtest: "data", proposal: "data", health: "engineering", "design review": "design review", package: "publisher", drafts: "publisher", candidates: "scout" } as const;
type Job = keyof typeof ACTOR;
/** PH1 · once a job is not due to try again, this instance reads its attempts again only after this long (keeps the tail's reads few). */
const AGAIN_READ_EVERY_MS = 30 * 60_000;
const againAfter = new Map<string, number>();

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
    /** The once-a-day (or once-a-week) record, written before the work. False when it already exists or cannot be written.
     *  PH1 · `retry` writes a try-again start (`<job>:retry`, decided by retries.ts) instead of the first run's. */
    const begin = async (job: Job, since: string, ref?: string, retry?: number): Promise<boolean> => {
      if (held.has(job)) { out[job] = "held"; return false; }
      if (retry == null && await ranSince(ref ?? job, since)) { out[job] = "already started"; return false; }
      const r = await deskDoor(ACTOR[job], { action: "data_run", run: job, ...(retry != null ? { ref: `${job}:retry` } : ref ? { ref } : {}), summary: `Started at ${new Date().toISOString().slice(11, 16)} UTC${retry != null ? ` (try again ${retry})` : ""}; the result follows in its own row (none means it was cut off).` });
      return r.status < 300;
    };
    const today = dayStart(now);
    const weekAgo = new Date(now - 7 * 864e5 + 3600_000).toISOString(), monday = new Date(now).getUTCDay() === 1;
    // PH1 Part 5 · each retryable job writes an outcome row after its work (failed or not, and whether a model call was made), and a
    // job already started in its period may try again under retries.ts. A weekly job that may not try again says so on the desk once.
    const rt = await import("./retries");
    const outcome = (job: Job, failed: boolean, called: boolean, why: string) => deskDoor(ACTOR[job], { action: "data_run", run: job, ref: `${job}:outcome`, summary: `${failed ? "Failed" : "Done"}: ${why}`.slice(0, 600), counts: { failed: failed ? 1 : 0, called: called ? 1 : 0 } }).catch(() => null);
    const again = async (job: Job, kind: "daily" | "weekly", since: string): Promise<number | null> => {
      if (held.has(job) || (againAfter.get(`${job}|${since}`) ?? 0) > Date.now()) return null;
      const { data, error } = await db.from("desk_log").select("at,subject_id,reason,detail").eq("action", "data_run").in("subject_id", [job, `${job}:retry`, `${job}:outcome`]).gte("at", since).order("id").limit(50);
      if (error) return null;
      let calls: string[] = [];
      if (kind === "weekly") {
        const firstAt = (data ?? [])[0]?.at ?? since;
        const q = job === "proposal" ? db.from("desk_calls").select("at").eq("desk", "data").eq("purpose", "proposal") : db.from("desk_calls_weekly").select("at").eq("desk", "scout").eq("purpose", "candidates");
        const c = await q.gte("at", firstAt).limit(20);
        if (c.error) return null; // unreadable: no proof that no call was made, so no retry
        calls = (c.data ?? []).map(x => x.at as string);
      }
      const v = rt.retryDue(kind, rt.attemptsOf(job, (data ?? []) as never), Date.now(), { callSince: iso => calls.some(a => a >= iso) });
      if (v.due) return v.retry;
      againAfter.set(`${job}|${since}`, Date.now() + AGAIN_READ_EVERY_MS);
      out[job] = `${out[job] ?? "already started"}; ${v.why}`;
      if (!v.due && v.waitsForNextWeek && !(await ranSince(`${job}:waits`, since).catch(() => true)))
        await deskDoor(ACTOR[job], { action: "data_run", run: job, ref: `${job}:waits`, summary: `Not tried again this week: ${v.why}.`.slice(0, 600) }).catch(() => null);
      return null;
    };
    /** A daily job: the first run, else a try again when due; its outcome row follows the work. */
    const daily = async (job: "checks" | "backtest" | "health", need: number, work: () => Promise<{ failed: boolean; why: string }>) => {
      if (left() <= need) return;
      let retry: number | undefined;
      if (!await begin(job, today)) {
        if (out[job] !== "already started") return;
        const n = await again(job, "daily", today); if (n == null || left() <= need || !await begin(job, today, undefined, n)) return;
        retry = n;
      }
      const r = await work().catch(e => ({ failed: true, why: e instanceof Error ? e.message.slice(0, 120) : "error" }));
      out[job] = `${retry != null ? `try again ${retry}: ` : ""}${r.why}`;
      await outcome(job, r.failed, false, r.why);
    };
    await daily("checks", 25_000, async () => { const r = await (await import("./datadesk.server")).runDataChecks(db, { write: true, force: true }); return { failed: r.errors.length > 0, why: r.why || (r.errors[0] ?? "ok") }; });
    await daily("backtest", 15_000, async () => { const b = await (await import("./datadesk.server")).runBacktest(db, { write: true }); return { failed: false, why: b.scored ? `scored ${b.calls}` : b.why }; });
    /** A weekly job with a model call: the first run on Mondays, else its one more try when due (before any call only). */
    const weekly = async (job: "proposal" | "candidates", need: number, work: (mark: { called: boolean }) => Promise<{ failed: boolean; why: string }>) => {
      if (left() <= need) return;
      let retry: number | undefined;
      if (!(monday && await begin(job, weekAgo))) {
        if (monday && out[job] !== "already started") return;
        if (!monday && !await ranSince(job, weekAgo).catch(() => false)) return;
        const n = await again(job, "weekly", weekAgo); if (n == null || left() <= need || !await begin(job, weekAgo, undefined, n)) return;
        retry = n;
      }
      const mark = { called: false };
      const r = await work(mark).catch(e => ({ failed: true, why: e instanceof Error ? e.message.slice(0, 120) : "error" }));
      out[job] = `${retry != null ? `try again ${retry}: ` : ""}${r.why}`;
      await outcome(job, r.failed, mark.called, r.why);
    };
    await weekly("proposal", 25_000, async mark => { const p = await (await import("./datadesk.server")).runProposal(db, { mark }); return { failed: p.why === "call failed" || (!p.ran && !p.why.startsWith("already")), why: p.why }; });
    await daily("health", 15_000, async () => { const h = await withRun("health", async () => (await import("./engineering.server")).runHealth(db, { write: true, force: true }), x => ({ ok: !x.errors.length, note: x.why || x.errors[0] || "ok" })); return { failed: h.errors.length > 0, why: h.why || (h.errors[0] ?? "ok") }; });
    // N5 · the publisher (Mondays, after the Digest's week closes): the package check on the newest issue, then the drafts call only
    // after that issue's check passed (a later job may make it); the scout's candidates call (Mondays, once a week).
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
    // The drafts call follows the newest issue's passing check within the week (D1c: also when a re-check passed after Monday). PH1: the
    // same call is made by the review pass when it has the room (publisher.server.ts runDraftsIfDue), whichever comes first.
    if (left() > 30_000 && !held.has("drafts")) {
      const r = await (await import("./publisher.server")).runDraftsIfDue(db, { now, msLeft: left() - 5000 });
      if (r) out["drafts"] = r;
    }
    await weekly("candidates", 35_000, async mark => {
      const r = await (await import("./scout.server")).runCandidates(db, { signal: AbortSignal.timeout(Math.max(5000, left() - 5000)), mark });
      await deskDoor("scout", { action: "data_run", run: "candidates", summary: `Brand candidates: ${r.why} (${r.returned} returned from ${r.items} items).`.slice(0, 600), counts: { returned: r.returned, kept: r.kept.length, dropped: r.dropped.length } }).catch(() => null);
      return { failed: !r.ran || r.why.startsWith("call failed"), why: r.why };
    });
    if (left() > 35_000 && !held.has("design review")) {
      const r = await (await import("./design-review.server")).runDesignReview(db, { deadline: deadline - 5000, gate: run => begin("design review", today, `design review:${run}:${today.slice(0, 10)}`) });
      out["design review"] = r.why || (r.errors[0] ?? "ok");
    }
  } catch (e) { out["error"] = e instanceof Error ? e.message.slice(0, 80) : "error"; }
  await run.finish(!out["error"], Object.entries(out).map(([k, v]) => `${k}: ${v}`).join("; ") || "nothing due");
  return out;
}
