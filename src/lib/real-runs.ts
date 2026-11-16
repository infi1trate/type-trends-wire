// Reads the real (non-dev) forecast runs and a run's library-wide stages with whichever public client the caller has
// (browser client or the anonymous server client). SELECT-only; the comparison rules stay pure in run-gap.ts.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { realRuns, type RunRef } from "./run-gap";

type Db = SupabaseClient<Database>;
export type StageRow = { dimension: string; value: string; stage: string | null; momentum: number | null; current_share: number | null };

/** Real ok runs among the latest `limit`, oldest first (REAL_RUN_RULE plus any ids the caller already knows are real). */
export async function fetchRealRuns(db: Db, o: { limit?: number; extra?: number[]; upTo?: number } = {}): Promise<RunRef[]> {
  let q = db.from("forecast_runs").select("id,computed_at").eq("status", "ok");
  if (o.upTo != null) q = q.lte("id", o.upTo);
  const ok = await q.order("id", { ascending: false }).limit(o.limit ?? 20);
  if (ok.error) throw ok.error;
  const runs = (ok.data ?? []).map(r => ({ id: r.id, at: r.computed_at })), ids = runs.map(r => r.id);
  if (!ids.length) return [];
  const [briefs, charts, calls] = await Promise.all([
    db.from("weekly_briefs").select("run_id").in("run_id", ids),
    db.from("chart_cards").select("run_id").in("run_id", ids),
    Promise.all(ids.map(id => db.from("forecast_calls").select("run_id").eq("run_id", id).limit(1))),
  ]);
  for (const r of [briefs, charts, ...calls]) if (r.error) throw r.error;
  return realRuns(runs, [...(briefs.data ?? []), ...(charts.data ?? []), ...calls.flatMap(c => c.data ?? [])].map(r => r.run_id), o.extra ?? []);
}

/** One run's library-wide rows (stage, momentum, share), paged past 1000. */
export async function fetchStageRows(db: Db, runId: number): Promise<StageRow[]> {
  const out: StageRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("forecasts").select("dimension,value,stage,momentum,current_share").eq("run_id", runId).eq("scope", "all").order("dimension").order("value").range(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) return out;
  }
}
