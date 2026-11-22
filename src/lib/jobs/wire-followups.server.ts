// L2 · the wire follow-ups pass's I/O (rules in wire-followups.ts): the story build (its desk-job tail included) and the records sweep,
// between a start and a finish row in job_runs, one pass at a time. Service role only. Never throws.
import * as wf from "./wire-followups";
type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

export type WireFollowupsRun = { ran: boolean; why: string; steps: { step: string; ms: number }[]; ms: number };
export async function runWireFollowups(db: Admin, o: { now?: () => number } = {}): Promise<WireFollowupsRun> {
  const clock = o.now ?? Date.now, t0 = clock();
  const out: WireFollowupsRun = { ran: false, why: "", steps: [], ms: 0 };
  try {
    const open = await db.from("job_runs").select("id").eq("job", "wire-followups").eq("phase", "start").gte("at", new Date(t0 - wf.WIRE_FOLLOWUPS_STALE_MS).toISOString()).order("id", { ascending: false }).limit(3);
    if (open.data?.length) {
      const fin = await db.from("job_runs").select("start_id").eq("phase", "finish").in("start_id", open.data.map(x => x.id));
      const done = new Set((fin.data ?? []).map(x => x.start_id));
      if (open.data.some(x => !done.has(x.id))) { out.why = "another follow-ups pass is running"; return out; }
    }
    const { startRun } = await import("./runs.server");
    const run = await startRun("wire-followups", { db, slot: wf.wireFollowupsSlot(t0), note: "story build, records sweep" });
    if (run.slotTaken || run.id == null) { out.why = run.slotTaken ? "another pass took this slot" : "no start row"; return out; }
    out.ran = true;
    let t = clock();
    await (await import("../stories/build.server")).afterJob("wire", t0);
    out.steps.push({ step: "story build", ms: clock() - t });
    t = clock();
    // The sweep keeps the time it had in the wire job (whatever the build left, there 5 to 24 s): its own budget from its start, cut
    // off so the whole pass ends by PASS_END_MS (the build no longer shares its limit with the ingest).
    await (await import("../records/refresh.server")).refreshAfterJob("wire", t, { limitMs: wf.sweepLimitMs(t0, t) });
    out.steps.push({ step: "records sweep", ms: clock() - t });
    out.ms = clock() - t0; out.why = wf.followupsNote(out.steps);
    await run.finish(true, out.why);
  } catch (e) { out.why = `failed: ${e instanceof Error ? e.message.slice(0, 120) : "error"}`; }
  return out;
}
