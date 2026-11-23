// L2 · the wire follow-ups pass's I/O (rules in wire-followups.ts): the story build (its desk-job tail included) and the records sweep,
// between a start and a finish row in job_runs, one pass at a time. Service role only. Never throws.
// T1 · the start row is written before the answer; the work runs after it (handed to the host's waitUntil), so the caller's five-second
// limit no longer cuts the pass off. Without waitUntil (the dev server, tests) the work runs before the answer, as before.
import * as wf from "./wire-followups";
type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

export type StepResult = { step: wf.FollowupStep; ms: number; note: string | null; written?: Record<string, number> };
export type WireFollowupsRun = { ran: boolean; why: string; run_id: number | null; first: wf.FollowupStep | null; steps: StepResult[]; ms: number; mode?: "background" | "inline" };
type Deps = {
  build: (job: string, t0: number, limitMs: number) => Promise<string | null>;
  sweep: (job: string, start: number, limitMs: number) => Promise<{ written: string[]; skipped: number; timed_out: boolean; errors: string[] } | null>;
};
const DEPS: Deps = {
  build: async (job, t0, limitMs) => (await import("../stories/build.server")).afterJob(job, t0, { limitMs }),
  sweep: async (job, start, limitMs) => (await import("../records/refresh.server")).refreshAfterJob(job, start, { limitMs }),
};

/** Checks that no pass is running, writes the start row and returns the work still to do (null when the pass does not run). */
export async function beginWireFollowups(db: Admin, o: { now?: () => number; deps?: Partial<Deps> } = {}): Promise<{ out: WireFollowupsRun; work: Promise<WireFollowupsRun> | null }> {
  const clock = o.now ?? Date.now, t0 = clock(), deps = { ...DEPS, ...o.deps };
  const out: WireFollowupsRun = { ran: false, why: "", run_id: null, first: null, steps: [], ms: 0 };
  try {
    // A run still going (a start row in the last two minutes with no finish row) is never doubled; the slot is unique besides.
    const open = await db.from("job_runs").select("id").eq("job", "wire-followups").eq("phase", "start").gte("at", new Date(t0 - wf.WIRE_FOLLOWUPS_STALE_MS).toISOString()).order("id", { ascending: false }).limit(3);
    if (open.data?.length) {
      const fin = await db.from("job_runs").select("start_id").eq("phase", "finish").in("start_id", open.data.map(x => x.id));
      const done = new Set((fin.data ?? []).map(x => x.start_id));
      if (open.data.some(x => !done.has(x.id))) { out.why = "another follow-ups pass is running"; return { out, work: null }; }
    }
    const order = wf.stepOrder(t0);
    const { startRun } = await import("./runs.server");
    const run = await startRun("wire-followups", { db, slot: wf.wireFollowupsSlot(t0), note: order.join(", ") });
    if (run.slotTaken || run.id == null) { out.why = run.slotTaken ? "another pass took this slot" : "no start row"; return { out, work: null }; }
    out.ran = true; out.run_id = run.id; out.first = order[0]!; out.why = "started";
    const passEnd = t0 + wf.PASS_END_MS;
    const work = (async () => {
      const r: WireFollowupsRun = { ...out, steps: [] };
      const steps = (async () => {
        for (const step of order) {
          const t = clock();
          if (step === "story build") {
            const note = await deps.build("wire", t0, wf.PASS_END_MS);
            r.steps.push({ step, ms: clock() - t, note: note ? note.replace(/^wire · /, "") : "skipped: too little time left" });
          } else {
            // First or second, the sweep has whatever is left before the pass's end.
            const s = await deps.sweep("wire", t, wf.sweepLimitMs(t0, t));
            const by = s ? wf.writtenByKind(s.written) : {};
            r.steps.push({ step, ms: clock() - t, note: s ? `${wf.writtenLine(by)}${s.timed_out ? ", rest next pass" : ""}${s.errors.length ? `, ${s.errors.length} errors` : ""}` : "skipped: too little time left", written: by });
          }
        }
      })();
      try {
        // A step that overruns its own deadline is left behind at the pass's end, so the finish row is still written in the window.
        let stop: ReturnType<typeof setTimeout> | undefined;
        const inTime = await Promise.race([steps.then(() => true), new Promise<false>(res => { stop = setTimeout(() => res(false), Math.max(0, passEnd + wf.FINISH_GRACE_MS - clock())); })]).finally(() => clearTimeout(stop));
        steps.catch(() => {});
        r.ms = clock() - t0; r.why = inTime ? wf.followupsNote(r.steps) : `cut off at the pass end · ${wf.followupsNote(r.steps)}`;
        await run.finish(inTime, r.why, { first: r.first, steps: r.steps, cut_off: !inTime });
      } catch (e) {
        r.ms = clock() - t0; r.why = `failed: ${e instanceof Error ? e.message.slice(0, 120) : "error"}`;
        await run.finish(false, r.why, { first: r.first, steps: r.steps });
      }
      return r;
    })();
    return { out, work };
  } catch (e) { out.why = `failed: ${e instanceof Error ? e.message.slice(0, 120) : "error"}`; return { out, work: null }; }
}

/** The whole pass, waited on (tests and the inline fallback). */
export async function runWireFollowups(db: Admin, o: { now?: () => number; deps?: Partial<Deps> } = {}): Promise<WireFollowupsRun> {
  const { out, work } = await beginWireFollowups(db, o);
  return work ? { ...(await work), mode: "inline" } : out;
}

export type JobContext = { waitUntil?: (p: Promise<unknown>) => void };
/** The route: authenticate, check the body, write the start row, answer with the run id; the work runs after the answer when the host
 *  offers waitUntil, otherwise before it. */
export async function handleWireFollowups(request: Request, ctx: JobContext = {}): Promise<Response> {
  const { authenticateCronRequest } = await import("@/integrations/supabase/cron-auth");
  const authFailure = await authenticateCronRequest(request);
  if (authFailure) return authFailure;
  let body: unknown = null; try { body = await request.json(); } catch { /* invalid */ }
  if (!body || typeof body !== "object" || (body as { kind?: unknown }).kind !== "wire-followups") return Response.json({ error: "Expected {\"kind\":\"wire-followups\"}" }, { status: 400 });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const headers = { "cache-control": "no-store" };
  const { out, work } = await beginWireFollowups(supabaseAdmin);
  if (!work) return Response.json({ ran: out.ran, why: out.why, run_id: out.run_id }, { headers });
  if (typeof ctx.waitUntil === "function") {
    try {
      ctx.waitUntil(work.catch(() => null));
      return Response.json({ ran: true, why: "started; finishing after this answer", run_id: out.run_id, first: out.first, mode: "background" }, { headers });
    } catch { /* fall back to inline */ }
  }
  const r = await work;
  return Response.json({ ran: r.ran, why: r.why, run_id: r.run_id, first: r.first, ms: r.ms, mode: "inline" }, { headers });
}
