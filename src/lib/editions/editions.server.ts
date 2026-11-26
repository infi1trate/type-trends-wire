// Editions loaders (Morning Line, sector reports, /editions, /welcome): anonymous SELECT-only reads assembled by the pure models in
// editions/*.ts. No AI per view; short per-instance memo like the other public reads.
import { pagedRows } from "../paged";
import { supabaseAnon } from "../mcp/supabase";
import { memoBy } from "../memo";
import { storyIndex, storyRaw } from "../stories/read.server";
import { latestSignals } from "../signals.server";
import { allCrops, siteTraitIndex } from "../read.server";
import { comparisonPair } from "../run-gap";
import { samePanel } from "../restatement";
import { fetchReaderRuns, fetchRealRuns, fetchStageRows } from "../real-runs";
import { stageChanges } from "../today";
import { label } from "../labels";
import { rowKey, tiersFrom, type SignalRow } from "../signals";
import { patternIndex, patternModel } from "../patterns";
import { resolveSector } from "../sector-lens";
import { isEditionDay, morningArchive, morningEdition, morningHead, todayOf, type ChartRow, type MovingInput } from "./morning";
import { morningRss } from "./morning-rss";
import { sectorIndex, sectorReport, type SectorPatternBlock } from "./sector";

const must = <T,>(r: { data: T; error: unknown }) => { if (r.error) throw r.error; return r.data; };
const memo = <K, T>(ms: number, load: (k: K) => Promise<T>) => memoBy(ms, load, { max: 200 });
const TTL = 60_000;
const charts = memo(10 * 60_000, async (_: null): Promise<ChartRow[]> => (must(await supabaseAnon().from("chart_cards").select("week,trait,created_at,model").order("week", { ascending: false }).limit(60)) ?? []).map(c => ({ ...c, model: c.model as unknown as ChartRow["model"] })));

/** Headline signals that changed stage between the gap-rule pair of real runs stored before `asOf` (headline judged on that run's own rows). */
const movingFor = memo(10 * 60_000, async (asOf: number): Promise<MovingInput> => {
  const db = supabaseAnon(), real = (await fetchRealRuns(db)).filter(r => Date.parse(r.at) < asOf), pair = comparisonPair(real);
  if (!pair) return { pair: null, items: [] };
  const before = samePanel(pair.latest, real.filter(r => r.id !== pair.latest.id && Date.parse(r.at) < Date.parse(pair.latest.at))).slice(-2).reverse();
  const cols = "dimension,value,scope,status,stage,momentum,current_share,next_wave_score,sites:components->sites";
  const [latest, earlier, full, ...prev] = await Promise.all([
    fetchStageRows(db, pair.latest.id), fetchStageRows(db, pair.earlier.id),
    pagesOf<SignalRow>((f, t) => db.from("forecasts").select(cols).eq("run_id", pair.latest.id).eq("scope", "all").order("dimension").order("value").range(f, t) as never),
    ...before.map(r => fetchStageRows(db, r.id)),
  ]);
  const prevStages = new Map<string, (string | null)[]>();
  prev.forEach((list, i) => { for (const r of list) { const k = rowKey(r), a = prevStages.get(k) ?? [null, null]; a[i] = r.stage; prevStages.set(k, a); } });
  const tiers = tiersFrom(full.map(r => ({ ...r, sites: typeof r.sites === "number" ? r.sites : null })), prevStages);
  const items = stageChanges(latest, earlier).filter(c => tiers.get(c.trait)?.tier === "headline").slice(0, 5)
    .map(c => ({ key: c.trait, name: label(c.trait).name, dimension: label(c.trait).dimension, from: c.from, to: c.to, share: c.share }));
  return { pair: { latest: pair.latest, earlier: pair.earlier, days: pair.days }, items };
});
async function pagesOf<T>(f: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const out: T[] = [];
  for (let from = 0; from < 20000; from += 1000) { const { data, error } = await f(from, from + 999); if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < 1000) break; }
  return out;
}

/** C1 · today's edition head and the seven newest archive days, for the Editions box (the same fields as `loadMorning` gave it, without
 *  the whole edition); null when today is not an edition day. */
const morningBox = memo(TTL, async (_: null) => {
  const now = Date.now(), d = todayOf(now);
  if (!isEditionDay(d, now)) return null;
  const raw = await storyRaw();
  return { ...morningHead(raw, d, now), archive: morningArchive(raw, now, 7) };
});
/** /morning (today) and /morning/<date>; null when the date is not an edition day. */
export const loadMorning = memo(TTL, async (day: string | null) => {
  const now = Date.now(), d = day ?? todayOf(now);
  if (!isEditionDay(d, now)) return null;
  const asOf = Math.min(Date.parse(`${d}T00:00:00Z`) + 864e5, now);
  const [raw, ch, moving] = await Promise.all([storyRaw(), charts(null), movingFor(asOf).catch((): MovingInput => ({ pair: null, items: [] }))]);
  return { edition: morningEdition(raw, d, now, { moving, charts: ch }), archive: morningArchive(raw, now).slice(0, 30), today: todayOf(now) };
});
export async function morningFeedResponse(): Promise<Response> {
  try {
    const raw = await storyRaw();
    return new Response(morningRss(morningArchive(raw, Date.now())), { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=900, s-maxage=3600" } });
  } catch {
    return new Response("Feed unavailable", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "300" } });
  }
}

/** C1 · what the sector index needs (the front page's Editions box reads it); the crops and trait index only the reports use are read
 *  beside it in `sectorInputs`, so a cold front page no longer waits on every brand's crops. */
const sectorBase = memo(TTL, async (_: null) => {
  const db = supabaseAnon(), reader = await fetchReaderRuns(db), run = reader.latest;
  const [{ snap, tiers, signals }, sites, setters, stories] = await Promise.all([
    latestSignals("all"),
    pagedRows((f, t) => db.from("library_sites").select("domain,sector,name").eq("active", true).order("domain").range(f, t)).then(must),
    db.from("trendsetters").select("domain,rank,sector").eq("run_id", run?.id ?? -1).order("rank").limit(200).then(must),
    storyIndex().catch(() => []),
  ]);
  return { run: run ? { id: run.id, at: run.at } : null, rows: snap.rows, tiers, signals, sites: sites ?? [], trendsetters: setters ?? [], stories };
});
const sectorInputs = memo(TTL, async (_: null) => {
  const [base, index, crops] = await Promise.all([sectorBase(null), siteTraitIndex(), allCrops()]);
  return { ...base, index, crops };
});
export const SECTOR_PATTERNS_MAX = 6;
export const loadSectorReport = memo(TTL, async (raw: string) => {
  const sector = resolveSector(raw);
  if (sector === "all") return null;
  const i = await sectorInputs(null), now = Date.now();
  const patterns: SectorPatternBlock[] = patternIndex(i.index, i.signals, sector, i.crops).slice(0, SECTOR_PATTERNS_MAX).flatMap(p => {
    const m = patternModel(p.key, i.index, i.signals, i.crops, sector);
    return m ? [{ key: p.key, name: p.name, examples: m.total, withCaptures: m.withCaptures, href: `${p.href}?sector=${sector}`, sample: m.examples.slice(0, 3).map(e => ({ domain: e.domain, name: e.name, href: e.href, crop: e.crop })) }] : [];
  });
  return sectorReport({ sector, now, run: i.run, rows: i.rows, tiers: i.tiers, sites: i.sites, trendsetters: i.trendsetters, stories: i.stories, patterns });
});
export const loadSectorIndex = memo(TTL, async (_: null) => {
  const i = await sectorBase(null), now = Date.now();
  return { run: i.run, sectors: sectorIndex({ now, run: i.run, rows: i.rows, tiers: i.tiers, sites: i.sites, stories: i.stories }) };
});

/** /editions: today's Morning Line lead, the latest Digest issue and the sector reports. */
export const loadEditions = memo(TTL, async (_: null) => {
  // E5 · the latest Digest is the newest closed week that has an issue, named by its written headline.
  const [m, s, digest] = await Promise.all([morningBox(null), loadSectorIndex(null), import("../digest/digest.server").then(d => d.loadIssue(null)).catch(() => null)]);
  return { morning: m,
    digest: digest ? { week: digest.week, number: digest.number, headline: digest.text.headline, dates: digest.dates.label } : null, sectors: s.sectors, run: s.run };
});

/** P1, critical for /sectors/<sector>: the head's title and basis (two small reads); null for an unknown sector (404). */
export async function loadSectorHead(raw: string) {
  const sector = resolveSector(raw);
  if (sector === "all" || sector !== raw) return null;
  const { sectorHead } = await import("./sector");
  const db = supabaseAnon();
  const [reader, count] = await Promise.all([fetchReaderRuns(db), db.from("library_sites").select("domain", { count: "exact", head: true }).eq("active", true).eq("sector", sector)]);
  if (count.error) throw count.error;
  const run = reader.latest;
  return sectorHead({ sector, now: Date.now(), run: run ? { id: run.id, at: run.at } : null, brands: count.count ?? 0 });
}
