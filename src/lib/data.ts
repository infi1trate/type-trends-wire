import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeBand, type BandResult, type RankPoint } from "./bands";
import type { Scope } from "./crawl";
import type { Database } from "@/integrations/supabase/types";

const STALE = 5 * 60_000;
const PAGE = 1000;

export const toTicker = (family: string) => "$" + family.toUpperCase().replace(/[^A-Z0-9]/g, "-");

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
  ticker: string;
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
    return { ...r, ticker: toTicker(r.family), ...computeBand(history, { firstDate }) };
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
  published_at: string;
  excerpt: string | null;
  tags: string[];
}

export const wireQuery = () =>
  queryOptions({
    queryKey: ["wire"],
    staleTime: STALE,
    queryFn: async (): Promise<WireItem[]> => {
      const { data, error } = await supabase
        .from("wire_items")
        .select("id,url,title,source,published_at,excerpt,tags")
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
  domain: string; index_name: string; lang: string | null;
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
        let q = supabase.from("crawl_sites").select("domain,index_name,lang,color,composition,layout").eq("run_id",id).eq("ok",true).order("domain");
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
