// L1 · loads the colophon: the edition records (public SELECT reads), the leading brands' current measured fields, and today's dry
// run over them. Reads only; writes nothing (approve and roll back go through the editor's desk).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabaseAnon } from "../mcp/supabase";
import { readerRunId } from "../real-runs";
import { LIVE_EDITION, LIVE_VALUES, EDITION_STATUSES, newestFirst, type EditionRecord, type EditionStatus, type Move } from "./editions";
import { LEADING_TOP, dryRun, type DryRow, type LeadingRow } from "./rules";
import type { LivingValues } from "./settings";

type Db = SupabaseClient<Database>;
export type Colophon = { live: number; editions: EditionRecord[]; dry: { group: number; rows: DryRow[] } | null; leading: LeadingRow[]; runId: number | null; read_at: string;
  /** L3 · the stored monthly readings, newest first (absent on older records). */
  readings?: Pick<import("./reading").Reading, "month" | "signals" | "note" | "proposed_edition">[] };

/** Every stored edition with its moves and statuses (oldest status first). */
export async function loadEditions(db: Db): Promise<EditionRecord[]> {
  const [e, m, s] = await Promise.all([
    db.from("living_editions").select("number,dated,values,comparison").order("number").limit(1000),
    db.from("living_moves").select("edition,setting,old_value,new_value,signal,share,count,base,rule").order("id").limit(5000),
    db.from("living_edition_status").select("edition,status,at").order("at").order("id").limit(5000),
  ]);
  for (const r of [e, m, s]) if (r.error) throw r.error;
  const isStatus = (x: string): x is EditionStatus => (EDITION_STATUSES as readonly string[]).includes(x);
  return (e.data ?? []).map(x => ({
    number: x.number, dated: x.dated, values: x.values as unknown as LivingValues, comparison: (x.comparison ?? null) as unknown as EditionRecord["comparison"],
    moves: (m.data ?? []).filter(y => y.edition === x.number).map((y): Move => ({ setting: y.setting, from: y.old_value as never, to: y.new_value as never, signal: y.signal, share: y.share, count: y.count, base: y.base, rule: y.rule })),
    statuses: (s.data ?? []).filter(y => y.edition === x.number && isStatus(y.status)).map(y => ({ status: y.status as EditionStatus, at: y.at })),
  }));
}
/** The leading group's current measured fields: the reader run's top LEADING_TOP trendsetters that are active and have a current capture. */
export async function loadLeading(db: Db): Promise<{ runId: number | null; rows: LeadingRow[] }> {
  const run = await readerRunId(db);
  if (run < 0) return { runId: null, rows: [] };
  const ts = await db.from("trendsetters").select("domain,rank").eq("run_id", run).order("rank").limit(LEADING_TOP);
  if (ts.error) throw ts.error;
  const ranks = new Map((ts.data ?? []).map(t => [t.domain, t.rank]));
  if (!ranks.size) return { runId: run, rows: [] };
  const [sites, cur] = await Promise.all([
    db.from("library_sites").select("domain").in("domain", [...ranks.keys()]).eq("active", true),
    db.from("library_site_history").select("domain,captured_at,cta_radius_bucket,h1_tracking,whitespace_ratio").in("domain", [...ranks.keys()]).eq("now", true).order("captured_at", { ascending: false }).limit(500),
  ]);
  if (sites.error) throw sites.error; if (cur.error) throw cur.error;
  const active = new Set((sites.data ?? []).map(s => s.domain)), out = new Map<string, LeadingRow>();
  for (const r of cur.data ?? []) if (r.domain && active.has(r.domain) && !out.has(r.domain)) out.set(r.domain, { domain: r.domain, rank: ranks.get(r.domain)!, captured_at: r.captured_at, cta_radius_bucket: r.cta_radius_bucket, h1_tracking: r.h1_tracking, whitespace_ratio: r.whitespace_ratio });
  return { runId: run, rows: [...out.values()].sort((a, b) => a.rank - b.rank) };
}
export async function loadColophon(): Promise<Colophon> {
  const db = supabaseAnon();
  const [editions, leading, readings] = await Promise.all([loadEditions(db), loadLeading(db).catch(() => null), import("./reading.server").then(m => m.loadReadings(db)).catch(() => [])]);
  return { live: LIVE_EDITION.number, editions: newestFirst(editions), dry: leading ? dryRun(LIVE_VALUES, leading.rows) : null, leading: leading?.rows ?? [], runId: leading?.runId ?? null, read_at: new Date().toISOString(), readings };
}
