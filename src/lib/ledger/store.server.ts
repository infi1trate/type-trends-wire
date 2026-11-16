// Ledger writes after a stored forecast (service role). Records the run's calls (first call stands), then resolves open calls.
// Never imported by the client graph; loaded dynamically from the weekly forecast job and the backfill script.
import { buildCall, firstStands, resolveCall, selectCalls, callKey, type BriefCitations, type CallRecord, type LedgerRow, type QuarterPt, type StoredCall } from "./ledger";
type Db = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
const COLS = "dimension,value,scope,status,stage,current_share,momentum,next_wave_score,quarters:evidence->quarters,proj_q1,proj_q1_lo,proj_q1_hi";
async function pages<T>(f: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, size = 500) {
  const out: T[] = [];
  for (let from = 0; ; from += size) { const { data, error } = await f(from, from + size - 1); if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < size) break; }
  return out;
}
const runRows = (db: Db, runId: number) => pages<LedgerRow>((f, t) => db.from("forecasts").select(COLS).eq("run_id", runId).order("scope").order("dimension").order("value").range(f, t) as never);

/** Record one stored ok run's calls. Returns how many new rows were written (0 on a rerun in the same week). */
export async function recordRun(db: Db, runId: number, opts: { backfilled: boolean }) {
  const run = await db.from("forecast_runs").select("id,status,computed_at,data_cutoff_quarter").eq("id", runId).maybeSingle();
  if (run.error) throw run.error;
  if (!run.data || run.data.status !== "ok") return { run_id: runId, selected: 0, written: 0 };
  const [brief, alerts, rows] = await Promise.all([
    db.from("weekly_briefs").select("brief").eq("run_id", runId).order("week").limit(1).maybeSingle(),
    db.from("wire_items").select("ref,url").eq("source_kind", "alert").ilike("url", `%alert=${runId}-%`).limit(50),
    runRows(db, runId),
  ]);
  if (brief.error || alerts.error) throw brief.error ?? alerts.error;
  const sel = selectCalls({ brief: (brief.data?.brief ?? null) as unknown as BriefCitations, alerts: alerts.data ?? [], rows });
  const byKey = new Map(rows.map(r => [`${r.dimension}:${r.value}|${r.scope}`, r]));
  const calls = sel.map(s => buildCall(s, byKey.get(`${s.trait}|${s.scope}`), { run_id: runId, made_at: run.data!.computed_at, data_through: run.data!.data_cutoff_quarter, backfilled: opts.backfilled }));
  const weeks = [...new Set(calls.map(c => c.week))];
  const existing = weeks.length ? await pages<{ week: string; trait: string; scope: string }>((f, t) => db.from("forecast_calls").select("week,trait,scope").in("week", weeks).order("id").range(f, t) as never) : [];
  const fresh = firstStands(existing.map(callKey), calls);
  // The unique (week, trait, scope) key is the real guard: ignoreDuplicates leaves the first stored call untouched.
  for (let i = 0; i < fresh.length; i += 200) { const ins = await db.from("forecast_calls").upsert(fresh.slice(i, i + 200) as never, { onConflict: "week,trait,scope", ignoreDuplicates: true }); if (ins.error) throw ins.error; }
  return { run_id: runId, week: weeks[0] ?? null, selected: sel.length, written: fresh.length };
}

/** Resolve every open call whose target quarter is complete in the newest stored run. */
export async function resolveOpen(db: Db, now = new Date()) {
  const latest = await db.from("forecast_runs").select("id,data_cutoff_quarter").eq("status", "ok").order("id", { ascending: false }).limit(1).maybeSingle();
  if (latest.error) throw latest.error;
  if (!latest.data) return { checked: 0, resolved: 0 };
  const open = await pages<StoredCall>((f, t) => db.from("forecast_calls").select("*").is("outcome", null).order("id").range(f, t) as never);
  if (!open.length) return { checked: 0, resolved: 0 };
  const rows = await runRows(db, latest.data.id), byKey = new Map(rows.map(r => [`${r.dimension}:${r.value}|${r.scope}`, r]));
  let resolved = 0;
  for (const c of open) {
    const row = byKey.get(`${c.trait}|${c.scope}`), point: QuarterPt | undefined = row?.quarters?.find(p => p.q === c.target_quarter);
    const r = resolveCall(c, { now, cutoff: latest.data.data_cutoff_quarter, tracked: !!row, point });
    if (!r) continue;
    const up = await db.from("forecast_calls").update({ ...r, resolved_at: now.toISOString() }).eq("id", c.id).is("outcome", null);
    if (up.error) throw up.error;
    resolved++;
  }
  return { checked: open.length, resolved };
}

/** Weekly step: record this run, then resolve. Called through nonFatal() so it can never fail the run. */
export async function ledgerStep(runId: number) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const recorded = await recordRun(db, runId, { backfilled: false });
  const resolution = await resolveOpen(db);
  return { ok: true as const, ...recorded, ...resolution };
}

/** One-time backfill over the stored ok runs that still exist (oldest first, so the first call of each week stands). */
export async function backfillLedger() {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const runs = await db.from("forecast_runs").select("id").eq("status", "ok").order("id");
  if (runs.error) throw runs.error;
  const out = [];
  for (const r of runs.data ?? []) out.push(await recordRun(db, r.id, { backfilled: true }));
  return { runs: out, resolution: await resolveOpen(db) };
}
export type { CallRecord };
