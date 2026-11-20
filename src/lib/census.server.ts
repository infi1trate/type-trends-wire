// Census I/O (census.ts is the rule). `censusInput` reads the last eight days of live desktop home captures anonymously (headline source,
// headline and button labels by JSON path) and the stored counts behind published census stories; `recordCensus` appends the count a
// census story runs on (insert-only census_counts, service role) before the story itself is stored.
import type { supabaseAnon } from "./mcp/supabase";
import { CENSUS_DAYS, censusStoryOf, type CensusCapture, type CensusInput, type CensusRow } from "./census";

type Db = ReturnType<typeof supabaseAnon>;
type Row = { id: number; domain: string; captured_at: string; src: string | null; h1: string | null; ctas: unknown };
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export async function censusCaptures(db: Db, now: number): Promise<CensusCapture[]> {
  const rows: Row[] = [], since = new Date(now - CENSUS_DAYS * 864e5).toISOString(), until = new Date(now).toISOString();
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await db.from("library_snapshots").select("id,domain,captured_at,src:signals->layout->>headline_source,h1:signals->lexicon->>h1,ctas:signals->lexicon->ctas")
      .eq("source", "live").eq("page_type", "home").eq("viewport", "desktop").gte("captured_at", since).lte("captured_at", until).order("id").range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 1000) break;
  }
  return rows.map(r => ({ id: r.id, domain: r.domain, at: r.captured_at, source: r.src ?? null, h1: r.h1 ?? null, ctas: strings(r.ctas) }));
}
/** Stored counts whose census story is stored and still published (a count recorded for a story that never landed, or was retired, is not a run). */
export async function censusHistory(db: Db): Promise<CensusInput["history"]> {
  const { data, error } = await db.from("census_counts").select("census_key,day,count,base,story_id").order("id").limit(1000);
  if (error) throw error;
  const rows = (data ?? []) as unknown as Pick<CensusRow, "census_key" | "day" | "count" | "base" | "story_id">[];
  // E2h: a recount row (`<story id>#recount:…`) belongs to its story, and as the later row it is the count the next census compares with.
  const ids = [...new Set(rows.map(r => censusStoryOf(r.story_id)))];
  if (!ids.length) return [];
  const [st, ed] = await Promise.all([db.from("stories").select("id,status").in("id", ids), db.from("story_edits").select("id,story_id,action,at").in("story_id", ids).order("id")]);
  if (st.error || ed.error) throw st.error ?? ed.error;
  const state = new Map((st.data ?? []).map(s => [s.id as string, s.status as string]));
  for (const e of [...(ed.data ?? [])].sort((a, b) => String(a.at).localeCompare(String(b.at)) || Number(a.id) - Number(b.id))) {
    if (e.action === "kill") state.set(e.story_id as string, "killed"); else if (e.action === "restore" || e.action === "pin") state.set(e.story_id as string, "published");
  }
  return rows.filter(r => state.get(censusStoryOf(r.story_id)) === "published").map(r => ({ census_key: r.census_key, day: r.day, count: r.count, base: r.base }));
}
export async function censusInput(db: Db, now: number): Promise<CensusInput> {
  const [captures, history] = await Promise.all([censusCaptures(db, now), censusHistory(db)]);
  return { captures, history };
}
/** Append the counts census stories run on (one row per story; a retry of the same story is ignored). */
export async function recordCensus(admin: Db, rows: CensusRow[]): Promise<number> {
  if (!rows.length) return 0;
  const { data, error } = await admin.from("census_counts").upsert(rows as never, { onConflict: "story_id", ignoreDuplicates: true }).select("id");
  if (error) throw new Error("census_counts_insert_failed");
  return data?.length ?? 0;
}
