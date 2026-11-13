// Anonymous SELECT-only forecast reads shared by MCP.
import { supabaseAnon } from "./mcp/supabase";
export async function modelCard() { const { data, error } = await supabaseAnon().from("forecast_model_card").select("*").maybeSingle(); if (error) throw error; return data ? { run_id: data.run_id, computed_at: data.computed_at, data_cutoff_quarter: data.data_cutoff_quarter, card: data.model_card } : null; }
export async function forecasts(input: { dimension?: string | undefined; value?: string | undefined; scope?: string | undefined }) {
  let q = supabaseAnon().from("forecast_latest").select("dimension,value,scope,status,stage,model,current_share,proj_q1,proj_q1_lo,proj_q1_hi,proj_q2,proj_q2_lo,proj_q2_hi,proj_q4,proj_q4_lo,proj_q4_hi,momentum,next_wave_score,components,quarters:evidence->quarters,sites:evidence->sites,sectors:evidence->sectors,backtest").eq("scope", input.scope ?? "all").order("next_wave_score", { ascending: false, nullsFirst: false }).order("dimension").order("value");
  if (input.dimension) q = q.eq("dimension", input.dimension); if (input.value) q = q.eq("value", input.value);
  const { data, error } = await q.limit(input.dimension || input.value ? 200 : 60); if (error) throw error; return data ?? [];
}
export async function nextWave(scope = "all", limit = 15) {
  const all = await forecasts({ scope: "all" });
  const rows = all.filter(r => r.next_wave_score !== null).slice(0, limit);
  if (scope === "all") return rows.map(r => ({ trait: `${r.dimension}:${r.value}`, stage: r.stage, current_share: r.current_share, proj_q4: r.proj_q4, proj_q4_lo: r.proj_q4_lo, proj_q4_hi: r.proj_q4_hi, momentum: r.momentum, next_wave_score: r.next_wave_score, components: r.components }));
  const sec = await forecasts({ scope }); const m = new Map(sec.map(r => [`${r.dimension}:${r.value}`, r]));
  return rows.map(r => { const s = m.get(`${r.dimension}:${r.value}`); return { trait: `${r.dimension}:${r.value}`, next_wave_score: r.next_wave_score, components: r.components, scope, stage: s?.stage ?? null, current_share: s?.current_share ?? null, proj_q4: s?.proj_q4 ?? null, momentum: s?.momentum ?? null }; });
}
export async function trendsetters(limit = 20) { const { data, error } = await supabaseAnon().from("trendsetters_latest").select("rank,domain,sector,score,traits_led").order("rank").limit(limit); if (error) throw error; return data ?? []; }
export async function weeklyBrief(week?: string) {
  let q = supabaseAnon().from("weekly_briefs").select("week,brief,model,created_at").order("week", { ascending: false }); if (week) q = q.eq("week", week);
  const { data, error } = await q.limit(1).maybeSingle(); if (error) throw error; return data ? { ...data, ai_written: true } : null;
}
