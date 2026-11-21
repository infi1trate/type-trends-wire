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
