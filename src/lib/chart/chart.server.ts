// Chart of the Week storage: one stored model per brief week (service-role write), anonymous reads for pages and images.
import { supabaseAnon } from "../mcp/supabase";
import { pickCard, briefCall, parseTraitId, breakoutAlert, type BriefLike, type ForecastLike, type AlertLike } from "./model";
import type { CardModel } from "./card";
const COLS = "dimension,value,scope,stage,current_share,momentum,quarters:evidence->quarters,proj_q1,proj_q1_lo,proj_q1_hi,proj_q2,proj_q2_lo,proj_q2_hi,proj_q4,proj_q4_lo,proj_q4_hi";
export type StoredCard = { week: string; run_id: number; trait: string; origin: "call" | "alert"; model: CardModel; created_at: string };

/** Build and store the card for a brief week (latest brief when omitted). Uses that brief's own forecast run. */
export async function generateChartCard(week?: string) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  let q = db.from("weekly_briefs").select("week,run_id,brief");
  q = week ? q.eq("week", week) : q.order("week", { ascending: false });
  const { data: b, error } = await q.not("run_id", "is", null).limit(1).maybeSingle();
  if (error) throw error;
  if (!b || b.run_id == null) return { ok: false as const, code: "no_brief" };
  const runId = b.run_id;
  const brief = b.brief as unknown as BriefLike;
  const [run, alerts] = await Promise.all([
    db.from("forecast_model_card").select("data_cutoff_quarter").maybeSingle(),
    db.from("wire_items").select("title,ref,url,tags,published_at").eq("source_kind", "alert").gte("published_at", new Date(Date.now() - 14 * 864e5).toISOString()).order("published_at", { ascending: false }).limit(50),
  ]);
  if (run.error || alerts.error) throw run.error ?? alerts.error;
  const wanted: { dimension: string; value: string }[] = [];
  const call = briefCall(brief); if (call) wanted.push(parseTraitId(call.id));
  const alert = breakoutAlert((alerts.data ?? []) as AlertLike[]); if (alert) wanted.push(parseTraitId(alert.trait));
  const rows: ForecastLike[] = [];
  for (const t of wanted) {
    // Newest finished forecast run (normally the brief's own run); falls back to the brief's run if the trait was dropped.
    const latest = await db.from("forecast_latest").select(`${COLS},run_id`).eq("dimension", t.dimension).eq("value", t.value);
    const res = latest.data?.length ? latest : await db.from("forecasts").select(`${COLS},run_id`).eq("run_id", runId).eq("dimension", t.dimension).eq("value", t.value);
    if (res.error) throw res.error;
    rows.push(...((res.data ?? []) as unknown as ForecastLike[]));
  }
  const model = pickCard({ week: b.week, run_id: runId, brief, rows, alerts: (alerts.data ?? []) as AlertLike[], data_through: run.data?.data_cutoff_quarter ?? null });
  if (!model) return { ok: false as const, code: "no_series", week: b.week };
  const up = await db.from("chart_cards").upsert({ week: model.week, run_id: model.run_id, trait: `${model.trait}:${model.scope}`, origin: model.origin, model: model as never });
  if (up.error) throw up.error;
  return { ok: true as const, week: model.week, trait: model.trait, scope: model.scope, origin: model.origin };
}
export async function chartCard(week: string | null): Promise<StoredCard | null> {
  let q = supabaseAnon().from("chart_cards").select("week,run_id,trait,origin,model,created_at");
  q = week ? q.eq("week", week) : q.order("week", { ascending: false });
  const { data, error } = await q.limit(1).maybeSingle();
  if (error) throw error;
  return data ? ({ ...data, model: data.model as unknown as CardModel } as StoredCard) : null;
}
