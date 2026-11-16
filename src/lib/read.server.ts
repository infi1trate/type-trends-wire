// Read-mode loaders (Live, brands, patterns, signal series): anonymous SELECT-only reads assembled by pure models. No AI per view.
import { supabaseAnon } from "./mcp/supabase";
import { forecastSiteTraits, type SiteRow } from "./forecast-signals";
import { latestSignals } from "./signals.server";
import { rowKey } from "./signals";
import { label, basis, stageName } from "./labels";
import { fromAlert, fromEvent, fromLaunch, fromRebrand, fromStageChange, fromWire, storyStream, type Story } from "./stories";
import { brandModel, type BrandRows } from "./brand";
import { patternIndex, patternModel, type PatternSite } from "./patterns";
import { lensSignals, resolveSector } from "./sector-lens";
import { signalPath } from "./ia";
import { decodeEntities } from "./entities";
import type { ThumbRow } from "./thumbs";
import type { EventRow, RebrandRow } from "./agency/changes";

const must = <T,>(r: { data: T; error: unknown }) => { if (r.error) throw r.error; return r.data; };
async function pages<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, size = 500) {
  const out: T[] = [];
  for (let from = 0; from < 20000; from += size) { const { data, error } = await page(from, from + size - 1); if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < size) break; }
  return out;
}
/** Per-instance memo with the public TTL pattern (failed loads are not cached). */
function memo<T>(ms: number, load: () => Promise<T>) {
  let c: { at: number; v: Promise<T> } | null = null;
  return () => { if (!c || Date.now() - c.at > ms) { const v = load(); c = { at: Date.now(), v }; v.catch(() => { c = null; }); } return c.v; };
}
const TTL = 5 * 60_000;
/** Design news is capped so brand moves, rebrands and signal stories are not crowded out of the stream (ranking arrives next phase). */
export const NEWS_MAX = 12;
const day = 864e5;

/** Every active brand's current traits (forecastSiteTraits over its latest library history row), name, sector and capture date. */
export const siteTraitIndex = memo(10 * 60_000, async (): Promise<PatternSite[]> => {
  const db = supabaseAnon();
  const [sites, hist] = await Promise.all([
    pages<{ domain: string; name: string | null; sector: string; active: boolean; last_snapshot_at: string | null }>((f, t) => db.from("library_sites").select("domain,name,sector,active,last_snapshot_at").order("domain").range(f, t) as never),
    pages<SiteRow & { captured_at: string | null }>((f, t) => db.from("library_site_history").select("domain,quarter,sector,captured_at,theme,h1_family,webfont,h1_tracking,css_features,frameworks,hero_media,ai_tags,h1_size_px,cta_radius_bucket,whitespace_ratio").eq("now", true).order("domain").range(f, t) as never, 200),
  ]);
  const h = new Map(hist.map(r => [r.domain, r]));
  return sites.filter(s => s.active).map(s => { const r = h.get(s.domain); return { domain: s.domain, name: s.name, sector: s.sector, captured: r?.captured_at ?? s.last_snapshot_at, traits: r ? [...new Set(forecastSiteTraits({ ...r, sector: s.sector }))] : [] }; });
});
export const allThumbs = memo(10 * 60_000, () => pages<ThumbRow>((f, t) => supabaseAnon().from("site_thumbs").select("domain,captured_at,viewport,path,width,height,bytes,variants").order("id").range(f, t) as never));

/** Every story source, newest first and unfiltered (tier filtering and the lens happen in storyStream). */
export const allStories = memo(TTL, async (): Promise<{ stories: Story[]; updatedAt: string | null; runAt: string | null }> => {
  const db = supabaseAnon(), now = Date.now(), since = (d: number) => new Date(now - d * day).toISOString();
  const [{ snap }, alerts, events, rebrandAll, wire, launches] = await Promise.all([
    latestSignals("all"),
    db.from("wire_items").select("title,url,published_at,ref").eq("source_kind", "alert").gte("published_at", since(30)).order("published_at", { ascending: false }).limit(40).then(must),
    db.from("library_event_feed").select("id,domain,type,before,after,detected_at,source,page_type,viewport,sector,summary").eq("source", "live").eq("viewport", "desktop").neq("type", "new_surface").gte("detected_at", since(30)).order("detected_at", { ascending: false }).limit(120).then(must),
    import("./rebrands.server").then(m => m.rebrandRows()),
    db.from("wire_items").select("id,title,url,source,source_kind,published_at,excerpt").in("source_kind", ["rss", "hn", "bluesky"]).gte("published_at", since(7)).lte("published_at", new Date(now).toISOString()).order("published_at", { ascending: false }).limit(NEWS_MAX).then(must),
    db.from("wire_items").select("id,title,url,published_at,excerpt").eq("source_kind", "producthunt").gte("published_at", since(30)).order("published_at", { ascending: false }).limit(12).then(must),
  ]);
  const prev = new Map(snap.prev);
  const shifts = snap.run_id == null || !snap.computed_at ? [] : snap.rows.filter(r => r.scope === "all").flatMap(r => {
    const before = prev.get(rowKey(r))?.[0] ?? null;
    return before && r.stage && stageName(before) !== stageName(r.stage) ? [fromStageChange({ trait: rowKey(r), from: before, to: r.stage, share: r.current_share }, snap.run_id!, snap.computed_at!)] : [];
  });
  const stories = [
    ...shifts,
    ...(alerts ?? []).map(a => fromAlert({ ...a, title: decodeEntities(a.title) })),
    ...((events ?? []) as EventRow[]).map(fromEvent),
    ...rebrandAll.rows.filter(x => x.source === "live" && Date.parse(x.confirmed_at) >= now - 120 * day).map(x => fromRebrand(x as RebrandRow)),
    // Only RSS excerpts read as prose; Hacker News and Bluesky excerpts are counts and links.
    ...(wire ?? []).map(w => fromWire({ ...w, title: decodeEntities(w.title), excerpt: w.excerpt && w.source_kind === "rss" ? decodeEntities(w.excerpt) : null })),
    ...(launches ?? []).map(w => fromLaunch({ ...w, title: decodeEntities(w.title), excerpt: w.excerpt ? decodeEntities(w.excerpt) : null })),
  ];
  const updatedAt = stories.map(s => s.at).filter(at => Date.parse(at) <= now).sort().at(-1) ?? null;
  return { stories, updatedAt, runAt: snap.computed_at };
});

/** `/` Live: lead story, the stream (30 a page), moving now, chart of the week, new on the scene. */
export async function loadLive(sector: string, page: number) {
  const [{ stories, updatedAt, runAt }, { snap, tiers }, chart] = await Promise.all([allStories(), latestSignals("all"), import("./chart/chart.server").then(m => m.chartCard(null)).catch(() => null)]);
  const headline = new Set([...tiers.values()].filter(t => t.tier === "headline").map(t => t.key));
  const s = resolveSector(sector);
  const stream = storyStream(stories.filter(x => x.type !== "launch"), { headline, sector: s, page });
  const lens = lensSignals(snap.rows, tiers, s), byKey = new Map(lens.signals.map(x => [x.key, x])), prev = new Map(snap.prev);
  const moving = snap.rows.filter(r => r.scope === "all" && headline.has(rowKey(r))).flatMap(r => {
    const before = stageName(prev.get(rowKey(r))?.[0] ?? null), to = stageName(r.stage), k = rowKey(r), x = byKey.get(k);
    return before && to && before !== to ? [{ key: k, name: label(k).name, dimension: label(k).dimension, basis: basis(k), from: before, to, share: r.current_share, momentum_index: x?.momentum_index ?? null, href: signalPath(k) }] : [];
  }).sort((a, b) => (b.momentum_index ?? -1) - (a.momentum_index ?? -1) || a.name.localeCompare(b.name));
  const launches = stories.filter(x => x.type === "launch").slice(0, 6);
  return { sector: s, ...stream, moving, launches, chart: chart ? { week: chart.week, trait: chart.trait, model: chart.model } : null, updatedAt, runAt, runId: snap.run_id };
}

/** /brands/<domain>: null when the domain is not an active library brand. */
export async function loadBrand(domain: string) {
  const db = supabaseAnon();
  const site = must(await db.from("library_sites").select("domain,active").eq("domain", domain).maybeSingle());
  if (!site?.active) return null;
  const { auditRows } = await import("./agency/audit.server");
  const [audit, events, index, { tiers }] = await Promise.all([
    auditRows([domain], null),
    db.from("library_event_feed").select("id,domain,type,before,after,detected_at,source,page_type,viewport,sector,summary").eq("domain", domain).eq("source", "live").eq("viewport", "desktop").neq("type", "new_surface").order("detected_at", { ascending: false }).limit(80).then(must),
    siteTraitIndex(),
    latestSignals("all"),
  ]);
  const own = index.find(s => s.domain === domain);
  const rows: BrandRows = { domain, audit, events: (events ?? []) as EventRow[], peers: index.filter(s => s.sector === own?.sector).map(s => ({ domain: s.domain, name: s.name, sector: s.sector, traits: s.traits })), tiers: [...tiers.values()].map(t => [t.key, t.tier]) };
  return brandModel(rows);
}

/** /brands: the directory plus recent moves across every brand. */
export async function loadBrands() {
  const db = supabaseAnon();
  const [sites, { stories }] = await Promise.all([
    pages<{ domain: string; name: string | null; sector: string; active: boolean; last_change_at: string | null; last_snapshot_at: string | null }>((f, t) => db.from("library_sites").select("domain,name,sector,active,last_change_at,last_snapshot_at").order("domain").range(f, t) as never),
    allStories(),
  ]);
  const moves = stories.filter(s => s.type === "move" || s.type === "rebrand").sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
  const last = new Map<string, Story>(); for (const m of moves) for (const d of m.domains) if (!last.has(d)) last.set(d, m);
  return {
    sites: sites.filter(s => s.active).map(s => ({ domain: s.domain, name: s.name, sector: s.sector, lastChange: last.get(s.domain)?.at ?? s.last_change_at, lastMove: last.get(s.domain)?.headline ?? null, captured: s.last_snapshot_at })),
    moves: moves.slice(0, 120),
  };
}

export async function loadPatterns(sector: string) {
  const [index, { signals }] = await Promise.all([siteTraitIndex(), latestSignals("all")]);
  return { sector: resolveSector(sector), patterns: patternIndex(index, signals, sector) };
}
export async function loadPattern(key: string, sector: string) {
  const [index, { signals }, thumbs] = await Promise.all([siteTraitIndex(), latestSignals("all"), allThumbs()]);
  return patternModel(key, index, signals, thumbs, sector);
}

/** Quarterly share points for every forecast row in one scope (sparklines on /signals). */
export async function loadSignalSeries(scope: string) {
  const rows = await pages<{ dimension: string; value: string; quarters: { q: string; s: number | null; n: number; c: number }[] | null }>((f, t) => supabaseAnon().from("forecast_latest").select("dimension,value,quarters:evidence->quarters").eq("scope", resolveSector(scope)).order("dimension").order("value").range(f, t) as never, 200);
  return Object.fromEntries(rows.map(r => [`${r.dimension}:${r.value}`, (r.quarters ?? []).filter(p => p.s != null && p.n >= 15 && p.c >= 0.25).map(p => p.s as number)]));
}
