// Live reads for /kit: anonymous SELECT-only, reusing the signal snapshot, the story index and the crop table. Nothing is written.
import { supabaseAnon } from "./mcp/supabase";
import { latestSignals } from "./signals.server";
import { readerRunId } from "./real-runs";
import { isComposite } from "./composites";
import { storyIndex } from "./stories/read.server";
import { streamOf, toStory } from "./stories/view";
import { toCrop, type CropRow } from "./crops";
import { kitCharts, type QuarterSeries } from "./kit";

export async function loadKit() {
  const db = supabaseAnon();
  const [{ snap, signals }, all, runId, crops] = await Promise.all([
    latestSignals("all"), storyIndex(), readerRunId(db),
    db.from("site_crops").select("domain,section,viewport,captured_at,first_seen_at,last_seen_at,path,width,height,bytes,hash").order("captured_at", { ascending: false }).limit(1),
  ]);
  const composites = signals.filter(s => isComposite(s.key));
  const { data: q, error } = await db.from("forecasts").select("dimension,value,quarters:evidence->quarters").eq("run_id", runId).eq("scope", "all").eq("dimension", "combo").limit(100);
  if (error) throw error;
  const series: QuarterSeries[] = (q ?? []).map(r => ({ key: `${r.dimension}:${r.value}`, quarters: Array.isArray(r.quarters) ? (r.quarters as QuarterSeries["quarters"]) : [] }));
  const stream = streamOf(all), types: Record<string, number> = {};
  for (const s of stream) types[s.type] = (types[s.type] ?? 0) + 1;
  const stories = stream.slice(0, 6).map(toStory);
  const headline = signals.filter(s => s.tier === "headline").slice(0, 3);
  return {
    run_id: snap.run_id, computed_at: snap.computed_at, published: stream.length,
    charts: kitCharts(composites, series, types), composites: composites.length,
    stories, signals: headline, crop: crops.data?.[0] ? toCrop(crops.data[0] as CropRow) : null,
    brand: stories.find(s => s.domains[0])?.domains[0] ?? null,
  };
}
export type KitData = Awaited<ReturnType<typeof loadKit>>;
