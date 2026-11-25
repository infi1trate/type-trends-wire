// J1 · the weekly structure pass (a forecast follow-up step, never a request or the wire job): reads HOME captures newer than its
// bookmark by JSON path, keeps the better capture per brand, viewport and quarter, then rebuilds the per-quarter counts. Pages only
// read the stored rows (structure-read.server.ts). Service role; bounded by a time budget, resuming from the bookmark next time.
import { pagedRows } from "./paged";
import { buildSeries, pickRows, toRow, quarterOf, type RecordRow, type StructureInput } from "./structure";

const COLS = "id,domain,viewport,source,captured_at,nav:signals->nav,page:signals->page,skeleton:signals->skeleton,structure:signals->structure,accent:signals->color->>accent";
export const STRUCTURE_BUDGET_MS = 30_000;
const PAGE = 300;

export async function refreshStructure(o: { budgetMs?: number; now?: () => number } = {}): Promise<{ ok: boolean; read: number; stored: number; series: number | null; done: boolean; code?: string }> {
  const now = o.now ?? Date.now, start = now(), budget = o.budgetMs ?? STRUCTURE_BUDGET_MS;
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const st = await db.from("library_structure_state").select("last_snapshot_id").eq("id", 1).maybeSingle();
  if (st.error) return { ok: false, read: 0, stored: 0, series: null, done: false, code: "state_read_failed" };
  let cursor = Number(st.data?.last_snapshot_id ?? 0), read = 0, stored = 0, done = false;
  while (now() - start < budget * 0.6) {
    const r = await db.from("library_snapshots").select(COLS).eq("page_type", "home").gt("id", cursor).order("id").limit(PAGE);
    if (r.error) return { ok: false, read, stored, series: null, done: false, code: "snapshots_read_failed" };
    const batch = (r.data ?? []) as unknown as StructureInput[];
    if (!batch.length) { done = true; break; }
    read += batch.length;
    const fresh = pickRows(batch.map(toRow));
    // Compare with the stored row for the same keys so a weaker capture never replaces a better one.
    const domains = [...new Set(fresh.map(x => x.domain))], quarters = [...new Set(fresh.map(x => x.quarter))];
    const old = await db.from("library_structure_records").select("domain,viewport,quarter,snapshot_id,source,captured_at,structure_read,record,flags").in("domain", domains).in("quarter", quarters);
    if (old.error) return { ok: false, read, stored, series: null, done: false, code: "records_read_failed" };
    const winners = pickRows([...fresh, ...((old.data ?? []) as unknown as RecordRow[])]).filter(w => fresh.some(f => f.snapshot_id === w.snapshot_id && f.domain === w.domain && f.viewport === w.viewport));
    if (winners.length) {
      const w = await db.from("library_structure_records").upsert(winners.map(x => ({ ...x, record: x.record as never, flags: x.flags as never, derived_at: new Date(now()).toISOString() })), { onConflict: "domain,viewport,quarter" });
      if (w.error) return { ok: false, read, stored, series: null, done: false, code: "records_write_failed" };
      stored += winners.length;
    }
    cursor = batch[batch.length - 1]!.id;
    const s = await db.from("library_structure_state").upsert({ id: 1, last_snapshot_id: cursor, updated_at: new Date(now()).toISOString() });
    if (s.error) return { ok: false, read, stored, series: null, done: false, code: "state_write_failed" };
    if (batch.length < PAGE) { done = true; break; }
  }
  if (!done && stored === 0) return { ok: true, read, stored, series: null, done };
  const series = await rebuildSeries(db, now);
  return { ok: series != null, read, stored, series, done, ...(series == null ? { code: "series_failed" } : {}) };
}

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];
async function rebuildSeries(db: Admin, now: () => number): Promise<number | null> {
  const rows: Pick<RecordRow, "domain" | "viewport" | "quarter" | "flags">[] = [];
  for (let from = 0; from < 200_000; from += 1000) {
    const r = await db.from("library_structure_records").select("domain,viewport,quarter,flags").order("domain").order("viewport").order("quarter").range(from, from + 999);
    if (r.error) return null;
    rows.push(...((r.data ?? []) as unknown as typeof rows));
    if ((r.data ?? []).length < 1000) break;
  }
  const sites = await pagedRows((f, t) => db.from("library_sites").select("domain,sector,category,active").order("domain").range(f, t));
  if (sites.error) return null;
  const { classOf } = await import("./categories");
  const active = new Set((sites.data ?? []).filter(s => s.active !== false).map(s => s.domain));
  const classes = new Map((sites.data ?? []).map(s => [s.domain, { sector: s.sector ?? null, category: classOf(s).category }]));
  const latest = quarterOf(new Date(now()).toISOString());
  const series = buildSeries(rows.filter(r => active.has(r.domain)), classes, latest), at = new Date(now()).toISOString();
  for (let i = 0; i < series.length; i += 1000) {
    const w = await db.from("library_structure_series").upsert(series.slice(i, i + 1000).map(s => ({ ...s, computed_at: at })), { onConflict: "signal,viewport,scope,quarter" });
    if (w.error) return null;
  }
  // Rows no longer produced (a brand left, a reading replaced) go; only this run's rows stay.
  const d = await db.from("library_structure_series").delete().lt("computed_at", at);
  if (d.error) return null;
  await db.from("library_structure_state").upsert({ id: 1, series_at: at, updated_at: at });
  return series.length;
}
