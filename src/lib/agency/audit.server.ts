// Competitive audit loader: anonymous SELECT-only reads for tracked sites; the render queue (service role) only for untracked domains.
import { supabaseAnon } from "../mcp/supabase";
import { pickCrawlRow } from "../crawl-requests";
import type { ThumbRow } from "../thumbs";
import type { EventRow, RebrandRow } from "./changes";
import { auditModel, MOVES_DAYS, type AuditRows, type AuditSiteIn, type ForecastIn, type SiteStatus } from "./audit";
import { readerRunId } from "../real-runs";

const must = <T,>(r: { data: T; error: unknown }) => { if (r.error) throw r.error; return r.data; };
async function pages<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, size = 1000) {
  const out: T[] = [];
  for (let from = 0; from < 20000; from += size) { const { data, error } = await page(from, from + size - 1); if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < size) break; }
  return out;
}

/** Untracked domains: their render-queue state (rendered signals are reused; pending stays pending). */
async function queueState(domains: string[], now: number): Promise<Map<string, { status: SiteStatus; signals: unknown; at: string | null }>> {
  const out = new Map<string, { status: SiteStatus; signals: unknown; at: string | null }>();
  if (!domains.length) return out;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const r = await supabaseAdmin.from("crawl_requests").select("url,domain,status,signals,rendered_at,done_at").in("domain", domains.flatMap(d => [d, `www.${d}`]));
  if (r.error) throw r.error;
  for (const d of domains) {
    const pick = pickCrawlRow((r.data ?? []).filter(x => x.domain.replace(/^www\./, "") === d), `https://${d}/`, now);
    out.set(d, pick.state === "rendered" ? { status: "rendered", signals: pick.row!.signals, at: pick.row!.rendered_at ?? null } : pick.state === "pending" ? { status: "pending", signals: null, at: null } : { status: "unknown", signals: null, at: null });
  }
  return out;
}

export async function checkDomains(domains: string[]) {
  const db = supabaseAnon();
  const lib = domains.length ? must(await db.from("library_sites").select("domain,sector,name,active").in("domain", domains)) ?? [] : [];
  const active = new Map(lib.filter(s => s.active).map(s => [s.domain, s]));
  const q = await queueState(domains.filter(d => !active.has(d)), Date.now());
  return domains.map(d => ({ domain: d, status: (active.has(d) ? "tracked" : q.get(d)?.status ?? "unknown") as SiteStatus, sector: active.get(d)?.sector ?? null, name: active.get(d)?.name ?? null }));
}

export async function auditRows(domains: string[], sector: string | null, now = new Date()): Promise<AuditRows> {
  const db = supabaseAnon(), since = new Date(+now - MOVES_DAYS * 864e5).toISOString();
  const [lib, history, events, thumbs, run] = await Promise.all([
    db.from("library_sites").select("domain,sector,name,active,last_snapshot_at,last_change_at").in("domain", domains).then(must),
    db.from("library_site_history_rows").select("domain,theme,h1_family,webfont,h1_tracking,css_features,frameworks,hero_media,ai_tags").in("domain", domains).eq("now", true).then(must),
    db.from("library_event_feed").select("id,domain,type,before,after,detected_at,source,page_type,viewport,sector,summary").in("domain", domains).eq("source", "live").eq("viewport", "desktop").gte("detected_at", since).order("detected_at", { ascending: false }).limit(300).then(must),
    db.from("site_thumbs").select("domain,captured_at,viewport,path,width,height,bytes,variants").in("domain", domains).order("captured_at", { ascending: false }).limit(60).then(must),
    db.from("forecast_runs").select("id,data_through:model_card->>data_through").eq("status", "ok").order("id", { ascending: false }).limit(1).maybeSingle().then(must),
  ]);
  const active = new Map((lib ?? []).filter(s => s.active).map(s => [s.domain, s]));
  const snaps = await Promise.all([...active.keys()].map(d => db.from("library_snapshots").select("domain,captured_at,signals").eq("domain", d).eq("page_type", "home").eq("viewport", "desktop").eq("source", "live").order("captured_at", { ascending: false }).limit(1).then(must)));
  const snapBy = new Map(snaps.flatMap(s => s ?? []).map(s => [s.domain, s]));
  const histBy = new Map((history ?? []).map(h => [h.domain, h]));
  const queue = await queueState(domains.filter(d => !active.has(d)), +now);
  const sites: AuditSiteIn[] = domains.map(d => {
    const s = active.get(d);
    if (s) { const snap = snapBy.get(d), h = histBy.get(d);
      return { domain: d, status: "tracked", site: { sector: s.sector, name: s.name, last_snapshot_at: s.last_snapshot_at, last_change_at: s.last_change_at }, signals: snap?.signals ?? null, captured_at: snap?.captured_at ?? s.last_snapshot_at, history: h ? { theme: h.theme, h1_family: h.h1_family, webfont: h.webfont, h1_tracking: h.h1_tracking, css_features: h.css_features, frameworks: h.frameworks, hero_media: h.hero_media, ai_tags: h.ai_tags } : null }; }
    const q = queue.get(d) ?? { status: "unknown" as const, signals: null, at: null };
    return { domain: d, status: q.status, site: null, signals: q.signals, captured_at: q.at, history: null };
  });
  const sectors = [...new Set(["all", ...(lib ?? []).map(s => s.sector), ...(sector ? [sector] : [])])];
  const runId = await readerRunId(db);
  const forecasts = await pages<ForecastIn>((f, t) => db.from("forecasts").select("dimension,value,scope,stage,current_share,momentum").eq("run_id", runId).in("scope", sectors).order("scope").order("dimension").order("value").range(f, t) as never);
  const families = [...new Set(sites.flatMap(s => ["h1", "body"].map(k => { const v = (s.signals as { type?: { rendered?: Record<string, { family?: unknown }> } } | null)?.type?.rendered?.[k]?.family; return typeof v === "string" ? v : null; })).filter((x): x is string => !!x))];
  const [google, rebrandAll] = await Promise.all([
    families.length ? db.from("font_catalog").select("family").eq("source", "google").in("family", families).then(must) : Promise.resolve([]),
    import("../rebrands.server").then(m => m.readerRebrands()),
  ]);
  const rebrands: RebrandRow[] = rebrandAll.rows.filter(x => x.source === "live" && domains.includes(x.domain)).map(x => ({ domain: x.domain, sector: x.sector, name: x.name, confirmed_at: x.confirmed_at, read: x.read, reasons: x.reasons, effective_at: x.effective_at, seasonal: x.seasonal }));
  return { domains, sector, now: now.toISOString(), sites, events: (events ?? []) as EventRow[], rebrands, forecasts, google: (google ?? []).map(g => g.family), thumbs: (thumbs ?? []) as ThumbRow[], dataThrough: (run as { data_through?: string | null } | null)?.data_through ?? null };
}
export async function loadAudit(domains: string[], sector: string | null) { return auditModel(await auditRows(domains, sector)); }

/** /audit.png?sites=… — names and capture date only. */
export async function auditImage(url: URL): Promise<Response> {
  const nf = () => new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const { parseAuditSites } = await import("./audit");
  const p = parseAuditSites(url.searchParams.get("sites"));
  if (!p.ok) return nf();
  const lib = must(await supabaseAnon().from("library_sites").select("last_snapshot_at").in("domain", p.domains).eq("active", true)) ?? [];
  const captured = lib.map(s => s.last_snapshot_at).filter((x): x is string => !!x).sort().at(-1) ?? null;
  const { auditOgScene } = await import("./og");
  const { renderScenePng } = await import("../chart/raster");
  const { CARD_CACHE } = await import("../chart/http.server");
  const png = await renderScenePng(auditOgScene(p.domains, captured));
  return new Response(png as BodyInit, { headers: { "Content-Type": "image/png", "Cache-Control": CARD_CACHE, "Content-Length": String(png.length) } });
}
