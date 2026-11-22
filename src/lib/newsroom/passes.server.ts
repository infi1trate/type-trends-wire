// N4b · the scheduled desk passes' I/O (rules in passes.ts): the job holds read from the desk log, the day's start and finish rows, one
// pass of the share-image or study-chart check (stored records only, five items at most, under 20 seconds), the day's closing record
// through the door, and the bug item when a check stops for the day. Service role only. Never throws.
import type { Admin } from "./review.server";
import * as p from "./passes";

/** The holds in force (job_hold / job_release rows the door recorded in the desk log). */
export async function heldJobs(db: Admin, now = Date.now()): Promise<p.Hold[]> {
  const { data, error } = await db.from("desk_log").select("id,at,actor,action,reason,detail").in("action", ["job_hold", "job_release"]).eq("decision", "done")
    .gte("at", new Date(now - (p.HOLD_MAX_DAYS + 1) * 864e5).toISOString()).order("id").limit(1000);
  if (error) throw new Error("holds_read_failed");
  return p.activeHolds((data ?? []).map(r => { const d = (r.detail ?? {}) as { job?: string; until?: string }; return { id: r.id, at: r.at, actor: r.actor, action: r.action as "job_hold" | "job_release", job: d.job ?? "", until: d.until ?? null, reason: r.reason }; }).filter(r => r.job), now);
}
/** Whether a job is held now (a failed read counts as not held: holds are a switch, not a lock). */
export const isHeld = async (db: Admin, job: p.HoldJob) => (await heldJobs(db).catch(() => [])).some(h => p.holdNames(job).includes(h.job));

export async function dayRows(db: Admin, day: string): Promise<{ starts: p.PassStart[]; ends: p.PassEnd[] }> {
  const s = await db.from("desk_passes").select("id,at,check_name,day,slot,items,plan").eq("day", day).order("id").limit(200);
  if (s.error) throw new Error("passes_read_failed");
  const ids = (s.data ?? []).map(x => x.id);
  const e = ids.length ? await db.from("desk_pass_ends").select("pass_id,at,ok,ms,results,error").in("pass_id", ids) : { data: [], error: null };
  if (e.error) throw new Error("passes_read_failed");
  return {
    starts: (s.data ?? []).map(x => ({ id: x.id, at: x.at, check: x.check_name as p.PassCheck, day: x.day, slot: x.slot, items: (x.items ?? []) as string[], plan: (x.plan ?? null) as string[] | null })),
    ends: (e.data ?? []).map(x => ({ pass_id: x.pass_id, at: x.at, ok: x.ok, ms: x.ms, results: (x.results ?? []) as p.PassResult[], error: x.error })),
  };
}
const closedToday = async (db: Admin, check: p.PassCheck, now: number) => {
  const d = new Date(now); d.setUTCHours(0, 0, 0, 0);
  const { count } = await db.from("desk_log").select("id", { count: "exact", head: true }).in("actor", ["graphics", "engineering", "owner"]).eq("action", "data_run").eq("subject_id", check).gte("at", d.toISOString());
  return (count ?? 0) > 0;
};

export type PassRun = { ran: boolean; why: string; check: p.PassCheck | null; pass: number | null; items: string[]; results: p.PassResult[]; ms: number; rows_written: number; closed: boolean; filed: number | null };
/** Two failed passes: the check stops for the day, a bug item says so (stable key per check and day), and the day's record says why. */
async function stopForDay(db: Admin, c: p.CheckDay, day: string): Promise<number | null> {
  const { deskDoor } = await import("../stories/desk.server");
  const name = c.check === "share" ? "share-image check" : "study chart check";
  const r = await deskDoor("engineering", { action: "queue_add", kind: "bug", expects: "no visible change", key: `pass:${c.check}:${day}`,
    title: `The ${name} stopped for the day after ${c.failedPasses} failed passes`.slice(0, 140),
    why: `On ${day} ${c.failedPasses} passes of the ${name} failed (a start row with no finish row after ${p.PASS_STALE_MS / 60_000} minutes, or a pass that failed). Failing items: ${c.failing.slice(0, 6).map(f => `${f.id} (${f.error})`).join("; ") || "none named"}. It runs again tomorrow.`.slice(0, 600) });
  await deskDoor("graphics", { action: "data_run", run: c.check, summary: `Stopped for today: ${c.failedPasses} failed passes; ${c.done.length} done, ${c.failing.length} failing. A bug item is on the build queue.`.slice(0, 600), counts: { done: c.done.length, failing: c.failing.length, failed_passes: c.failedPasses } });
  return (r.body as { item?: number }).item ?? null;
}
/** The day's closing record for a complete check (the share check also stores its summary row, as before). */
async function closeDay(db: Admin, c: p.CheckDay) {
  const { deskDoor } = await import("../stories/desk.server");
  if (c.check === "share") {
    const { targetOf } = await import("./graphics.server");
    const failures = c.failing.map(f => { const t = targetOf(f.id); return { kind: t?.kind ?? "story", id: t?.id ?? f.id, path: t?.path ?? "", error: f.error }; });
    await db.from("share_checks").insert({ checked: (c.plan ?? []).length, rebuilt: 0, failures: failures as never });
    await deskDoor("graphics", { action: "data_run", run: "share", summary: `Share images: ${(c.plan ?? []).length} checked in ${c.passes} passes, ${c.failing.length} failing.`, counts: { checked: (c.plan ?? []).length, rebuilt: 0, failing: c.failing.length, passes: c.passes } });
  } else {
    await deskDoor("graphics", { action: "data_run", run: "chart", summary: `Study charts: ${c.done.length} studies checked in ${c.passes} passes, ${c.failing.length} failing.`, counts: { studies: c.done.length, failing: c.failing.length, passes: c.passes } });
  }
}

/**
 * One scheduled pass. In order: a held check, a check already closed today, a stopped or running check, or a busy clock means no pass;
 * otherwise the first due check (share, then chart) gets one pass of at most five items. The start row is written before any work
 * (its unique slot refuses a second pass in the same ten minutes); the finish row after. Never throws.
 */
export async function runDeskPass(db: Admin, o: { now?: () => number; only?: p.PassCheck; /** proof by hand only: ignore today's closing record */ byHand?: boolean } = {}): Promise<PassRun> {
  const clock = o.now ?? Date.now, t0 = clock(), day = p.dayOf(t0);
  const out: PassRun = { ran: false, why: "", check: null, pass: null, items: [], results: [], ms: 0, rows_written: 0, closed: false, filed: null };
  try {
    const busy = p.busyJob(t0);
    if (busy) { out.why = `not now: ${busy}`; return out; }
    const steps = await db.from("job_steps").select("job,step").eq("status", "running").gt("lease_until", new Date(t0).toISOString()).limit(1);
    if (steps.data?.length) { out.why = `not now: ${steps.data[0]!.job} step ${steps.data[0]!.step} is running`; return out; }
    const held = new Set((await heldJobs(db, t0)).map(h => h.job));
    const rows = await dayRows(db, day);
    const states = p.PASS_CHECKS.map(c => p.checkDay(c, rows.starts, rows.ends, t0));
    if (states.some(s => s.open)) { out.why = "another pass is running"; return out; }
    let pick: p.CheckDay | null = null;
    const notes: string[] = [];
    for (const c of states) {
      if (o.only && c.check !== o.only) continue;
      if (held.has(c.check)) { notes.push(`${c.check} held`); continue; }
      if (!o.byHand && await closedToday(db, c.check, t0)) { notes.push(`${c.check} done for today`); continue; }
      if (c.status === "stopped") { out.filed = await stopForDay(db, c, day); notes.push(`${c.check} stopped for today`); continue; }
      if (c.status === "complete") { await closeDay(db, c); out.closed = true; notes.push(`${c.check} complete`); continue; }
      pick = c; break;
    }
    if (!pick) { out.why = notes.join("; ") || "nothing due"; return out; }
    out.check = pick.check;
    // The day's plan is read once, by its first pass (share: the published story list, the stored Studies home and the closed weeks).
    let plan = pick.plan, items = pick.next;
    const g = await import("./graphics.server");
    if (!plan) {
      plan = pick.check === "share" ? (await g.shareTargets()).map(g.targetKey) : ((await g.storedLiveStudies()) ?? []);
      items = plan.slice(0, p.PASS_ITEMS_MAX);
    }
    out.items = items;
    const ins = await db.from("desk_passes").insert({ check_name: pick.check, day, slot: p.slotOf(t0), items: items as never, plan: (pick.plan ? null : plan) as never }).select("id").single();
    if (ins.error || !ins.data) { out.why = ins.error?.code === "23505" ? "another pass took this ten-minute slot" : "the start row could not be written"; return out; }
    out.pass = ins.data.id; out.ran = true;
    let ok = true, error: string | null = null;
    try {
      if (pick.check === "share") {
        for (const id of items) {
          if (clock() - t0 > p.PASS_START_BY_MS) break;
          const t = g.targetOf(id), s = clock();
          if (!t) { out.results.push({ id, ok: false, done: true, error: "not a share target" }); continue; }
          try { await g.withTimeout(g.buildShareStored(t), p.ITEM_LIMIT_MS, "the image"); out.results.push({ id, ok: true, done: true, error: null, ms: clock() - s }); }
          catch (e) { out.results.push({ id, ok: false, done: true, error: (e instanceof Error ? e.message : "error").slice(0, 120), ms: clock() - s }); }
        }
      } else {
        const bud = await g.chartBudget(db, items, t0);
        let calls = 0;
        const run: import("./graphics.server").ChartRun = { checked: 0, calls: 0, choices: [], proposals: 0, errors: [] };
        const b = { ...bud, fixture: false, callMs: p.CHART_CALL_MS, allowCall: () => calls === 0 && clock() - t0 < p.CHART_CALL_START_BY_MS && (calls++, true) };
        for (const slug of items) {
          if (clock() - t0 > p.PASS_START_BY_MS) break;
          const s = clock();
          const r = await g.withTimeout(g.storedStudy(slug), p.ITEM_LIMIT_MS, "the stored study").catch(e => ({ error: e instanceof Error ? e.message : "error" }));
          if ("error" in r) { out.results.push({ id: slug, ok: false, done: true, error: r.error.slice(0, 120), ms: clock() - s }); continue; }
          const c = await g.chartStudy(db, slug, r.page, b, run);
          out.rows_written += c.written;
          out.results.push({ id: slug, ok: true, done: c.done, error: c.done ? null : "waits for a call in a later pass", ms: clock() - s });
        }
        if (run.errors.length) error = run.errors.join("; ").slice(0, 300);
      }
    } catch (e) { ok = false; error = (e instanceof Error ? e.message : "error").slice(0, 300); }
    out.ms = clock() - t0;
    await db.from("desk_pass_ends").insert({ pass_id: out.pass, ok, ms: out.ms, results: out.results as never, rows_written: out.rows_written, error });
    // The pass that finishes the day closes it; a check whose second pass just failed stops for the day.
    const after = await dayRows(db, day), c = p.checkDay(pick.check, after.starts, after.ends, clock());
    if (c.status === "complete") { await closeDay(db, c); out.closed = true; }
    else if (c.status === "stopped") out.filed = await stopForDay(db, c, day);
    out.why = `${pick.check} pass: ${out.results.filter(r => r.ok && r.done).length} done, ${out.results.filter(r => !r.ok).length} failing, ${items.length - out.results.length} not reached`;
  } catch (e) { out.why = (e instanceof Error ? e.message : "error").slice(0, 120); }
  return out;
}

/** /desk and the memory: today's passes per check, and the schedule. */
export async function passesPanel(db: Admin, now = Date.now()) {
  const rows = await dayRows(db, p.dayOf(now));
  return {
    schedule: p.PASS_SCHEDULE, limits: { items: p.PASS_ITEMS_MAX, slot_min: p.PASS_SLOT_MIN, pass_ms: p.PASS_LIMIT_MS, item_ms: p.ITEM_LIMIT_MS, stale_ms: p.PASS_STALE_MS, fails_stop: p.PASS_FAILS_STOP },
    today: p.PASS_CHECKS.map(c => { const s = p.checkDay(c, rows.starts, rows.ends, now); return { check: c, status: s.status, planned: s.plan?.length ?? 0, done: s.done.length, failing: s.failing, passes: s.passes, failed_passes: s.failedPasses }; }),
  };
}
