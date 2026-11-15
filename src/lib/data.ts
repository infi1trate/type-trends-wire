import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeBand, type BandResult, type RankPoint } from "./bands";
import type { Scope } from "./crawl";
import type { Database } from "@/integrations/supabase/types";
import { getLibrary, getLibrarySite, getLibraryHistory } from "./library.functions";
import {runTasteCommand} from "./taste.functions";
import { getRebrands, getVibeMap, getChartCard } from "./showcase.functions";
import { getHealth } from "./health.functions";
import type { StageRow, TodayInput } from "./today";
import { decodeEntities } from "./entities";
export const tasteCommandQuery=(command:string)=>queryOptions({queryKey:["taste-command",command],staleTime:7*864e5,queryFn:()=>runTasteCommand({data:{command}})});
export const libraryHistoryQuery = () => queryOptions({queryKey:["library-history"],staleTime:10*60_000,queryFn:()=>getLibraryHistory({data:{}})});

const STALE = 5 * 60_000;
const PAGE = 1000;
export const libraryQuery = () => queryOptions({ queryKey: ["library"], staleTime: 5 * 60_000, queryFn: () => getLibrary() });
export const librarySiteQuery = (domain: string) => queryOptions({ queryKey: ["library-site", domain], staleTime: 5 * 60_000, queryFn: () => getLibrarySite({ data: { domain } }) });


const shiftDate = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

async function dateAtOrBefore(date: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("gfont_snapshots")
    .select("captured_on")
    .lte("captured_on", date)
    .order("captured_on", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0]?.captured_on ?? null;
}

type SnapRow = { family: string; category: string; popularity_rank: number; trending_rank: number; is_variable: boolean };

const rowsOn = (date: string) =>
  fetchAll<SnapRow>((f, t) =>
    supabase
      .from("gfont_snapshots")
      .select("family,category,popularity_rank,trending_rank,is_variable")
      .eq("captured_on", date)
      .order("popularity_rank")
      .range(f, t),
  );

export interface FamilyRow extends SnapRow, BandResult {
}

export interface TypeIndex {
  latest: string | null;
  firstDate: string | null;
  hasPrior: boolean;
  snapshotDays: number;
  rows: FamilyRow[];
}

async function fetchTypeIndex(): Promise<TypeIndex> {
  const { data: l, error } = await supabase
    .from("gfont_snapshots")
    .select("captured_on")
    .order("captured_on", { ascending: false })
    .limit(1);
  if (error) throw error;
  const latest = l?.[0]?.captured_on ?? null;
  if (!latest) return { latest: null, firstDate: null, hasPrior: false, snapshotDays: 0, rows: [] };

  const [{ data: f }, d7, d14, d28, prior] = await Promise.all([
    supabase.from("gfont_snapshots").select("captured_on").order("captured_on").limit(1),
    dateAtOrBefore(shiftDate(latest, 7)),
    dateAtOrBefore(shiftDate(latest, 14)),
    dateAtOrBefore(shiftDate(latest, 28)),
    dateAtOrBefore(shiftDate(latest, 1)),
  ]);
  const firstDate = f?.[0]?.captured_on ?? latest;
  const dates = [...new Set([d28, d14, d7].filter((x): x is string => !!x))];
  const [cur, ...older] = await Promise.all([rowsOn(latest), ...dates.map(rowsOn)]);
  const byDate = new Map(dates.map((d, i) => [d, new Map(older[i]!.map((r) => [r.family, r]))]));

  const rows: FamilyRow[] = cur.map((r) => {
    const history: RankPoint[] = dates
      .map((d) => {
        const o = byDate.get(d)?.get(r.family);
        return o ? { captured_on: d, popularity_rank: o.popularity_rank, trending_rank: o.trending_rank } : null;
      })
      .filter((x): x is RankPoint => !!x);
    history.push({ captured_on: latest, popularity_rank: r.popularity_rank, trending_rank: r.trending_rank });
    return { ...r, ...computeBand(history, { firstDate }) };
  });

  // Snapshot day count: rows for the #1 family (present every day) — cheap proxy for distinct dates.
  let snapshotDays = 1;
  if (cur[0]) {
    const { count } = await supabase
      .from("gfont_snapshots")
      .select("captured_on", { count: "exact", head: true })
      .eq("family", cur[0].family);
    snapshotDays = count ?? 1;
  }
  return { latest, firstDate, hasPrior: !!prior, snapshotDays, rows };
}

export const typeIndexQuery = () =>
  queryOptions({ queryKey: ["type-index"], queryFn: fetchTypeIndex, staleTime: STALE });

export const sparkQuery = (families: string[], latest: string | null) =>
  queryOptions({
    queryKey: ["spark", latest, families],
    enabled: !!latest && families.length > 0,
    staleTime: STALE,
    queryFn: async () => {
      const rows = await fetchAll<{ family: string; captured_on: string; popularity_rank: number }>((f, t) =>
        supabase
          .from("gfont_snapshots")
          .select("family,captured_on,popularity_rank")
          .in("family", families)
          .gte("captured_on", shiftDate(latest!, 28))
          .order("captured_on")
          .range(f, t),
      );
      const map = new Map<string, number[]>();
      for (const r of rows) {
        if (!map.has(r.family)) map.set(r.family, []);
        map.get(r.family)!.push(r.popularity_rank);
      }
      return map;
    },
  });

export const familyHistoryQuery = (family: string | null) =>
  queryOptions({
    queryKey: ["family-history", family],
    enabled: !!family,
    staleTime: STALE,
    queryFn: () =>
      fetchAll<RankPoint>((f, t) =>
        supabase
          .from("gfont_snapshots")
          .select("captured_on,popularity_rank,trending_rank")
          .eq("family", family!)
          .order("captured_on")
          .range(f, t),
      ),
  });

export interface WireItem {
  id: number;
  url: string;
  title: string;
  source: string;
  source_kind: string;
  published_at: string;
  excerpt: string | null;
  link: string | null;
  tags: string[];
  ref?: string | null;
}

export const wireQuery = () =>
  queryOptions({
    queryKey: ["wire"],
    staleTime: STALE,
    queryFn: async (): Promise<WireItem[]> => {
      const { data, error } = await supabase
        .from("wire_items")
        .select("id,url,title,source,source_kind,published_at,excerpt,link,tags,ref")
        .order("published_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

export const wire24hQuery = () =>
  queryOptions({
    queryKey: ["wire-24h"],
    staleTime: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("wire_items")
        .select("id", { count: "exact", head: true })
        .gte("published_at", new Date(Date.now() - 86_400_000).toISOString());
      if (error) throw error;
      return count ?? 0;
    },
  });

export const lastIngestQuery = () =>
  queryOptions({
    queryKey: ["last-ingest"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ingest_runs")
        .select("finished_at,started_at")
        .eq("job", "ingest-wire")
        .eq("ok", true)
        .order("started_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      const r = data?.[0];
      return r ? (r.finished_at ?? r.started_at) : null;
    },
  });

export const typeSnapshotQuery = () =>
  queryOptions({
    queryKey: ["type-snapshot"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("ingest_runs")
        .select("started_at,detail").eq("job", "ingest-gfonts").eq("ok", true)
        .order("started_at", { ascending: false }).limit(1);
      if (error) throw error;
      const run = data?.[0];
      if (!run) return null;
      const detail = run.detail;
      return detail && typeof detail === "object" && !Array.isArray(detail) && typeof detail['date'] === "string"
        ? detail['date'] : run.started_at.slice(0, 10);
    },
  });

type ViewRow<T extends keyof Database["public"]["Views"]> = Database["public"]["Views"][T]["Row"];
export type SpreadRow = ViewRow<"crawl_spread">;
export type CrawlSite = {
  domain: string; index_name: string; lang: string | null; galleries: string[] | null;
  color: { theme?: string; accent?: string; mean_luminance?: number; palette?: {hex:string;share:number}[] };
  composition: {whitespace_ratio?:number;text_density?:number;media_coverage?:number};
  layout: {hero_media?:string;page_height_vh?:number};
};
const CRAWL_STALE = 10 * 60_000;
export const crawlQuery = (scope: Scope) => queryOptions({
  queryKey: ["crawl",scope], staleTime: CRAWL_STALE,
  queryFn: async () => {
    const { data: latest, error } = await supabase.from("crawl_latest").select("id,prev_id").limit(1);
    if (error) throw error;
    const id = latest?.[0]?.id;
    if (!id) return null;
    const runResult = await supabase.from("crawl_runs").select("*").eq("id",id).single();
    if (runResult.error) throw runResult.error;
    const [colors,layout,tech,ctas,words,fonts,spread,sites] = await Promise.all([
      fetchAll<ViewRow<"crawl_color_stats">>((f,t)=>supabase.from("crawl_color_stats").select("*").eq("scope",scope).eq("run_id",id).order("index_name").range(f,t)),
      fetchAll<ViewRow<"crawl_layout_share">>((f,t)=>supabase.from("crawl_layout_share").select("*").eq("scope",scope).eq("run_id",id).order("index_name").order("dimension").order("value").range(f,t)),
      fetchAll<ViewRow<"crawl_tech_share">>((f,t)=>supabase.from("crawl_tech_share").select("*").eq("scope",scope).eq("run_id",id).order("index_name").order("tech").range(f,t)),
      fetchAll<ViewRow<"crawl_cta_phrases">>((f,t)=>supabase.from("crawl_cta_phrases").select("*").eq("scope",scope).eq("run_id",id).order("index_name").order("sites",{ascending:false}).order("phrase").range(f,t)),
      fetchAll<ViewRow<"crawl_h1_words">>((f,t)=>supabase.from("crawl_h1_words").select("*").eq("scope",scope).eq("run_id",id).order("index_name").order("sites",{ascending:false}).order("word").range(f,t)),
      fetchAll<ViewRow<"crawl_font_share">>((f,t)=>supabase.from("crawl_font_share").select("*").eq("scope",scope).eq("run_id",id).order("index_name").order("role").order("sites",{ascending:false}).order("family").range(f,t)),
      fetchAll<SpreadRow>((f,t)=>supabase.from("crawl_spread").select("*").eq("scope",scope).order("signal").range(f,t)),
      fetchAll((f,t)=> {
        let q = supabase.from("crawl_sites").select("domain,index_name,lang,galleries,color,composition,layout").eq("run_id",id).eq("ok",true).order("domain");
        if(scope === "en") q=q.ilike("lang","en%");
        return q.range(f,t);
      }),
    ]);
    return {run:runResult.data,prevId:latest?.[0]?.prev_id,colors,layout,tech,ctas,words,fonts,
      spread:spread.sort((a,b)=>Math.abs(b.spread_pts??0)-Math.abs(a.spread_pts??0)),
      sites:sites.map(s=>({...s,color:s.color??{},composition:s.composition??{},layout:s.layout??{}})) as CrawlSite[]};
  },
});
export type CrawlData = {
 run: Database["public"]["Tables"]["crawl_runs"]["Row"]; prevId: string | null | undefined;
 colors: ViewRow<"crawl_color_stats">[]; layout: ViewRow<"crawl_layout_share">[];
 tech: ViewRow<"crawl_tech_share">[]; ctas: ViewRow<"crawl_cta_phrases">[];
 words: ViewRow<"crawl_h1_words">[]; fonts: ViewRow<"crawl_font_share">[];
 spread: SpreadRow[]; sites: CrawlSite[];
};

// FORECAST (F10): public SELECT-only reads of the latest finished run.
const FORECAST_COLS = "dimension,value,scope,status,stage,model,current_share,proj_q1,proj_q1_lo,proj_q1_hi,proj_q2,proj_q2_lo,proj_q2_hi,proj_q4,proj_q4_lo,proj_q4_hi,momentum,next_wave_score,components,quarters:evidence->quarters,sectors:evidence->sectors,crossed:evidence->crossed_20";
export type ForecastRow = { dimension: string; value: string; scope: string; status: string; stage: string | null; model: string | null; current_share: number | null; proj_q1: number | null; proj_q1_lo: number | null; proj_q1_hi: number | null; proj_q2: number | null; proj_q2_lo: number | null; proj_q2_hi: number | null; proj_q4: number | null; proj_q4_lo: number | null; proj_q4_hi: number | null; momentum: number | null; next_wave_score: number | null; components: { z?: Record<string, number | null>; raw?: Record<string, number | null> } | null; quarters: { q: string; s: number | null; n: number; c: number }[] | null; sectors: Record<string, string | null> | null; crossed: string | null };
export type ModelCard = { data_through: string | null; ai_provider?: "lovable" | "google" | "misconfigured"; backtest_cutoff: string; median_mae_pts: number | null; hit_rate: number | null; n_backtested: number; n_traits: number; n_forecast_ok: number; n_insufficient: number; usable_quarters_all: string[]; next_wave_backtest: { ranked: number; grew_5pts: number; status?: string; hit_rate?: number | null }; next_wave_backtest_legacy_weights?: { ranked: number; grew_5pts: number; hit_rate?: number | null }; component_coverage?: Record<string, number> };
export type BriefDoc = { week: string; headline: string; caveats: string; provider?: "lovable" | "google"; refs?: Record<string, { label: string; domain?: string; url?: string }>; sections: { title: string; body: string; citations: { kind: "forecast" | "event" | "wire" | "spread"; id: string }[] }[] };
export const forecastQuery = () => queryOptions({ queryKey: ["forecast"], staleTime: 10 * 60_000, queryFn: async () => {
  const [card, rows, setters, briefs] = await Promise.all([
    supabase.from("forecast_model_card").select("*").maybeSingle(),
    fetchAll<ForecastRow>((f, t) => supabase.from("forecast_latest").select(FORECAST_COLS).order("scope").order("dimension").order("value").range(f, t) as unknown as PromiseLike<{ data: ForecastRow[] | null; error: unknown }>),
    supabase.from("trendsetters_latest").select("domain,rank,score,traits_led,sector").order("rank").limit(50),
    supabase.from("weekly_briefs").select("week,brief,model,created_at").order("week", { ascending: false }).limit(12),
  ]);
  for (const r of [card, setters, briefs]) if (r.error) throw r.error;
  return { card: card.data ? { ...(card.data.model_card as unknown as ModelCard), computed_at: card.data.computed_at } : null, rows,
    setters: (setters.data ?? []).map(s => ({ ...s, traits_led: (s.traits_led as { trait: string; lead: number; adopted: string; crossed: string }[] | null) ?? [] })),
    briefs: (briefs.data ?? []).map(b => ({ week: b.week, model: b.model, created_at: b.created_at, brief: b.brief as unknown as BriefDoc })) };
} });
export const forecastDetailQuery = (dimension: string, value: string) => queryOptions({ queryKey: ["forecast-detail", dimension, value], staleTime: 10 * 60_000, queryFn: async () => {
  const { data, error } = await supabase.from("forecast_latest").select("scope,status,model,evidence,backtest,components,proj_q1,proj_q1_lo,proj_q1_hi,proj_q2,proj_q2_lo,proj_q2_hi,proj_q4,proj_q4_lo,proj_q4_hi").eq("dimension", dimension).eq("value", value).order("scope");
  if (error) throw error; return data ?? [];
} });
export const latestBriefQuery = () => queryOptions({ queryKey: ["brief-latest"], staleTime: 10 * 60_000, queryFn: async () => {
  const { data, error } = await supabase.from("weekly_briefs").select("week,brief").order("week", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error; return data ? { week: data.week, headline: (data.brief as unknown as BriefDoc).headline } : null;
} });

// SHOWCASE (F9/F7/chart): server-function reads over the shared anonymous store.
export type RebrandFilters = { sector?: string; source?: "live" | "archive"; year?: number; limit: number };
export const rebrandsQuery = (f: RebrandFilters) => queryOptions({ queryKey: ["rebrands", f.sector ?? "all", f.source ?? "all", f.year ?? 0, f.limit], staleTime: 10 * 60_000, queryFn: () => getRebrands({ data: { ...(f.sector && f.sector !== "all" ? { sector: f.sector } : {}), ...(f.source ? { source: f.source } : {}), ...(f.year ? { year: f.year } : {}), offset: 0, limit: f.limit } }) });
export const vibeQuery = () => queryOptions({ queryKey: ["vibe-map"], staleTime: 10 * 60_000, queryFn: () => getVibeMap() });
export const chartCardQuery = (week: string | null) => queryOptions({ queryKey: ["chart-card", week ?? "latest"], staleTime: 10 * 60_000, queryFn: () => getChartCard({ data: { week } }) });
export const healthQuery = () => queryOptions({ queryKey: ["health"], staleTime: 60_000, refetchInterval: 120_000, queryFn: () => getHealth() });

/** TODAY inputs: latest two ok forecast runs (scope all), recent alerts, wire freshness, latest live library change and crawl. */
export const todayQuery = () => queryOptions({
  queryKey: ["today"],
  staleTime: STALE,
  queryFn: async (): Promise<Omit<TodayInput, "type">> => {
    const now = new Date().toISOString(), since = new Date(Date.now() - 864e5).toISOString();
    const runsRes = await supabase.from("forecast_runs").select("id,computed_at").eq("status", "ok").order("id", { ascending: false }).limit(2);
    if (runsRes.error) throw runsRes.error;
    const [latest, previous] = runsRes.data ?? [];
    const stageRows = async (runId: number | undefined) => {
      const out: StageRow[] = [];
      if (runId === undefined) return out;
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase.from("forecasts").select("dimension,value,stage,momentum,current_share").eq("run_id", runId).eq("scope", "all").order("dimension").order("value").range(from, from + PAGE - 1);
        if (error) throw error;
        out.push(...(data ?? []));
        if ((data ?? []).length < PAGE) return out;
      }
    };
    const [lat, prev, alerts, count, wireLatest, event, crawl] = await Promise.all([
      stageRows(latest?.id), stageRows(previous?.id),
      latest ? supabase.from("wire_items").select("title,url,source,published_at,ref").eq("source_kind", "alert").gte("published_at", new Date(Date.parse(latest.computed_at) - 36e5).toISOString()).order("published_at", { ascending: false }).order("id").limit(10) : Promise.resolve({ data: [], error: null }),
      supabase.from("wire_items").select("id", { count: "exact", head: true }).neq("source_kind", "alert").gte("published_at", since),
      supabase.from("wire_items").select("title,url,source,published_at").neq("source_kind", "alert").lte("published_at", now).order("published_at", { ascending: false }).limit(1),
      supabase.from("library_event_feed").select("domain,summary,detected_at,sector").eq("source", "live").neq("type", "new_surface").order("detected_at", { ascending: false }).limit(1),
      supabase.from("crawl_runs").select("finished_at,stats").eq("status", "finished").order("finished_at", { ascending: false }).limit(1),
    ]);
    for (const r of [alerts, count, wireLatest, event, crawl]) if (r.error) throw r.error;
    const c = crawl.data?.[0], stats = (c?.stats ?? {}) as Record<string, { ok?: number } | unknown>;
    const sites = Object.values(stats).reduce<number>((n, v) => n + (v && typeof v === "object" && typeof (v as { ok?: unknown }).ok === "number" ? (v as { ok: number }).ok : 0), 0);
    const e = event.data?.[0];
    return {
      now,
      runs: { latest: latest ?? null, previous: previous ?? null },
      stages: { latest: lat, previous: prev },
      alerts: (alerts.data ?? []).map(a => ({ ...a, title: decodeEntities(a.title) })),
      wire: { count24h: count.count ?? 0, latest: wireLatest.data?.[0] ? { ...wireLatest.data[0], title: decodeEntities(wireLatest.data[0].title) } : null },
      event: e?.domain && e.detected_at ? { domain: e.domain, summary: e.summary ?? "page changed", detected_at: e.detected_at, sector: e.sector ?? null } : null,
      crawl: c?.finished_at ? { finished_at: c.finished_at, sites } : null,
    };
  },
});

/** First discourse sample, for "fills in after N weeks" copy. */
export const discourseSinceQuery = () => queryOptions({ queryKey: ["discourse-since"], staleTime: 60 * 60_000, queryFn: async () => {
  const { data, error } = await supabase.from("discourse_counts").select("updated_at").order("updated_at").limit(1);
  if (error) throw error;
  return data?.[0]?.updated_at ?? null;
} });
