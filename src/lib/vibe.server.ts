// Weekly vibe-map job (service-role writes) and anonymous reads shared by F7 and the MCP `vibe_map` tool.
import { historyRows } from "./history.server";
import { supabaseAnon } from "./mcp/supabase";
import { fitVibe, siteTokens, clusterMomentum, axisLabel, tagPhrase, type VibeSite, type VibeModel } from "./vibe";
const qKey = (iso: string) => { const d = new Date(iso); return `${d.getUTCFullYear()}Q${Math.floor(d.getUTCMonth() / 3) + 1}`; };
type HistRow = { domain: string; quarter: string; sector: string; now: boolean | null; theme: string | null; h1_family: string | null; body_family: string | null; ai_tags: unknown; captured_at: string | null };

export async function computeVibe(runId: number) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const rows = await historyRows<HistRow>(db as never, "domain,quarter,sector,now,theme,h1_family,body_family,ai_tags,captured_at");
  const current: VibeSite[] = [], history: VibeSite[] = [];
  let latestTagged: string | null = null;
  for (const r of rows) {
    const tokens = siteTokens(r); if (!tokens || !r.domain || !r.sector || !r.quarter) continue;
    if (r.now) { current.push({ domain: r.domain, sector: r.sector, quarter: r.quarter, tokens }); if (r.captured_at && (!latestTagged || r.captured_at > latestTagged)) latestTagged = r.captured_at; }
    else history.push({ domain: r.domain, sector: r.sector, quarter: r.quarter, tokens });
  }
  if (current.length < 20) return { ok: false, code: "too_few_tagged_sites", n: current.length };
  const quarter = qKey(new Date().toISOString()), model = fitVibe(current), { projected, momentum, base_quarter } = clusterMomentum(model, history);
  const fc = await db.from("forecast_latest").select("dimension,value,stage,momentum,current_share,status").eq("scope", "all").eq("status", "ok");
  if (fc.error) throw fc.error;
  const fcMap = new Map((fc.data ?? []).map(f => [`${f.dimension}:${f.value}`, f]));
  const points = [...model.points.map(p => ({ quarter, domain: p.domain, sector: p.sector, x: p.x, y: p.y, cluster: p.cluster, tags: p.tokens.slice(0, 40), current: true, run_id: runId })),
    ...projected.filter(p => p.quarter !== quarter).map(p => ({ quarter: p.quarter, domain: p.domain, sector: p.sector, x: p.x, y: p.y, cluster: p.cluster, tags: p.tokens.slice(0, 40), current: false, run_id: runId }))];
  for (let i = 0; i < points.length; i += 500) { const up = await db.from("vibe_points").upsert(points.slice(i, i + 500)); if (up.error) throw up.error; }
  const clusters = model.clusters.map(c => ({ quarter, cluster: c.id, name: c.name, run_id: runId, stats: { n: c.n, share: c.share, centroid: c.centroid, top_tags: c.top_tags.map(t => ({ ...t, phrase: tagPhrase(t.tag) })), top_sectors: c.top_sectors, momentum: momentum.get(c.id) ?? null,
    drivers: c.top_tags.map(t => fcMap.get(t.tag)).filter((f): f is NonNullable<typeof f> => !!f).slice(0, 3).map(f => ({ trait: `${f.dimension}:${f.value}`, stage: f.stage, momentum: f.momentum, share: f.current_share })) } }));
  const cu = await db.from("vibe_clusters").upsert(clusters as never); if (cu.error) throw cu.error;
  const mm = await db.from("vibe_maps").upsert({ quarter, run_id: runId, model: { n: model.n, k: model.k, silhouette: model.silhouette, silhouettes: model.silhouettes, tokens: model.tokens, weights: model.weights, mean: model.mean, components: model.components, axes: model.axes.map(a => ({ ...a, label: axisLabel(a) })), base_quarter, history_points: projected.length, data_through: latestTagged } as never });
  if (mm.error) throw mm.error;
  // Remove rows left by an earlier fit so every stored point shares this run's projection.
  for (const t of ["vibe_points", "vibe_clusters", "vibe_maps"] as const) { const d = await db.from(t).delete().neq("run_id", runId); if (d.error) throw d.error; }
  return { ok: true, quarter, n: model.n, k: model.k, silhouette: model.silhouette, clusters: model.clusters.map(c => ({ name: c.name, n: c.n })), history_points: projected.length };
}

export type VibeMapRead = Awaited<ReturnType<typeof vibeMap>>;
export async function vibeMap(sector?: string) {
  const db = supabaseAnon();
  const map = await db.from("vibe_maps").select("quarter,run_id,computed_at,model").order("quarter", { ascending: false }).limit(1).maybeSingle();
  if (map.error) throw map.error;
  if (!map.data) return null;
  const [clusters, points] = await Promise.all([
    db.from("vibe_clusters").select("cluster,name,stats").eq("quarter", map.data.quarter).order("cluster"),
    (async () => { const out = []; for (let from = 0; ; from += 1000) { const { data, error } = await db.from("vibe_points").select("domain,sector,x,y,cluster,tags").eq("quarter", map.data!.quarter).eq("current", true).order("domain").range(from, from + 999); if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < 1000) break; } return out; })(),
  ]);
  if (clusters.error) throw clusters.error;
  const m = map.data.model as unknown as Pick<VibeModel, "n" | "k" | "silhouette"> & { axes: { label: string; positive: string[]; negative: string[]; explained: number }[]; base_quarter: string | null; data_through: string | null };
  return { quarter: map.data.quarter, run_id: map.data.run_id, computed_at: map.data.computed_at, n: m.n, k: m.k, silhouette: m.silhouette, axes: m.axes, base_quarter: m.base_quarter, data_through: m.data_through, sector: sector ?? "all",
    clusters: (clusters.data ?? []).map(c => ({ id: c.cluster, name: c.name, ...(c.stats as Record<string, unknown>) })), points };
}
