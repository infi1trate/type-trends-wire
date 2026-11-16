// Read-mode loaders (Live, brands, patterns, signal series): anonymous SELECT-only reads assembled by pure models. No AI per view.
import { supabaseAnon } from "./mcp/supabase";
import { forecastSiteTraits, type SiteRow } from "./forecast-signals";
import { latestSignals } from "./signals.server";
import { label, basis } from "./labels";
import { fromEvent, fromRebrand, type Story } from "./stories";
import { storyIndex } from "./stories/read.server";
import { liveModel, resolveTypeFilter, storiesAbout, storyForSource, storyPath } from "./stories/view";
import { brandModel, type BrandRows } from "./brand";
import { patternIndex, patternModel, type PatternSite } from "./patterns";
import { lensSignals, resolveSector } from "./sector-lens";
import { signalPath } from "./ia";
import { decodeEntities } from "./entities";
import { comparisonPair, nextComparison } from "./run-gap";
import { fetchRealRuns, fetchStageRows, readerRunId } from "./real-runs";
import { stageChanges } from "./today";
import type { ThumbRow } from "./thumbs";
import { cropCoverage, type CropRow } from "./crops";
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
const CROP_COLS = "domain,section,viewport,captured_at,first_seen_at,last_seen_at,path,width,height,bytes,hash";
/** Every visible section crop (opted-out sites are hidden by policy). Zero rows until the crawler sends crops. */
export const allCrops = memo(10 * 60_000, () => pages<CropRow>((f, t) => supabaseAnon().from("site_crops").select(CROP_COLS).order("id").range(f, t) as never));
/** Crops of a few domains (brand and story pages), read fresh rather than from the all-crops memo. */
export async function cropsFor(domains: string[]): Promise<CropRow[]> {
  if (!domains.length) return [];
  return pages<CropRow>((f, t) => supabaseAnon().from("site_crops").select(CROP_COLS).in("domain", domains.slice(0, 60)).order("id").range(f, t) as never);
}
/** /status: crop coverage (brands with a crop, versions stored, newest capture). */
export async function loadCropCoverage() {
  const rows = await pages<Pick<CropRow, "domain" | "captured_at">>((f, t) => supabaseAnon().from("site_crops").select("domain,captured_at").order("id").range(f, t) as never, 1000);
  return cropCoverage(rows);
}
export const allThumbs = memo(10 * 60_000, () => pages<ThumbRow>((f, t) => supabaseAnon().from("site_thumbs").select("domain,captured_at,viewport,path,width,height,bytes,variants").order("id").range(f, t) as never));

/** Brand moves and rebrands as thin Stories (the Brands › Moves tab lists every confirmed change, not only the ones that ran as stories). */
export const allStories = memo(TTL, async (): Promise<{ stories: Story[] }> => {
  const db = supabaseAnon(), now = Date.now(), since = (d: number) => new Date(now - d * day).toISOString();
  const [events, rebrandAll] = await Promise.all([
    db.from("library_event_feed").select("id,domain,type,before,after,detected_at,source,page_type,viewport,sector,summary").eq("source", "live").eq("viewport", "desktop").neq("type", "new_surface").gte("detected_at", since(30)).order("detected_at", { ascending: false }).limit(120).then(must),
    import("./rebrands.server").then(m => m.rebrandRows()),
  ]);
  return { stories: [
    ...((events ?? []) as EventRow[]).map(fromEvent),
    ...rebrandAll.rows.filter(x => x.source === "live" && Date.parse(x.confirmed_at) >= now - 120 * day).map(x => fromRebrand(x as RebrandRow)),
  ] };
});

/** `/` Live: lead story, the stored story stream (30 a page, type chips), moving now, chart of the week, new on the scene. */
export async function loadLive(sector: string, page: number, type: string = "all") {
  const [all, { snap, tiers }, chart, moves] = await Promise.all([storyIndex(), latestSignals("all"), import("./chart/chart.server").then(m => m.chartCard(null)).catch(() => null), movingRuns()]);
  const headline = new Set([...tiers.values()].filter(t => t.tier === "headline").map(t => t.key));
  const s = resolveSector(sector);
  const live = liveModel(all, { sector: s, page, type: resolveTypeFilter(type), now: Date.now() });
  const lens = lensSignals(snap.rows, tiers, s), byKey = new Map(lens.signals.map(x => [x.key, x]));
  // Stage changes only between the latest real run and the most recent real run at least MIN_RUN_GAP_DAYS older.
  const moving = moves.pair ? stageChanges(moves.latest, moves.earlier).filter(c => headline.has(c.trait)).map(c => {
    const x = byKey.get(c.trait);
    return { key: c.trait, name: label(c.trait).name, dimension: label(c.trait).dimension, basis: basis(c.trait), from: c.from, to: c.to, share: c.share, momentum_index: x?.momentum_index ?? null, href: signalPath(c.trait) };
  }).sort((a, b) => (b.momentum_index ?? -1) - (a.momentum_index ?? -1) || a.name.localeCompare(b.name)) : [];
  return { sector: s, ...live, moving, comparison: moves.pair, nextComparison: moves.next, chart: chart ? { week: chart.week, trait: chart.trait, model: chart.model } : null, runAt: snap.computed_at, runId: snap.run_id };
}
/** The valid comparison for Moving now: real runs, the gap pair and both runs' library-wide stages (cached like other public reads). */
const movingRuns = memo(TTL, async () => {
  const db = supabaseAnon(), runs = await fetchRealRuns(db), pair = comparisonPair(runs), next = nextComparison(runs, Date.now());
  if (!pair) return { pair: null, next, latest: [], earlier: [] };
  const [latest, earlier] = await Promise.all([fetchStageRows(db, pair.latest.id), fetchStageRows(db, pair.earlier.id)]);
  return { pair: { latest: pair.latest, earlier: pair.earlier, days: pair.days }, next, latest, earlier };
});
export async function runComparison() {
  const runs = await fetchRealRuns(supabaseAnon()), pair = comparisonPair(runs);
  return { real: runs, pair, next: nextComparison(runs, Date.now()) };
}

/** /brands/<domain>: null when the domain is not an active library brand. */
export async function loadBrand(domain: string) {
  const db = supabaseAnon();
  const site = must(await db.from("library_sites").select("domain,active").eq("domain", domain).maybeSingle());
  if (!site?.active) return null;
  const { auditRows } = await import("./agency/audit.server");
  const [audit, events, index, { tiers }, all, crops] = await Promise.all([
    auditRows([domain], null),
    db.from("library_event_feed").select("id,domain,type,before,after,detected_at,effective_at,source,page_type,viewport,sector,summary").eq("domain", domain).eq("source", "live").eq("viewport", "desktop").neq("type", "new_surface").order("detected_at", { ascending: false }).limit(80).then(must),
    siteTraitIndex(),
    latestSignals("all"),
    storyIndex().catch(() => []),
    cropsFor([domain]),
  ]);
  const own = index.find(s => s.domain === domain);
  const storyOf: [string, string][] = [...storyForSource(all)].filter(([src]) => src.startsWith("event:") || src.startsWith(`rebrand:${domain}:`)).map(([src, id]) => [src, storyPath(id)]);
  const rows: BrandRows = { domain, audit, events: (events ?? []) as EventRow[], peers: index.filter(s => s.sector === own?.sector).map(s => ({ domain: s.domain, name: s.name, sector: s.sector, traits: s.traits })), tiers: [...tiers.values()].map(t => [t.key, t.tier]), storyOf, crops };
  return { ...brandModel(rows), stories: storiesAbout(all, { domain, limit: 8 }) };
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

export async function loadPatterns(sector: string, illustrated = false) {
  const [index, { signals }, crops] = await Promise.all([siteTraitIndex(), latestSignals("all"), allCrops()]);
  const all = patternIndex(index, signals, sector, crops);
  return { sector: resolveSector(sector), illustrated, total: all.length, illustratedCount: all.filter(p => p.illustrated).length, patterns: illustrated ? all.filter(p => p.illustrated) : all };
}
export async function loadPattern(key: string, sector: string) {
  const [index, { signals }, crops, all] = await Promise.all([siteTraitIndex(), latestSignals("all"), allCrops(), storyIndex().catch(() => [])]);
  const m = patternModel(key, index, signals, crops, sector);
  return m ? { ...m, stories: storiesAbout(all, { signal: key, limit: 6 }) } : null;
}

/** Quarterly share points for every forecast row in one scope (sparklines on /signals). */
export async function loadSignalSeries(scope: string) {
  const db = supabaseAnon(), runId = await readerRunId(db);
  const rows = await pages<{ dimension: string; value: string; quarters: { q: string; s: number | null; n: number; c: number }[] | null }>((f, t) => db.from("forecasts").select("dimension,value,quarters:evidence->quarters").eq("run_id", runId).eq("scope", resolveSector(scope)).order("dimension").order("value").range(f, t) as never, 200);
  return Object.fromEntries(rows.map(r => [`${r.dimension}:${r.value}`, (r.quarters ?? []).filter(p => p.s != null && p.n >= 15 && p.c >= 0.25).map(p => p.s as number)]));
}
