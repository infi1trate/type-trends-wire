// Anonymous SELECT-only reads of the latest stored forecast for the signal view model (terminal, Digest, embeds, MCP share this).
import { supabaseAnon } from "./mcp/supabase";
import { buildSignals, rowKey, tiersFrom, type SignalRow, type SignalSnapshot } from "./signals";
export type { SignalSnapshot };

async function pages<T>(f: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, size = 1000) {
  const out: T[] = [];
  for (let from = 0; ; from += size) { const { data, error } = await f(from, from + size - 1); if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < size) break; }
  return out;
}
const COLS = "dimension,value,scope,status,stage,momentum,current_share,next_wave_score,present:components->present,sites:components->sites,usable:evidence->usable";
let cache: { at: number; snap: SignalSnapshot } | null = null;
const TTL = 5 * 60_000;

/** Latest ok run (all scopes) plus the previous two runs' library-wide stages. Cached five minutes per server instance. */
export async function loadSignalSnapshot(): Promise<SignalSnapshot> {
  if (cache && Date.now() - cache.at < TTL) return cache.snap;
  const db = supabaseAnon();
  const runs = await db.from("forecast_runs").select("id,computed_at").eq("status", "ok").order("id", { ascending: false }).limit(3);
  if (runs.error) throw runs.error;
  const [latest, ...prev] = runs.data ?? [];
  if (!latest) return { run_id: null, computed_at: null, prev_runs: [], rows: [], prev: [] };
  const [rows, ...prevRows] = await Promise.all([
    pages<SignalRow>((f, t) => db.from("forecasts").select(COLS).eq("run_id", latest.id).order("scope").order("dimension").order("value").range(f, t) as never),
    ...prev.map(p => pages<{ dimension: string; value: string; stage: string | null }>((f, t) => db.from("forecasts").select("dimension,value,stage").eq("run_id", p.id).eq("scope", "all").order("dimension").order("value").range(f, t) as never)),
  ]);
  const prevStages = new Map<string, (string | null)[]>();
  prevRows.forEach((list, i) => { for (const r of list) { const k = rowKey(r), a = prevStages.get(k) ?? [null, null]; a[i] = r.stage; prevStages.set(k, a); } });
  const snap: SignalSnapshot = { run_id: latest.id, computed_at: latest.computed_at, prev_runs: prev.map(p => p.id), rows: rows.map(r => ({ ...r, present: Array.isArray(r.present) ? r.present : [], sites: typeof r.sites === "number" ? r.sites : null, usable: typeof r.usable === "number" ? r.usable : null })), prev: [...prevStages] };
  cache = { at: Date.now(), snap };
  return snap;
}
/** Library-wide signals (and tiers) from the latest snapshot. */
export async function latestSignals(scope = "all") {
  const snap = await loadSignalSnapshot(), tiers = tiersFrom(snap.rows, new Map(snap.prev));
  return { snap, tiers, signals: buildSignals(snap.rows, tiers, scope) };
}
