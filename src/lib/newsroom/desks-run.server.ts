// N3 · the news, graphics and data desks' scheduled work, after the hourly story build when time is left: the news desk's picks (its
// own gate decides whether to call), then once a UTC day the data desk's checks and the share-image check, the study chart forms, and
// once a week the backtest and the data desk's proposal. N4: once a UTC day the engineering desk's health run (code), and the design
// review desk's weekly pass whenever a complete weekly review run waits (a page per call, picked up by later jobs until every page has
// its answer). Each step is skipped when too little time is left; none ever fails the job.
const dayStart = (now: number) => { const d = new Date(now); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };
export async function runDeskJobs(deadline: number): Promise<Record<string, string>> {
  const out: Record<string, string> = {}, left = () => deadline - Date.now();
  try {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    if (left() > 25_000) { const r = await (await import("./news.server")).runNewsDesk(db, { deadline: deadline - 3000 }); out["news"] = r.why || (r.errors[0] ?? "ok"); }
    const today = dayStart(Date.now());
    const ranToday = async (run: string) => { const { count } = await db.from("desk_log").select("id", { count: "exact", head: true }).in("actor", ["data", "graphics", "engineering", "design review"]).eq("action", "data_run").eq("subject_id", run).gte("at", today); return (count ?? 0) > 0; };
    if (left() > 25_000) { const r = await (await import("./datadesk.server")).runDataChecks(db, { write: true }); out["data"] = r.why || (r.errors[0] ?? "ok"); }
    if (left() > 20_000 && !(await ranToday("share"))) {
      const { shareCheck } = await import("./graphics.server"); const { deskDoor } = await import("../stories/desk.server");
      const s = await shareCheck(db, { deadline: deadline - 12_000 });
      await deskDoor("graphics", { action: "data_run", run: "share", summary: `Share images: ${s.checked} checked, ${s.rebuilt} rebuilt, ${s.failures.length} failing.`, counts: { checked: s.checked, rebuilt: s.rebuilt, failing: s.failures.length } });
      out["share"] = `${s.checked} checked, ${s.failures.length} failing`;
    }
    if (left() > 20_000 && !(await ranToday("chart"))) {
      const r = await (await import("./graphics.server")).chartDesk(db); const { deskDoor } = await import("../stories/desk.server");
      await deskDoor("graphics", { action: "data_run", run: "chart", summary: `Study charts: ${r.checked} figures checked, ${r.choices.length} recorded, ${r.calls} calls.`, counts: { checked: r.checked, recorded: r.choices.length, calls: r.calls } });
      out["chart"] = `${r.choices.length} recorded`;
    }
    if (left() > 15_000) { const b = await (await import("./datadesk.server")).runBacktest(db, { write: true }).catch(e => ({ scored: false as const, why: e instanceof Error ? e.message : "error", runs: 0 })); out["backtest"] = b.scored ? `scored ${b.calls}` : b.why; }
    if (left() > 25_000 && new Date().getUTCDay() === 1) { const p = await (await import("./datadesk.server")).runProposal(db); out["proposal"] = p.why; }
    if (left() > 15_000 && !(await ranToday("health"))) { const h = await (await import("./engineering.server")).runHealth(db, { write: true }); out["health"] = h.why || (h.errors[0] ?? "ok"); }
    if (left() > 35_000) { const r = await (await import("./design-review.server")).runDesignReview(db, { deadline: deadline - 5000 }); out["design"] = r.why || (r.errors[0] ?? "ok"); }
  } catch (e) { out["error"] = e instanceof Error ? e.message.slice(0, 80) : "error"; }
  return out;
}
