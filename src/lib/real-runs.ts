// Reads the real (non-dev) forecast runs and a run's library-wide stages with whichever public client the caller has
// (browser client or the anonymous server client). SELECT-only; the comparison rules stay pure in run-gap.ts.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { readerRuns, realRuns, type ReaderRuns, type RunRef } from "./run-gap";
import { memoBy } from "./memo";

type Db = SupabaseClient<Database>;
export type StageRow = { dimension: string; value: string; stage: string | null; momentum: number | null; current_share: number | null };

/** Real ok runs among the latest `limit`, oldest first (REAL_RUN_RULE plus any ids the caller already knows are real). */
export async function fetchRealRuns(db: Db, o: { limit?: number; extra?: number[]; upTo?: number; runs?: RunRef[] } = {}): Promise<RunRef[]> {
  let runs = o.runs;
  if (!runs) {
    let q = db.from("forecast_runs").select("id,computed_at").eq("status", "ok");
    if (o.upTo != null) q = q.lte("id", o.upTo);
    const ok = await q.order("id", { ascending: false }).limit(o.limit ?? 20);
    if (ok.error) throw ok.error;
    runs = (ok.data ?? []).map(r => ({ id: r.id, at: r.computed_at }));
  }
  const ids = runs.map(r => r.id);
  if (!ids.length) return [];
  // Which of these runs have stored outputs: one request per table (forecast_calls paged, since a run can hold many calls).
  const [briefs, charts, calls] = await Promise.all([
    db.from("weekly_briefs").select("run_id").in("run_id", ids),
    db.from("chart_cards").select("run_id").in("run_id", ids),
    callRunIds(db, ids),
  ]);
  for (const r of [briefs, charts]) if (r.error) throw r.error;
  return realRuns(runs, [...(briefs.data ?? []), ...(charts.data ?? [])].map(r => r.run_id).concat(calls), o.extra ?? []);
}
async function callRunIds(db: Db, ids: number[]): Promise<number[]> {
  const out: number[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("forecast_calls").select("run_id").in("run_id", ids).order("id").range(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []).map(r => r.run_id));
    if ((data ?? []).length < 1000) return [...new Set(out)];
  }
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

/** The run reader pages read (readerRuns in run-gap.ts), cached five minutes per runtime: every public client sees the same runs, and server code makes a fresh anonymous client per call. */
const reader = memoBy(5 * 60_000, async (db: Db): Promise<ReaderRuns<RunRef>> => {
  const ok = await db.from("forecast_runs").select("id,computed_at").eq("status", "ok").order("id", { ascending: false }).limit(20);
  if (ok.error) throw ok.error;
  const runs = (ok.data ?? []).map(r => ({ id: r.id, at: r.computed_at }));
  return readerRuns(runs, await fetchRealRuns(db, { runs }));
}, { key: () => "reader" });
export const fetchReaderRuns = (db: Db): Promise<ReaderRuns<RunRef>> => reader(db);
/** Id of the run reader pages read; -1 when none (so `.eq("run_id", id)` returns nothing rather than everything). */
export const readerRunId = async (db: Db) => (await fetchReaderRuns(db)).latest?.id ?? -1;
