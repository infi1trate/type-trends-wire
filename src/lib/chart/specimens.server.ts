// L2 · rows for the proposed forms' specimens on /brand/system: anonymous SELECT-only reads of the newest reader run (headline-tier
// signals from the signal snapshot, their sector rows' stored quarters, and next quarter's forecast range). Nothing is written.
import { supabaseAnon } from "../mcp/supabase";
import { latestSignals } from "../signals.server";
import { readerRunId } from "../real-runs";
import { SECTORS } from "../library";
import { dotRangeModel, nextQuarter, slopeModel, type DotRangeModel, type Quarter, type SlopeModel } from "./specimens";

export type Specimens = { run_id: number | null; computed_at: string | null; slope: SlopeModel | null; range: DotRangeModel };
export async function loadSpecimens(): Promise<Specimens> {
  const db = supabaseAnon();
  const [{ snap, signals }, runId] = await Promise.all([latestSignals("all"), readerRunId(db)]);
  const head = signals.filter(s => s.tier === "headline");
  // Slope: the headline signals moving fastest, first that most sectors cover well at two quarters.
  let slope: SlopeModel | null = null;
  for (const s of [...head].sort((a, b) => Math.abs(b.momentum ?? 0) - Math.abs(a.momentum ?? 0)).slice(0, 5)) {
    const [dimension, ...rest] = s.key.split(":"), value = rest.join(":");
    const { data, error } = await db.from("forecasts").select("scope,quarters:evidence->quarters").eq("run_id", runId).eq("dimension", dimension!).eq("value", value).in("scope", SECTORS.filter(x => x !== "studios")); // studios are showcases, never ranked
    if (error) throw error;
    slope = slopeModel(s.key, (data ?? []).map(r => ({ scope: r.scope as string, quarters: Array.isArray(r.quarters) ? (r.quarters as Quarter[]) : null })));
    if (slope && slope.rows.length >= 4) break;
  }
  // Dot with range: next quarter's forecast low and high for the headline signals.
  const keys = new Set(head.map(s => s.key)), rows: { dimension: string; value: string; current_share: number | null; proj_q1_lo: number | null; proj_q1_hi: number | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("forecasts").select("dimension,value,current_share,proj_q1_lo,proj_q1_hi").eq("run_id", runId).eq("scope", "all").not("proj_q1_lo", "is", null).order("dimension").order("value").range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as typeof rows));
    if (!data || data.length < 1000) break;
  }
  const latestQ = slope?.to ?? null;
  return { run_id: snap.run_id ?? runId, computed_at: snap.computed_at ?? null, slope, range: dotRangeModel(rows, k => keys.has(k), latestQ ? nextQuarter(latestQ) : null) };
}
