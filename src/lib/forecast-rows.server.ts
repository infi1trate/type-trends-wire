// One stored forecast run's signal rows, shared by the signal snapshot and the story build. A stored ok run's rows do not change.
// `sample` is the latest stored quarter ({ q, n, s }): the count and base behind the share (U2b, one count per claim). The JSON paths below cost ~0.3 ms a row to extract (136 ms a page), so each instance reads a run once per six hours.
import { supabaseAnon } from "./mcp/supabase";
import { memoBy } from "./memo";
import type { SignalRow } from "./signals";

export const FORECAST_ROW_COLS = "dimension,value,scope,status,stage,momentum,current_share,next_wave_score,present:components->present,sites:components->sites,usable:evidence->usable,sample:evidence->quarters->-1";
const EMPTY = "forecast run has no rows yet";
const runRows = memoBy(6 * 3_600_000, async (runId: number): Promise<SignalRow[]> => {
  const db = supabaseAnon(), out: SignalRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("forecasts").select(FORECAST_ROW_COLS).eq("run_id", runId).order("scope").order("dimension").order("value").range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as unknown as SignalRow[]));
    if (!data || data.length < 1000) break;
  }
  if (!out.length) throw new Error(EMPTY); // never cache an empty (or still-writing) run
  return out;
}, { key: id => String(id), max: 12 });
/** The run's rows (cached), or [] when it has none yet. */
export const forecastRunRows = (runId: number): Promise<SignalRow[]> => runRows(runId).catch((e: unknown) => { if (e instanceof Error && e.message === EMPTY) return []; throw e; });

/** P2b · the crossover rule reads a row's every stored quarter (~1.8 KB a row, 2.5 MB for a whole run against 0.1 MB for the latest
 *  quarter alone), so the shared row read keeps only `sample` and the story build reads quarters for the few rows that pass every other
 *  crossover check (`crossoverQuarterNeeds`). */
export const FORECAST_QUARTERS_COLS = "dimension,value,scope,quarters:evidence->quarters";
export async function forecastRowQuarters(runId: number, keys: { key: string; scope: string }[]): Promise<Map<string, unknown>> {
  const out = new Map<string, unknown>(), want = new Set(keys.map(k => `${k.key}|${k.scope}`));
  if (!keys.length) return out;
  const split = keys.map(k => { const i = k.key.indexOf(":"); return { d: k.key.slice(0, i), v: k.key.slice(i + 1), scope: k.scope }; });
  const { data, error } = await supabaseAnon().from("forecasts").select(FORECAST_QUARTERS_COLS).eq("run_id", runId)
    .in("dimension", [...new Set(split.map(x => x.d))]).in("value", [...new Set(split.map(x => x.v))]).in("scope", [...new Set(split.map(x => x.scope))]).limit(1000);
  if (error) throw error;
  for (const r of (data ?? []) as unknown as { dimension: string; value: string; scope: string; quarters: unknown }[]) {
    const k = `${r.dimension}:${r.value}|${r.scope}`; if (want.has(k)) out.set(k, r.quarters);
  }
  return out;
}
