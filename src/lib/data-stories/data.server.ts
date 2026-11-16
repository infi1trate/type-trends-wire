// Loads what data stories draw from: anonymous SELECT-only reads of public tables and views, cached. No writes, no AI.
import { supabaseAnon } from "../mcp/supabase";
import type { CaptureRaw } from "./templates/frames";
import type { DataInput, EventRow, HistRow, SiteInfo, SnapMeta } from "./series";
import { MEASURED_EVENT_TYPES } from "../rebrands";
import type { CropRow } from "../crops";
import { memo, memoBy } from "../memo";
import { historyRows } from "../history.server";

type Db = ReturnType<typeof supabaseAnon>;
async function pages<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, size = 1000) {
  const out: T[] = [];
  for (let from = 0; ; from += size) { const { data, error } = await page(from, from + size - 1); if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < size) break; }
  return out;
}
export const HIST = "domain,quarter,captured_at,source,now,snapshot_id,sector,h1_family,body_family,theme,accent,page_bg,whitespace_ratio,hero_media,cta_radius_bucket,css_features,frameworks,webfont,h1_tracking,ai_tags,h1_size_px";
const paletteOf = (v: unknown) => (Array.isArray(v) ? v : []).map(p => { const r = (p && typeof p === "object" ? p : {}) as Record<string, unknown>; return { hex: typeof r["hex"] === "string" ? r["hex"] : "", share: typeof r["share"] === "number" ? r["share"] : 0 }; }).filter(p => /^#[0-9a-f]{6}$/i.test(p.hex));

async function snapMeta(db: Db, ids: number[]): Promise<SnapMeta[]> {
  const out: SnapMeta[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await db.from("library_snapshots").select("id,sk:signals->skeleton->0,palette:signals->color->palette").in("id", ids.slice(i, i + 150));
    if (error) throw error;
    for (const r of (data ?? []) as unknown as { id: number; sk: unknown; palette: unknown }[]) out.push({ id: r.id, skeleton: r.sk != null, palette: paletteOf(r.palette) });
  }
  return out;
}
async function load(): Promise<DataInput> {
  const db = supabaseAnon();
  const { readerRunId } = await import("../real-runs");
  const [sites, history, events, runId, crops, signals, stamps] = await Promise.all([
    pages<SiteInfo>((f, t) => db.from("library_sites").select("domain,name,sector,active").order("domain").range(f, t) as never),
    historyRows<HistRow>(db, HIST),
    pages<{ id: number; domain: string; type: string; source: string; effective_at: string | null; detected_at: string | null; snapshot_id: number | null }>((f, t) => db.from("library_events").select("id,domain,type,source,effective_at,detected_at,snapshot_id").eq("page_type", "home").eq("viewport", "desktop").in("type", [...MEASURED_EVENT_TYPES]).order("id").range(f, t) as never),
    readerRunId(db).catch(() => null),
    import("../read.server").then(m => m.allCrops()).catch(() => [] as CropRow[]),
    import("../signals.server").then(m => m.latestSignals("all")).catch(() => null),
    pages<{ domain: string; captured_at: string; source: string }>((f, t) => db.from("library_snapshots").select("domain,captured_at,source").eq("page_type", "home").eq("viewport", "desktop").order("id").range(f, t) as never),
  ]);
  const [snaps, rebrands] = await Promise.all([
    snapMeta(db, [...new Set(history.map(r => r.snapshot_id).filter((x): x is number => x != null))]),
    import("../rebrands.server").then(m => m.rebrandRows()).then(r => r.rows.map(x => ({ id: x.id, domain: x.domain, at: x.confirmed_at, source: x.source }))).catch(() => []),
  ]);
  const ev: EventRow[] = events.flatMap(e => { const at = e.effective_at ?? e.detected_at; return at ? [{ id: e.id, domain: e.domain, type: e.type, source: e.source, at, snapshot_id: e.snapshot_id }] : []; });
  return { now: Date.now(), sites, history, snaps, captures: stamps.map(c => ({ domain: c.domain, at: c.captured_at, source: c.source })), events: ev, rebrands, crops, runId: typeof runId === "number" && runId >= 0 ? runId : null,
    headline: (signals?.signals ?? []).filter(s => s.tier === "headline").map(s => ({ key: s.key, name: s.name })) };
}
const TTL = 10 * 60_000;
const input = memo(TTL, load);
/** Everything data stories draw from, cached per instance (settled values only; see memo.ts). */
export const dataInput = (): Promise<DataInput> => input();
/** The cached input when already loaded, without loading (the gallery reuses it). */
export const peekDataInput = (): DataInput | undefined => input.peek();

const CAP = "id,captured_at,source,page:signals->page,color:signals->color,skeleton:signals->skeleton,h1:signals->type->rendered->h1->>family,body:signals->type->rendered->body->>family,h1_size:signals->type->declared->h1->size_px,whitespace:signals->composition->whitespace_ratio,hero:signals->layout->>hero_media,radius:signals->layout->cta_radius_px,archive_url:signals->archive->>wayback_url";
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);
/** Every stored home/desktop capture of one brand (skeleton, colours, a few measured fields), oldest first. */
export const capturesOf = memoBy(TTL, async (domain: string): Promise<CaptureRaw[]> => {
  const { data, error } = await supabaseAnon().from("library_snapshots").select(CAP).eq("domain", domain).eq("page_type", "home").eq("viewport", "desktop").order("captured_at").limit(80);
  if (error) throw error;
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(r => ({ id: r["id"] as number, captured_at: r["captured_at"] as string, source: String(r["source"]), page: r["page"], color: r["color"], skeleton: r["skeleton"],
    h1: (r["h1"] as string | null) ?? null, body: (r["body"] as string | null) ?? null, h1_size: num(r["h1_size"]), whitespace: num(r["whitespace"]), hero: (r["hero"] as string | null) ?? null, radius: num(r["radius"]), archive_url: (r["archive_url"] as string | null) ?? null }));
}, { key: d => d, max: 60 });
export async function capturesFor(domains: string[]): Promise<Map<string, CaptureRaw[]>> {
  const out = new Map<string, CaptureRaw[]>();
  await Promise.all([...new Set(domains)].map(async d => { out.set(d, await capturesOf(d).catch(() => [])); }));
  return out;
}
