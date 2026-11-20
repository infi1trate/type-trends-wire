// Rebrand Desk reads (anonymous, SELECT-only) shared by F9 and the MCP `rebrands` tool; derived fields only, no page text or images.
import { supabaseAnon } from "./mcp/supabase";
import { buildRebrands, filterRebrands, rebrandCounts, MEASURED_EVENT_TYPES, MAX_REBRAND_LIMIT, type Rebrand, type EventIn, type SideIn, type ForecastIn, type WireIn } from "./rebrands";
import { readerRunId } from "./real-runs";
import { memo } from "./memo";
import { PROMO_COLS, promoTexts } from "./promo";
type Db = ReturnType<typeof supabaseAnon>;
async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) { const { data, error } = await page(from, from + 999); if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < 1000) break; }
  return out;
}
const str = (v: unknown) => (typeof v === "string" && v ? v : null);
async function load(db: Db): Promise<{ rows: Rebrand[]; data_through: string | null }> {
  const runId = await readerRunId(db);
  const [events, sites, forecasts, wire, fonts] = await Promise.all([
    all<EventIn>((f, t) => db.from("library_events").select("id,domain,source,type,before,after,effective_at,detected_at,snapshot_id,prev_snapshot_id").in("type", [...MEASURED_EVENT_TYPES]).eq("page_type", "home").eq("viewport", "desktop").order("id").range(f, t) as never),
    all<{ domain: string; sector: string; name: string | null }>((f, t) => db.from("library_sites").select("domain,sector,name").order("domain").range(f, t) as never),
    all<ForecastIn>((f, t) => db.from("forecasts").select("dimension,value,scope,stage,status,current_share,momentum").eq("run_id", runId).eq("status", "ok").order("dimension").order("value").order("scope").range(f, t) as never),
    all<WireIn>((f, t) => db.from("wire_items").select("id,title,excerpt,url,source,source_kind,published_at").neq("source_kind", "alert").order("id").range(f, t) as never),
    all<{ family: string }>((f, t) => db.from("font_catalog").select("family").eq("source", "google").order("key").range(f, t) as never),
  ]);
  const ids = [...new Set(events.flatMap(e => [e.snapshot_id, e.prev_snapshot_id]).filter((x): x is number => x != null))];
  const snaps: SideIn[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const [s, tg] = await Promise.all([
      db.from("library_snapshots").select(`id,captured_at,h1:signals->type->rendered->h1->>family,body:signals->type->rendered->body->>family,theme:signals->color->>theme,bg:signals->color->>page_bg,accent:signals->color->>accent,palette:signals->color->palette,hero_media:signals->layout->>hero_media,archive_url:signals->archive->>wayback_url,${PROMO_COLS}`).in("id", chunk),
      db.from("library_tags").select("snapshot_id,tags").in("snapshot_id", chunk),
    ]);
    if (s.error || tg.error) throw s.error ?? tg.error;
    const tags = new Map((tg.data ?? []).map(t => [t.snapshot_id, t.tags as Record<string, unknown> | null]));
    for (const r of (s.data ?? []) as unknown as Record<string, unknown>[]) {
      const t = tags.get(r["id"] as number), ok = t && !t["blocked_reason"] && !t["low_confidence"] && (typeof t["confidence"] !== "number" || t["confidence"] >= 0.4);
      snaps.push({ id: r["id"] as number, captured_at: str(r["captured_at"]), h1: str(r["h1"]), body: str(r["body"]), theme: str(r["theme"]), bg: str(r["bg"]), accent: str(r["accent"]), palette: Array.isArray(r["palette"]) ? (r["palette"] as unknown[]).map(x => (typeof x === "string" ? x : x && typeof x === "object" ? (x as { hex?: unknown }).hex : null)).filter((x): x is string => typeof x === "string") : [], hero_media: str(r["hero_media"]), archive_url: str(r["archive_url"]), promo: promoTexts(r),
        tags: ok ? { hero_layout: str(t!["hero_layout"]), aesthetic: Array.isArray(t!["aesthetic"]) ? (t!["aesthetic"] as string[]) : [], tone: Array.isArray(t!["tone"]) ? (t!["tone"] as string[]) : [] } : null });
    }
  }
  const rows = buildRebrands({ events, sites, snapshots: snaps, forecasts, wire, google: new Set(fonts.map(f => f.family.toLowerCase())) });
  return { rows, data_through: events.map(e => e.detected_at).sort().at(-1) ?? null };
}
const CACHE_MS = 10 * 60_000;
const rows = memo(CACHE_MS, () => load(supabaseAnon()));
export const rebrandRows = (): Promise<{ rows: Rebrand[]; data_through: string | null }> => rows();
export type RebrandFilter = { sector?: string | undefined; source?: "live" | "archive" | undefined; year?: number | undefined; since?: string | undefined; limit?: number | undefined; offset?: number | undefined };
export async function rebrands(f: RebrandFilter, maxLimit = 200) {
  const { rows, data_through } = await rebrandRows();
  const scoped = filterRebrands(rows, f), limit = Math.min(Math.max(f.limit ?? 25, 1), maxLimit), offset = Math.max(f.offset ?? 0, 0);
  const years = [...new Set(rows.map(r => Number(r.confirmed_at.slice(0, 4))))].sort((a, b) => b - a);
  return { counts: rebrandCounts(rows), filtered: { ...rebrandCounts(scoped), total: scoped.length }, years, data_through, offset, limit, rows: scoped.slice(offset, offset + limit) };
}
export const MCP_REBRAND_LIMIT = MAX_REBRAND_LIMIT;
