import { supabaseAnon } from "./mcp/supabase";
import { fingerprint, sectorMetrics } from "./library";
import { byCrawl, crawlStamp } from "./crawl-stamp.server";
import { memoBy } from "./memo";
/** Latest capture per site; cached per instance until the next crawl (`byCrawl`). */
export const libraryRows = byCrawl(loadLibraryRows);
async function loadLibraryRows() {
  const db = supabaseAnon();
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("library_latest").select("*").order("domain").range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}
export async function libraryEvents(opts: { sector?: string | undefined; type?: string | undefined; since_days: number; limit: number; domain?: string | undefined }) {
  let q = supabaseAnon().from("library_event_feed").select("*").gte("detected_at", new Date(Date.now() - opts.since_days * 86400000).toISOString());
  if (opts.sector) q = q.eq("sector", opts.sector);
  if (opts.type) q = q.eq("type", opts.type);
  if (opts.domain) q = q.eq("domain", opts.domain);
  const { data, error } = await q.order("detected_at", { ascending: false }).order("id", { ascending: false }).range(0, opts.limit - 1);
  if (error) throw error;
  return data ?? [];
}
/** Sector summaries; cached per instance until the next crawl (`byCrawl`). */
export const librarySectors = byCrawl(async () => {
  const { data, error } = await supabaseAnon().from("library_sector_stats").select("*").order("sector").range(0, 999);
  if (error) throw error;
  return data ?? [];
});
/** A brand's (or a sector's) captures with full signals; cached per instance until the next crawl, per argument pair. */
export const librarySnapshots = async (domain?: string, sector?: string) =>
  snapshotsByCrawl({ domain: domain ?? null, sector: sector ?? null, stamp: await crawlStamp().catch(() => `minute:${Math.floor(Date.now() / 60_000)}`) });
const snapshotsByCrawl = memoBy(3_600_000, async (k: { domain: string | null; sector: string | null; stamp: string }) => loadLibrarySnapshots(k.domain ?? undefined, k.sector ?? undefined), { max: 200 });
async function loadLibrarySnapshots(domain?: string, sector?: string) {
  const db = supabaseAnon();
  let domains: string[] | undefined;
  if (sector) domains = (await libraryRows()).filter(r => r.sector === sector).map(r => r.domain).filter((v): v is string => !!v);
  if (domains?.length === 0) return [];
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let q = db.from("library_snapshots").select("id,domain,page_type,viewport,source,captured_at,url,signals");
    if (domain) q = q.eq("domain", domain);
    if (domains) q = q.in("domain", domains).eq("page_type", "home").eq("viewport", "desktop");
    const { data, error } = await q.order("captured_at", { ascending: false }).order("id", { ascending: false }).range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}
export async function librarySector(sector: string) {
  const [stats, snapshots] = await Promise.all([librarySectors(), librarySnapshots(undefined, sector)]);
  const latest = [...new Map([...snapshots].filter(s=>s.source==="live").reverse().map(s => [s.domain, s])).values()];
  const fonts = (role: "h1_family" | "body_family") => {
    const counts = new Map<string, number>();
    for (const s of latest) { const family = fingerprint(s.signals)[role]; if (family) counts.set(family, (counts.get(family) ?? 0) + 1); }
    return [...counts].map(([family, sites]) => ({ family, sites })).sort((a, b) => b.sites - a.sites || a.family.localeCompare(b.family));
  };
  const theme_split = { dark: 0, light: 0, unknown: 0 };
  for (const s of latest) { const t = fingerprint(s.signals).theme; if (t === "dark" || t === "light") theme_split[t]++; else theme_split.unknown++; }
  return { sector, stats: stats.find(s => s.sector === sector) ?? null, top_fonts: { h1: fonts("h1_family"), body: fonts("body_family") }, theme_split, comparison: sectorMetrics(latest.map(s => s.signals)) };
}
export async function librarySite(domain: string) {
  const { data: site, error } = await supabaseAnon().from("library_sites").select("domain,sector,name,active,last_snapshot_at,last_change_at,pages").eq("domain", domain).maybeSingle();
  if (error) throw error;
  if (!site) return null;
  const [snapshots, events, sector, pending] = await Promise.all([librarySnapshots(domain), siteTimeline(domain), librarySector(site.sector), libraryPending(domain)]);
  const { aiSite } = await import("./ai-public-store.server");
  const {siteHistory}=await import("./library-history.server");
  return { site, snapshots, events, sector, pending, ai: await aiSite(domain),history:await siteHistory(domain) };
}
async function siteTimeline(domain:string) {
 const rows=[];
 for(let from=0;;from+=1000){const {data,error}=await supabaseAnon().from("library_events").select("*").eq("domain",domain).order("effective_at",{ascending:false}).order("id",{ascending:false}).range(from,from+999);if(error)throw error;rows.push(...(data??[]));if(!data||data.length<1000)break;}
 // E2e: each live change carries its integrity verdict, so the record marks what is not in the latest changes (integrity.ts).
 const checks=await (await import("./integrity.server")).latestChecks(supabaseAnon(),rows.filter(r=>r.source==="live").map(r=>r.id)).catch(()=>null);
 // I3: a re-read (AI labels changed, no measured look field did) or a failed measurement carries its reason; it is not a change.
 return rows.map(r=>{const c=r.source!=="live"?null:checks?.get(r.id)??null;const marked=c&&(c.verdict==="reread"||c.verdict==="not_measured")?Object.values(c.marks??{})[0]?.reason??null:null;return {...r,check:r.source!=="live"?null:c?.verdict??"unchecked",mark_reason:marked};});
}
async function libraryPending(domain: string) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAnon().from("library_pending").select("domain,page_type,viewport,field,from,to,first_seen_at").eq("domain", domain).order("page_type").order("viewport").order("field").range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}
export async function currentSpread(scope: "en" | "all") {
  const { data, error } = await supabaseAnon().from("crawl_spread").select("*").eq("scope", scope).order("spread_pts", { ascending: false }).range(0, 999);
  if (error) throw error;
  return data ?? [];
}