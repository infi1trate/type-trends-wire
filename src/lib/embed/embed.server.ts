// Anonymous SELECT-only loads for embeds and oEmbed.
import { supabaseAnon } from "../mcp/supabase";
import { canonical } from "../labels";
import type { ForecastLike } from "../chart/model";
import { chartEmbedModel, traitEmbedModel, type EmbedModel } from "./embed";
const COLS = "dimension,value,scope,stage,current_share,momentum,quarters:evidence->quarters,proj_q1,proj_q1_lo,proj_q1_hi,proj_q2,proj_q2_lo,proj_q2_hi,proj_q4,proj_q4_lo,proj_q4_hi,run_id";
export async function loadTraitEmbed(rawKey: string, scope = "all"): Promise<EmbedModel | null> {
  const key = canonical(rawKey), i = key.indexOf(":"); if (i <= 0 || !/^[a-z0-9-]{1,40}$/.test(scope)) return null;
  const db = supabaseAnon();
  const [row, card] = await Promise.all([
    db.from("forecast_latest").select(COLS).eq("dimension", key.slice(0, i)).eq("value", key.slice(i + 1)).eq("scope", scope).limit(1).maybeSingle(),
    db.from("forecast_model_card").select("data_through:model_card->>data_through").maybeSingle(),
  ]);
  if (row.error || card.error) throw row.error ?? card.error;
  return traitEmbedModel(key, (row.data ?? null) as unknown as ForecastLike | null, (card.data as { data_through: string | null } | null)?.data_through ?? null);
}
export async function loadChartEmbed(week: string): Promise<EmbedModel | null> {
  if (!/^\d{4}-W\d{2}$/.test(week)) return null;
  const { chartCard } = await import("../chart/chart.server");
  return chartEmbedModel((await chartCard(week))?.model ?? null);
}
export const embedLoaders = { trait: loadTraitEmbed, chart: loadChartEmbed };
