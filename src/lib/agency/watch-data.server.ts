// Public (anonymous, SELECT-only) reads behind a watch page / feed. Only the watchlist row itself needs the service role.
import { supabaseAnon } from "../mcp/supabase";
import { siteTraits, type SiteRow } from "../forecast-signals";
import type { ThumbRow } from "../thumbs";
import type { EventRow, RebrandRow } from "./changes";
import type { WatchPublic } from "./watch";
import { FEED_DAYS, type AlertRow, type RunRow, type SiteInfo, type StageRow, type TraitNow, type WatchRows } from "./watch-feed";
import { fetchRealRuns, readerRunId } from "../real-runs";
import { gapChain } from "../run-gap";

const must = <T,>(r: { data: T; error: unknown }) => { if (r.error) throw r.error; return r.data; };
async function pages<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, size = 500, max = 20) {
  const out: T[] = [];
  for (let i = 0, from = 0; i < max; i++, from += size) { const { data, error } = await page(from, from + size - 1); if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < size) break; }
  return out;
}
const EVENT_COLS = "id,domain,type,before,after,detected_at,source,page_type,viewport,sector,summary";

export async function loadWatchRows(w: WatchPublic, now: Date): Promise<WatchRows> {
  // R2a-2 · watched addresses outside the panel read nothing from the change feed (the view has no active filter).
  const panelSet = await (await import("../active-sites.server")).panelDomains();
  const db = supabaseAnon(), domains = [...new Set([...w.sites, ...w.pending_sites])], feedDomains = domains.filter(d => panelSet.has(d)), readerRun = await readerRunId(db);
  const since = new Date(+now - FEED_DAYS * 864e5).toISOString();
  const none = Promise.resolve([] as never[]);
  const [sites, events, lastEvent, history, thumbs, chain, alerts, latestAll] = await Promise.all([
    domains.length ? db.from("library_sites").select("domain,sector,name,last_change_at").in("domain", domains).then(must) : none,
    feedDomains.length ? pages<EventRow>((f, t) => db.from("library_event_feed").select(EVENT_COLS).in("domain", feedDomains).eq("source", "live").eq("viewport", "desktop").gte("detected_at", since).order("detected_at", { ascending: false }).order("id", { ascending: false }).range(f, t) as never, 500, 2) : none,
    feedDomains.length ? db.from("library_event_feed").select(EVENT_COLS).in("domain", feedDomains).eq("source", "live").eq("viewport", "desktop").order("detected_at", { ascending: false }).limit(1).then(must) : none,
    w.sites.length ? db.from("library_site_history_rows").select("domain,quarter,sector,theme,h1_family,webfont,h1_tracking,css_features,frameworks,hero_media,ai_tags").in("domain", w.sites).eq("now", true).then(must) : none,
    domains.length ? db.from("site_thumbs").select("domain,captured_at,viewport,path,width,height,bytes,variants").in("domain", domains).order("captured_at", { ascending: false }).limit(100).then(must) : none,
    // Run-to-run changes use real runs only, chained under the gap rule (run-gap.ts), like every other reader surface.
    fetchRealRuns(db, { limit: 40 }).then(rs => { const chain = gapChain(rs).map(r => ({ id: r.id, computed_at: r.at })); return { inside: chain.filter(r => r.computed_at >= since), before: chain.filter(r => r.computed_at < since).slice(-1) }; }),
    db.from("wire_items").select("id,title,ref,url,published_at").eq("source_kind", "alert").not("ref", "is", null).gte("published_at", since).order("published_at", { ascending: false }).limit(300).then(must),
    pages<TraitNow & { scope: string }>((f, t) => db.from("forecasts").select("dimension,value,scope,stage,current_share").eq("run_id", readerRun).eq("scope", "all").order("dimension").order("value").range(f, t) as never),
  ]);
  const runList = [...chain.before, ...chain.inside];
  const ids = runList.map(r => r.id);
  const [briefs, stages] = await Promise.all([
    ids.length ? db.from("weekly_briefs").select("week,run_id").in("run_id", ids).then(must) : none,
    ids.length ? pages<StageRow>((f, t) => db.from("forecasts").select("run_id,dimension,value,scope,stage,current_share").in("run_id", ids).in("scope", ["all", ...w.sectors]).order("run_id").order("scope").order("dimension").order("value").range(f, t) as never, 1000, 40) : none,
  ]);
  const weekOf = new Map((briefs ?? []).map(b => [b.run_id, b.week]));
  const runs: RunRow[] = runList.map(r => ({ id: r.id, computed_at: r.computed_at, week: weekOf.get(r.id) ?? null }));
  const { readerRebrands: rebrandRows } = await import("../rebrands.server");
  const rb = (await rebrandRows()).rows.filter(x => x.source === "live" && domains.includes(x.domain) && x.confirmed_at >= since)
    .map((x): RebrandRow => ({ domain: x.domain, sector: x.sector, name: x.name, confirmed_at: x.confirmed_at, read: x.read, reasons: x.reasons, seasonal: x.seasonal }));
  const traitsBy: Record<string, string[]> = {};
  for (const h of (history ?? []) as SiteRow[]) if (h.domain) traitsBy[h.domain] = siteTraits(h);
  return {
    watch: w, now: now.toISOString(),
    events: events as EventRow[], rebrands: rb, runs, stages: stages as StageRow[], alerts: (alerts ?? []) as AlertRow[],
    siteTraits: traitsBy, sites: (sites ?? []) as SiteInfo[], thumbs: (thumbs ?? []) as ThumbRow[],
    traitsNow: latestAll.filter(t => w.traits.includes(`${t.dimension}:${t.value}`)),
    lastEvent: ((lastEvent ?? [])[0] as EventRow | undefined) ?? null,
  };
}
