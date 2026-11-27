// Read-mode loaders (Live, brands, patterns, signal series): anonymous SELECT-only reads assembled by pure models. No AI per view.
import { panelHistoryRows } from "./history.server";
import { supabaseAnon } from "./mcp/supabase";
import { activeRowsOnly } from "./active-sites.server";
import { memo } from "./memo";
import { stored, storedBy } from "./records/store.server";
import { pageKey } from "./records/records";
import { forecastSiteTraits, type SiteRow } from "./forecast-signals";
import { latestSignals } from "./signals.server";
import { label, basis } from "./labels";
import { fromEvent, fromRebrand, type Story } from "./stories";
import { storyIndex } from "./stories/read.server";
import { liveModel, resolveTypeFilter, storiesAbout, storyForSource, storyPath } from "./stories/view";
import { brandModel, type BrandRows } from "./brand-page";
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
const TTL = 5 * 60_000;
const day = 864e5;

/** Every active brand's current traits (forecastSiteTraits over its latest library history row), name, sector and capture date. */
export const siteTraitIndex = stored("site-index", async (): Promise<PatternSite[]> => {
  const db = supabaseAnon();
  const [sites, hist] = await Promise.all([
    pages<{ domain: string; name: string | null; sector: string; active: boolean; last_snapshot_at: string | null }>((f, t) => db.from("library_sites").select("domain,name,sector,active,last_snapshot_at").order("domain").range(f, t) as never),
    panelHistoryRows<SiteRow & { captured_at: string | null }>(db, "domain,quarter,sector,captured_at,theme,h1_family,webfont,h1_tracking,css_features,frameworks,hero_media,ai_tags,h1_size_px,cta_radius_bucket,whitespace_ratio", { now: true }),
  ]);
  const h = new Map(hist.map(r => [r.domain, r]));
  return sites.filter(s => s.active).map(s => { const r = h.get(s.domain); return { domain: s.domain, name: s.name, sector: s.sector, captured: r?.captured_at ?? s.last_snapshot_at, traits: r ? [...new Set(forecastSiteTraits({ ...r, sector: s.sector }))] : [] }; });
}, { ttl: 10 * 60_000 });
const CROP_COLS = "domain,section,viewport,captured_at,first_seen_at,last_seen_at,path,width,height,bytes,hash";
/** Every visible section crop (opted-out sites are hidden by policy). Zero rows until the crawler sends crops. */
export const allCrops = memo(10 * 60_000, async () => activeRowsOnly(await pages<CropRow>((f, t) => supabaseAnon().from("site_crops").select(CROP_COLS).order("id").range(f, t) as never)));
/** Crops of a few domains (brand and story pages), read fresh rather than from the all-crops memo. */
export async function cropsFor(domains: string[]): Promise<CropRow[]> {
  if (!domains.length) return [];
  return pages<CropRow>((f, t) => supabaseAnon().from("site_crops").select(CROP_COLS).in("domain", domains.slice(0, 60)).order("id").range(f, t) as never);
}
/** /status: crop coverage (brands with a crop, versions stored, newest capture). */
export async function loadCropCoverage() {
  const rows = await pages<Pick<CropRow, "domain" | "captured_at">>((f, t) => supabaseAnon().from("site_crops").select("domain,captured_at").order("id").range(f, t) as never, 1000);
  return cropCoverage(await activeRowsOnly(rows));
}
export const allThumbs = memo(10 * 60_000, async () => activeRowsOnly(await pages<ThumbRow>((f, t) => supabaseAnon().from("site_thumbs").select("domain,captured_at,viewport,path,width,height,bytes,variants").order("id").range(f, t) as never)));

/** Brand moves and rebrands as thin Stories (the Brands › Moves tab lists every confirmed change, not only the ones that ran as stories). */
export const allStories = memo(TTL, async (): Promise<{ stories: Story[]; partial?: true }> => {
  const db = supabaseAnon(), now = Date.now(), since = (d: number) => new Date(now - d * day).toISOString();
  const [events, rebrandAll] = await Promise.all([
    db.from("library_event_feed").select("id,domain,type,before,after,detected_at,source,page_type,viewport,sector,summary,snapshot_id,prev_snapshot_id").eq("source", "live").eq("viewport", "desktop").neq("type", "new_surface").gte("detected_at", since(30)).order("detected_at", { ascending: false }).limit(120).then(must),
    import("./rebrands.server").then(m => m.readerRebrands()),
  ]);
  // P2c · `partial`: the change checks could not be read (no live change story then, fail closed) or the rebrands list says the same.
  let partial = !!rebrandAll.partial;
  const stories = [
    ...(await (async () => { const checked = await (await import("./integrity.server")).checkedEvents(db, await (await import("./active-sites.server")).panelRowsOnly((events ?? []) as EventRow[])); /* R2a panel brands only; R2c since the brand joined */ if (checked.failed) partial = true; const evs = checked.tape, { reversalIds } = await import("./reversal"); const rev = reversalIds(evs.map(e => ({ ...e, page_type: e.page_type ?? null, viewport: e.viewport ?? null }))); const car = new Set(await import("./carousel.server").then(m => m.carouselIds(supabaseAnon(), evs))); return evs.map(e => fromEvent(e, { reversed: rev.has(e.id), carousel: car.has(e.id) })); })()),
    ...rebrandAll.rows.filter(x => x.source === "live" && Date.parse(x.confirmed_at) >= now - 120 * day).map(x => fromRebrand(x as RebrandRow)),
  ];
  return partial ? { stories, partial: true } : { stories };
});

/** `/` Live: lead story, the stored story stream (30 a page, type chips), moving now, chart of the week, new on the scene. */
export async function loadLive(sector: string, page: number, type: string = "all") {
  const [all, { snap, tiers }, chart, moves] = await Promise.all([storyIndex(), latestSignals("all"), import("./chart/chart.server").then(m => m.chartCard(null)).catch(() => null), movingRuns()]);
  const headline = new Set([...tiers.values()].filter(t => t.tier === "headline").map(t => t.key));
  const s = resolveSector(sector);
  const live = liveModel(all, { sector: s, page, type: resolveTypeFilter(type), now: Date.now() });
  const lens = lensSignals(snap.rows, tiers, s), byKey = new Map(lens.signals.map(x => [x.key, x]));
  const moving = movingItems(moves, headline, byKey);
  return { sector: s, ...live, moving, comparison: moves.pair, nextComparison: moves.next, chart: chart ? { week: chart.week, trait: chart.trait, model: chart.model } : null, runAt: snap.computed_at, runId: snap.run_id };
}
/** Moving now: stage changes only between the latest real run and the most recent real run at least MIN_RUN_GAP_DAYS older (headline signals). */
export function movingItems(moves: Awaited<ReturnType<typeof movingRuns>>, headline: Set<string>, byKey: Map<string, { momentum_index: number | null }>) {
  return moves.pair ? stageChanges(moves.latest, moves.earlier).filter(c => headline.has(c.trait)).map(c => {
    const x = byKey.get(c.trait);
    return { key: c.trait, name: label(c.trait).name, dimension: label(c.trait).dimension, basis: basis(c.trait), from: c.from, to: c.to, share: c.share, momentum_index: x?.momentum_index ?? null, href: signalPath(c.trait) };
  }).sort((a, b) => (b.momentum_index ?? -1) - (a.momentum_index ?? -1) || a.name.localeCompare(b.name)) : [];
}
/** The valid comparison for Moving now: real runs, the gap pair and both runs' library-wide stages (cached like other public reads). */
export const movingRuns = stored("moving-runs", async () => {
  const db = supabaseAnon(), runs = await fetchRealRuns(db), pair = comparisonPair(runs), next = nextComparison(runs, Date.now());
  if (!pair) return { pair: null, next, latest: [], earlier: [] };
  const [latest, earlier] = await Promise.all([fetchStageRows(db, pair.latest.id), fetchStageRows(db, pair.earlier.id)]);
  return { pair: { latest: pair.latest, earlier: pair.earlier, days: pair.days }, next, latest, earlier };
}, { ttl: TTL });
export async function runComparison() {
  const runs = await fetchRealRuns(supabaseAnon()), pair = comparisonPair(runs);
  return { real: runs, pair, next: nextComparison(runs, Date.now()) };
}

/** Signals similarity may compare: headline tier and measured (the brand page and MCP `library_site` share this). */
export const similarEligible = (signals: { key: string; tier: string; basis: string }[]) => new Set(signals.filter(s => s.tier === "headline" && s.basis === "measured").map(s => s.key));
/** The similar brands for one tracked domain, for MCP. */
export async function similarFor(domain: string) {
  const [{ similarBrands }, index, { signals }] = await Promise.all([import("./similar"), siteTraitIndex(), latestSignals("all")]);
  return similarBrands(domain, index, similarEligible(signals));
}

/** /brands/<domain>: null when the domain is not an active library brand. */
export async function loadBrand(domain: string) {
  const db = supabaseAnon();
  const site = must(await db.from("library_sites").select("domain,active").eq("domain", domain).maybeSingle());
  if (!site?.active) return null;
  const [{ auditRows }, { capturesOf, dataInput }, { sectorField, signalContrast }, { similarBrands }] = await Promise.all([import("./agency/audit.server"), import("./data-stories/data.server"), import("./data-stories/stories"), import("./similar")]);
  const [audit, rawEvents, index, { tiers, signals }, all, crops, captures, input] = await Promise.all([
    auditRows([domain], null),
    db.from("library_event_feed").select("id,domain,type,before,after,detected_at,effective_at,source,page_type,viewport,sector,summary,snapshot_id,prev_snapshot_id").eq("domain", domain).eq("source", "live").eq("viewport", "desktop").neq("type", "new_surface").order("detected_at", { ascending: false }).limit(80).then(must),
    siteTraitIndex(),
    latestSignals("all"),
    storyIndex().catch(() => []),
    cropsFor([domain]),
    capturesOf(domain).catch(() => []),
    dataInput().catch(() => null),
  ]);
  // E2e: the brand's moves are its confirmed changes (integrity.ts; fails closed).
  const events = (await (await import("./integrity.server")).checkedEvents(db, (rawEvents ?? []) as EventRow[])).tape;
  const own = index.find(s => s.domain === domain);
  const eligible = similarEligible(signals);
  const storyOf: [string, string][] = [...storyForSource(all)].filter(([src]) => src.startsWith("event:") || src.startsWith(`rebrand:${domain}:`)).map(([src, id]) => [src, storyPath(id)]);
  const field = input && own ? sectorField(input, own.sector) : null;
  const contrast = input ? signalContrast(input, domain) : null;
  const [seasonal, carousel] = await Promise.all([import("./promo.server").then(m => m.seasonalIds(db, (events ?? []) as EventRow[])), import("./carousel.server").then(m => m.carouselIds(db, (events ?? []) as EventRow[]))]);
  const rows: BrandRows = { domain, audit, events: (events ?? []) as EventRow[], seasonal, carousel, peers: index.filter(s => s.sector === own?.sector).map(s => ({ domain: s.domain, name: s.name, sector: s.sector, traits: s.traits })), tiers: [...tiers.values()].map(t => [t.key, t.tier]), storyOf, crops,
    captures, similar: similarBrands(domain, index, eligible), field, contrast: contrast ? { has: contrast.has.map(x => ({ key: x.key, name: x.name, sector: x.sector })), lacks: contrast.lacks.map(x => ({ key: x.key, name: x.name, sector: x.sector })) } : null };
  return { ...brandModel(rows), stories: storiesAbout(all, { domain, limit: 8 }) };
}

/** Recorded moves per brand (all time): live desktop changes the brand page lists, plus confirmed live rebrands. */
const moveCounts = memo(TTL, async () => {
  const db = supabaseAnon();
  const [events, rebrandAll] = await Promise.all([
    pages<{ id: number; type: string; domain: string; detected_at: string }>((f, t) => db.from("library_event_feed").select("id,type,domain,detected_at").eq("source", "live").eq("viewport", "desktop").neq("type", "new_surface").order("id").range(f, t) as never, 1000)
      .then(async all => { const evs = await (await import("./active-sites.server")).panelRowsOnly(all); const c = await (await import("./integrity.server")).checkedEvents(db, evs); if (c.failed) throw new Error("move_counts_unchecked"); return c.tape; }),
    // P2c · a count read without the checks or without the rebrands is short (31 words and 157 px of /brands at 390 px on a fresh
    // instance): it fails instead, so it is never kept, and /brands falls back to the stored record.
    import("./rebrands.server").then(m => m.readerRebrands()).then(r => { if (r.partial) throw new Error("move_counts_rebrands_incomplete"); return r.rows; }),
  ]);
  const out = new Map<string, { n: number; last: string | null }>();
  const add = (d: string, at: string) => { const c = out.get(d) ?? { n: 0, last: null }; c.n++; if (!c.last || at > c.last) c.last = at; out.set(d, c); };
  for (const e of events) add(e.domain, e.detected_at);
  for (const x of rebrandAll) if (x.source === "live") add(x.domain, x.confirmed_at);
  return out;
});

/** /brands: the directory plus recent moves across every brand (precomputed record "brands-index"; computeBrands is the live load). */
export async function loadBrands() {
  const [rec, { picturesSafe }, { iconsFor }, { movedThisWeek, movedSet }] = await Promise.all([brandsRecord(null).catch(() => lastBrandsRecord()), import("./pictures.server"), import("./pictures"), import("./brand-tiles")]);
  const index = await picturesSafe(), now = Date.now();
  // S1 · "Moved this week": one card per brand with a stored first-screen crop, and the brands that carry the MOVED sticker.
  const moved = movedThisWeek(rec.moves, now, d => !!index.get(d)?.hero).map(c => ({ ...c, hero: index.get(c.domain)!.hero! }));
  // I1: each row's site icon from the pictures index (never stored in the record, so a new icon shows within minutes).
  return { ...rec, icons: iconsFor(index, rec.sites.map(s => s.domain)), moved, movedDomains: movedSet(rec.moves, now) };
}
export async function computeBrands() {
  const db = supabaseAnon();
  const [sites, storyList, counts, accents] = await Promise.all([
    pages<{ domain: string; name: string | null; sector: string; active: boolean; last_change_at: string | null; last_snapshot_at: string | null }>((f, t) => db.from("library_sites").select("domain,name,sector,active,last_change_at,last_snapshot_at").order("domain").range(f, t) as never),
    allStories(),
    moveCounts(),
    // S1 · each brand's measured accent (the monogram plate's colour when no usable icon is stored); a failed read only loses the colour.
    pages<{ domain: string; accent: string | null }>((f, t) => db.from("library_latest").select("domain,accent").order("domain").range(f, t) as never).catch(() => []),
  ]);
  const accentOf = new Map(accents.map(a => [a.domain, a.accent]));
  // P2c · a directory built from incomplete inputs is refused (never kept in memory or written as the record); the next request retries.
  if (storyList.partial) { allStories.clear(); throw new Error("brands_inputs_incomplete"); }
  const { stories } = storyList;
  const moves = stories.filter(s => s.type === "move" || s.type === "rebrand").sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
  const last = new Map<string, Story>(); for (const m of moves) for (const d of m.domains) if (!last.has(d)) last.set(d, m);
  return {
    sites: sites.filter(s => s.active).map(s => { const c = counts.get(s.domain); return { domain: s.domain, name: s.name, sector: s.sector, accent: accentOf.get(s.domain) ?? null, lastChange: c?.n ? (last.get(s.domain)?.at ?? c.last) : null, lastMove: last.get(s.domain)?.headline ?? null, captured: s.last_snapshot_at, moves: c?.n ?? 0 }; }),
    moves: moves.slice(0, 120),
  };
}

const brandsRecord = storedBy((_: null) => pageKey("brands-index"), () => computeBrands());
/** P2c · when the live directory can't be built whole, the last stored one (any age) rather than a shorter page; none stored: the error. */
async function lastBrandsRecord(): Promise<Awaited<ReturnType<typeof computeBrands>>> {
  const row = await (await import("./records/store.server")).readRecord<Awaited<ReturnType<typeof computeBrands>>>(pageKey("brands-index")).catch(() => null);
  if (!row) throw new Error("brands_unavailable");
  return row.body;
}
/** P1, critical for /patterns/<key>: name and count (head and title) from the shared records; null → 404. */
export async function loadPatternHead(key: string, sector: string) {
  const [index, { signals }] = await Promise.all([siteTraitIndex(), latestSignals("all")]);
  const m = patternModel(key, index, signals, [], sector);
  return m ? { key, name: m.name, total: m.total, dimension: m.dimension } : null;
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
/** B1b: the same rows as loadSignalSeries, with each kept point's quarter ("2026Q3") and its count ("5 of 30"), for chart readouts. */
export async function loadSignalSeriesDetail(scope: string) {
  const db = supabaseAnon(), runId = await readerRunId(db);
  const rows = await pages<{ dimension: string; value: string; quarters: { q: string; s: number | null; n: number; c: number; k?: number }[] | null }>((f, t) => db.from("forecasts").select("dimension,value,quarters:evidence->quarters").eq("run_id", runId).eq("scope", resolveSector(scope)).order("dimension").order("value").range(f, t) as never, 200);
  const values: Record<string, number[]> = {}, quarters: Record<string, string[]> = {}, counts: Record<string, (string | null)[]> = {};
  for (const r of rows) {
    const kept = (r.quarters ?? []).filter(p => p.s != null && p.n >= 15 && p.c >= 0.25), key = `${r.dimension}:${r.value}`;
    values[key] = kept.map(p => p.s as number); quarters[key] = kept.map(p => p.q);
    counts[key] = kept.map(p => (typeof p.k === "number" ? `${p.k} of ${p.n}` : `${Math.round((p.s as number) * p.n)} of ${p.n}`));
  }
  return { values, quarters, counts };
}
export async function loadSignalSeries(scope: string) {
  const db = supabaseAnon(), runId = await readerRunId(db);
  const rows = await pages<{ dimension: string; value: string; quarters: { q: string; s: number | null; n: number; c: number }[] | null }>((f, t) => db.from("forecasts").select("dimension,value,quarters:evidence->quarters").eq("run_id", runId).eq("scope", resolveSector(scope)).order("dimension").order("value").range(f, t) as never, 200);
  return Object.fromEntries(rows.map(r => [`${r.dimension}:${r.value}`, (r.quarters ?? []).filter(p => p.s != null && p.n >= 15 && p.c >= 0.25).map(p => p.s as number)]));
}
