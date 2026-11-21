// W1b · the brand page's Surfaces block and Data table, the census input for "product page vs homepage", and the icon and card history.
// Anonymous SELECTs only: the latest live desktop capture of each surface page (measured fields by JSON path), the pictures index
// (icon, card, hero first screen, same addresses the page already shows) and the stored icon and card versions with their verdicts.
import { supabaseAnon } from "./mcp/supabase";
import { SURFACE_FIELDS, SURFACE_FIELD_NAME, SURFACE_NAME, SURFACE_PAGES, fieldText, latestSurfaces, matchLine, productLine, productPair, surfaceList, surfaceMatch, type SurfaceCapture, type SurfaceCrop, type SurfacePage, type BrandSurfaces, type SurfaceRow } from "./surfaces";
import { longDay } from "./pictures";

const COLS = "id,domain,page_type,captured_at,run_id,url,h1:signals->type->rendered->h1,body:signals->type->rendered->body,theme:signals->color->>theme,accent:signals->color->>accent";
type Row = Omit<SurfaceCapture, "h1" | "body"> & { h1: unknown; body: unknown };
const font = (v: unknown) => (v && typeof v === "object" && typeof (v as Record<string, unknown>)["family"] === "string" ? v as SurfaceCapture["h1"] : null);
const toCapture = (r: Row): SurfaceCapture => ({ ...r, run_id: r.run_id != null ? String(r.run_id) : null, h1: font(r.h1), body: font(r.body) });

/** Live desktop captures of the surface pages in the last `days` (one brand, or every brand when `domain` is null). */
export async function surfaceCaptures(o: { domain?: string | null; pages?: readonly string[]; days?: number; now?: number } = {}): Promise<SurfaceCapture[]> {
  const db = supabaseAnon(), since = new Date((o.now ?? Date.now()) - (o.days ?? 8) * 864e5).toISOString(), out: SurfaceCapture[] = [];
  for (let from = 0; from < 40000; from += 1000) {
    let q = db.from("library_snapshots").select(COLS).eq("source", "live").eq("viewport", "desktop").in("page_type", [...(o.pages ?? SURFACE_PAGES)]).gte("captured_at", since);
    if (o.domain) q = q.eq("domain", o.domain);
    const { data, error } = await q.order("id").range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as unknown as Row[]).map(toCapture));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** A failed read shows no block (the page is as it was before W1b). */
export const loadBrandSurfaces = (domain: string): Promise<BrandSurfaces> => brandSurfaces(domain).catch(() => ({ domain, show: false, list: [], matchLine: null, productLine: null, rows: [], fieldNames: [], history: [] }));
/** W1c · the brand's stored first screens of its other pages (anonymous: opted-out brands are hidden by policy), newest first, each
 *  marked blank when its measured quality says near-blank or flat. A failed read means no thumbnails. */
async function surfaceCrops(domain: string): Promise<SurfaceCrop[]> {
  const db = supabaseAnon(), { cropSrc, surfaceSectionOf } = await import("./crops");
  const r = await db.from("surface_crops").select("section,path,width,height,captured_at").eq("domain", domain).eq("viewport", "desktop").order("captured_at", { ascending: false }).limit(36);
  if (r.error || !r.data?.length) return [];
  const q = await db.from("crop_quality").select("path,lead_ok,reason").in("path", r.data.map(x => x.path));
  const blank = new Set((q.data ?? []).filter(x => !x.lead_ok && /near-blank|flat/.test(x.reason ?? "")).map(x => x.path));
  // Stored section values are mapped to their `page-` names; only surface_crops is read, never a homepage section crop.
  return r.data.flatMap(x => { const section = surfaceSectionOf(x.section); return section ? [{ section, path: x.path, src: cropSrc(x.path), width: x.width, height: x.height, captured_at: x.captured_at, blank: blank.has(x.path) }] : []; });
}
async function brandSurfaces(domain: string): Promise<BrandSurfaces> {
  const [captures, crops, { reportHref }, assets] = await Promise.all([
    surfaceCaptures({ domain, days: 30 }), surfaceCrops(domain).catch(() => []), import("./crops"),
    import("./asset-changes.server").then(m => m.assetHistory()).catch(() => null),
  ]);
  const latest = latestSurfaces(captures), home = latest.home ?? null;
  const others = SURFACE_PAGES.filter(p => p !== "home" && latest[p]);
  // W1c: one compact row per surface; a row shows a small first screen only once the crawler has sent one for that page.
  const list = surfaceList(latest, { domain, crops, report: reportHref(domain), day: longDay });
  const rows: SurfaceRow[] = SURFACE_PAGES.filter(p => latest[p]).map(p => { const c = latest[p]!; return { page: SURFACE_NAME[p as SurfacePage], fields: Object.fromEntries(SURFACE_FIELDS.map(k => [SURFACE_FIELD_NAME[k], fieldText(c, k)])), at: c.captured_at, url: c.url, match: p === "home" ? "this is home" : home ? surfaceMatch(home, c) : "not comparable" }; });
  const verdictOf = new Map((assets?.comparisons ?? []).filter(c => c.domain === domain).map(c => [c.to.path, c.verdict]));
  const { cropSrc } = await import("./crops");
  const mine = (assets?.versions ?? []).filter(v => v.domain === domain).sort((a, b) => a.kind.localeCompare(b.kind) || a.first_seen_at.localeCompare(b.first_seen_at));
  const history = mine.map(v => ({ kind: v.kind === "icon" ? "Site icon" : "Social card", version: mine.filter(x => x.kind === v.kind && x.first_seen_at <= v.first_seen_at).length, first: v.first_seen_at, last: v.last_seen_at, src: cropSrc(v.path), width: v.width, height: v.height, verdict: verdictOf.get(v.path) ?? null }));
  return { domain, show: others.length > 0, list, matchLine: matchLine(list), productLine: productLine(productPair(captures), longDay), rows, fieldNames: SURFACE_FIELDS.map(k => SURFACE_FIELD_NAME[k]), history };
}
