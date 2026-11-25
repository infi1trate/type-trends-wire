// B2 · stores lead and lag counts for every headline signal (service role), run inside the weekly structure follow-up, never in a
// request. Reads the stored site history, the active sites, the vanguard list and the newest reader run's headline signals.
import { leadLagRows } from "./leadlag";

export async function refreshLeadLag(): Promise<{ ok: boolean; signals: number; rows: number; code?: string }> {
  const [{ supabaseAdmin: db }, { supabaseAnon }, { historyRows }, { loadVanguard }, { latestSignals }] = await Promise.all([
    import("@/integrations/supabase/client.server"), import("./mcp/supabase"), import("./history.server"), import("./vanguard.server"), import("./signals.server")]);
  const [history, sites, vanguard, sig] = await Promise.all([historyRows<import("./data-stories/series").HistRow>(supabaseAnon(), "*"), db.from("library_sites").select("domain,name,sector,active"), loadVanguard(), latestSignals("all")]);
  if (sites.error) return { ok: false, signals: 0, rows: 0, code: "sites_read_failed" };
  if (!vanguard.length) return { ok: false, signals: 0, rows: 0, code: "no_vanguard" };
  const keys = sig.signals.filter(s => s.tier === "headline").map(s => s.key);
  const rows = leadLagRows((sites.data ?? []).map(s => ({ domain: s.domain, name: s.name ?? null, sector: s.sector ?? "", active: s.active !== false })), history, vanguard, keys);
  const at = new Date().toISOString();
  for (let i = 0; i < rows.length; i += 1000) {
    const w = await db.from("library_lead_lag_series").upsert(rows.slice(i, i + 1000).map(r => ({ ...r, computed_at: at })), { onConflict: "signal,quarter" });
    if (w.error) return { ok: false, signals: keys.length, rows: i, code: "write_failed" };
  }
  return { ok: true, signals: keys.length, rows: rows.length };
}
