// Leading indicators (W2): anonymous SELECT-only reads for /signals/leading, memoized per instance (the page cache sits in front).
// Head: when the numbers were last read and when collection began (two one-row reads). Body: weekly-sampled points (the public
// outside_series_weekly view, newest half year) and the stored Google Fonts popularity ranks (gfont_snapshots).
import { supabaseAnon } from "../mcp/supabase";
import { memo } from "../memo";
import { allTables, fontRisers, indicatorTables, SPARK_MAX, type FontRank, type FontRisers, type SeriesRow, type TopicTable } from "./series";

const must = <T,>(r: { data: T; error: unknown }) => { if (r.error) throw r.error; return r.data; };
async function pages<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, size = 1000) {
  const out: T[] = [];
  for (let from = 0; from < 50000; from += size) { const { data, error } = await page(from, from + size - 1); if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < size) break; }
  return out;
}
const TTL = 10 * 60_000;

export type IndicatorsHead = { lastRead: string | null; began: string | null };
export const indicatorsHead = memo(TTL, async (): Promise<IndicatorsHead> => {
  const db = supabaseAnon();
  const [last, first] = await Promise.all([
    db.from("outside_series").select("captured_at").order("captured_at", { ascending: false }).limit(1),
    db.from("outside_series").select("period_end").order("period_end").limit(1),
  ]);
  return { lastRead: must(last)?.[0]?.captured_at ?? null, began: must(first)?.[0]?.period_end ?? null };
});

export type IndicatorsBody = IndicatorsHead & { tables: TopicTable[]; fonts: FontRisers; empty: boolean };
const FONT_COLS = "family,popularity_rank";
async function fontRanks(): Promise<FontRisers> {
  const db = supabaseAnon();
  const [nowR, firstR] = await Promise.all([
    db.from("gfont_snapshots").select("captured_on").order("captured_on", { ascending: false }).limit(1),
    db.from("gfont_snapshots").select("captured_on").order("captured_on").limit(1),
  ]);
  const nowDay: string | null = must(nowR)?.[0]?.captured_on ?? null, since: string | null = must(firstR)?.[0]?.captured_on ?? null;
  if (!nowDay) return fontRisers(null, [], null, [], since);
  const cut = new Date(Date.parse(`${nowDay}T00:00:00Z`) - 28 * 864e5).toISOString().slice(0, 10);
  const thenDay: string | null = must(await db.from("gfont_snapshots").select("captured_on").lte("captured_on", cut).order("captured_on", { ascending: false }).limit(1))?.[0]?.captured_on ?? null;
  const ranks = (d: string) => pages<{ family: string; popularity_rank: number }>((f, t) => db.from("gfont_snapshots").select(FONT_COLS).eq("captured_on", d).not("popularity_rank", "is", null).order("popularity_rank").order("family").range(f, t) as never)
    .then(rs => rs.map((r): FontRank => ({ family: r.family, rank: r.popularity_rank })));
  const [nowRanks, thenRanks] = await Promise.all([ranks(nowDay), thenDay ? ranks(thenDay) : Promise.resolve([])]);
  return fontRisers(nowDay, nowRanks, thenDay, thenRanks, since);
}
export const indicatorsBody = memo(TTL, async (): Promise<IndicatorsBody> => {
  const db = supabaseAnon(), since = new Date(Date.now() - (SPARK_MAX + 1) * 7 * 864e5).toISOString().slice(0, 10);
  const [head, rows, fonts] = await Promise.all([
    indicatorsHead(),
    pages<SeriesRow>((f, t) => db.from("outside_series_weekly").select("source,key,metric,period_end,value,label,topic").gte("period_end", since)
      .in("metric", ["downloads_week", "stars", "forks", "open_issues"]).order("source").order("key").order("metric").order("period_end").range(f, t) as never),
    fontRanks().catch((): FontRisers => ({ mode: "none" })),
  ]);
  const tables = indicatorTables(rows.map(r => ({ ...r, value: Number(r.value) })));
  return { ...head, tables: allTables(tables), fonts, empty: !tables.some(t => t.rows.length) };
});

/** Every stored point of one library (both sources), oldest first, for the Data view's expanded row. */
export async function indicatorPoints(label: string): Promise<{ source: string; key: string; metric: string; period_end: string; value: number }[]> {
  const db = supabaseAnon();
  const rows = await pages<{ source: string; key: string; metric: string; period_end: string; value: number }>((f, t) => db.from("outside_series").select("source,key,metric,period_end,value").eq("label", label).order("period_end").order("source").order("metric").range(f, t) as never);
  return rows.map(r => ({ ...r, value: Number(r.value) }));
}

/** Health: the newest run (time and how many points it carries) and the day collection began. */
export async function indicatorsHealthFacts(): Promise<{ last_run_at: string | null; points: number }> {
  const db = supabaseAnon();
  const last = must(await db.from("outside_series").select("run_id,captured_at").order("captured_at", { ascending: false }).limit(1))?.[0];
  if (!last) return { last_run_at: null, points: 0 };
  const { count, error } = await db.from("outside_series").select("run_id", { count: "exact", head: true }).eq("run_id", last.run_id);
  if (error) throw error;
  return { last_run_at: last.captured_at, points: count ?? 0 };
}
