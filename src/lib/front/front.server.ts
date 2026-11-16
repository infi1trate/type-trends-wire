// Loads what the front page model needs with the shared anonymous SELECT-only reads (stories, signal snapshot, real runs, freshness,
// editions, crops for the lead) and runs the pure model. No AI, no writes. Memoised briefly per (sector, format) for the page and /front.json.
import { storyIndex } from "../stories/read.server";
import { latestSignals } from "../signals.server";
import { lensSignals, resolveSector } from "../sector-lens";
import { isComposite } from "../composites";
import { isPatternSignal } from "../patterns";
import { untick } from "../labels";
import { rebrandSentence } from "../agency/changes";
import { issueNumber, weekRange } from "../digest/week";
import { wellCovered, type QuarterSeries } from "../kit";
import { supabaseAnon } from "../mcp/supabase";
import { readerRunId } from "../real-runs";
import { frontModel, pageState, updatesOf, type ArchiveMove, type FrontInput, type FrontModel } from "./front";
import { resolveFormat, type FormatFilter } from "./formats";
import { streamOf } from "../stories/view";

/** Quarter series (with quarter labels) for every library-wide row of the reader run: chart of the day and the lead's sparkline. */
let seriesCache: { at: number; v: Promise<QuarterSeries[]> } | null = null;
function quarterSeries(): Promise<QuarterSeries[]> {
  if (seriesCache && Date.now() - seriesCache.at < 10 * 60_000) return seriesCache.v;
  const v = (async () => {
    const db = supabaseAnon(), runId = await readerRunId(db), out: QuarterSeries[] = [];
    for (let from = 0; from < 20000; from += 200) {
      const { data, error } = await db.from("forecasts").select("dimension,value,quarters:evidence->quarters").eq("run_id", runId).eq("scope", "all").order("dimension").order("value").range(from, from + 199);
      if (error) throw error;
      out.push(...(data ?? []).map(r => ({ key: `${r.dimension}:${r.value}`, quarters: Array.isArray(r.quarters) ? (r.quarters as QuarterSeries["quarters"]) : [] })));
      if (!data || data.length < 200) break;
    }
    return out;
  })();
  seriesCache = { at: Date.now(), v }; v.catch(() => { seriesCache = null; });
  return v;
}
const clip = (s: string, n = 180) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

async function build(sector: string, format: FormatFilter): Promise<FrontModel> {
  const now = Date.now();
  const [read, { loadFreshness }, { loadEditions }, { siteTraitIndex }] = await Promise.all([import("../read.server"), import("../freshness.server"), import("../editions/editions.server"), import("../read.server")]);
  const [all, { snap, tiers, signals }, moves, fresh, editions, series, index] = await Promise.all([
    storyIndex(), latestSignals("all"), read.movingRuns(), loadFreshness().catch(() => null), loadEditions(null).catch(() => null), quarterSeries().catch(() => []), siteTraitIndex().catch(() => []),
  ]);
  const headlineKeys = new Set([...tiers.values()].filter(t => t.tier === "headline").map(t => t.key));
  const byKey = new Map(signals.map(s => [s.key, s]));
  const lens = sector === "all" ? null : lensSignals(snap.rows, tiers, sector);
  const points: Record<string, number[]> = Object.fromEntries(series.map(s => [s.key, s.quarters.filter(wellCovered).map(p => p.s as number)]));
  const quiet = pageState(streamOf(all).filter(s => s.type !== "launch").map(s => s.happened_at), now) === "quiet";
  const archiveMoves: ArchiveMove[] = quiet ? await import("../rebrands.server").then(m => m.rebrandRows()).then(r => r.rows.map(x => ({ id: `rebrand:${x.id}`, at: x.confirmed_at, headline: rebrandSentence(x), line: x.read ? clip(untick(x.read)) : null, href: `/brands/${encodeURIComponent(x.domain)}`, source: x.source }))).catch(() => []) : [];
  const digestWeek = editions?.digest?.week ?? null, digestNo = digestWeek ? issueNumber(digestWeek) : null;
  const input: FrontInput = {
    now, sector, format, stories: all, signals, lens, stages: new Map(signals.map(s => [s.key, s.stage])),
    moving: { items: read.movingItems(moves, headlineKeys, byKey), pair: moves.pair, next: moves.next },
    freshness: fresh?.line ?? null, leadEvidence: null, series: points,
    chart: { composites: signals.filter(s => isComposite(s.key)), headline: signals.filter(s => s.tier === "headline"), series },
    editions: {
      morning: editions?.morning ? { day: editions.morning.href.split("/").at(-1) ?? "", title: editions.morning.title, href: editions.morning.href, count: editions.morning.count } : null,
      digest: digestWeek && digestNo ? { week: digestWeek, number: digestNo, dates: weekRange(digestWeek)?.label ?? digestWeek, href: `/digest/${digestWeek}` } : null,
      sectors: editions ? { at: editions.run?.at ?? null, count: editions.sectors.length } : null,
    },
    archiveMoves, patternKeys: new Set(signals.filter(isPatternSignal).map(s => s.key)), brandNames: new Map(index.map(s => [s.domain, s.name])),
  };
  let model = frontModel(input);
  // The lead's evidence slot: before/after crops when two captures straddle the change; otherwise the model falls back to the sparkline or nothing.
  const lead = model.lead ? all.find(s => s.id === model.lead!.story.id) : null;
  if (lead && ["move", "counter_move", "rebrand"].includes(lead.type)) {
    const ev = await import("../stories/page.server").then(m => m.evidenceOf(lead, lead.type)).catch(() => null);
    if (ev?.compare) model = frontModel({ ...input, leadEvidence: { id: lead.id, crops: { section: ev.sectionName ?? "", before: ev.compare.before, after: ev.compare.after } } });
  }
  return model;
}
const cache = new Map<string, { at: number; v: Promise<FrontModel> }>();
export const FRONT_TTL_MS = 20_000;
export function loadFront(rawSector: unknown, rawFormat: unknown): Promise<FrontModel> {
  const sector = resolveSector(rawSector), format = resolveFormat(rawFormat), key = `${sector}|${format}`, hit = cache.get(key);
  if (hit && Date.now() - hit.at < FRONT_TTL_MS) return hit.v;
  const v = build(sector, format); cache.set(key, { at: Date.now(), v }); v.catch(() => cache.delete(key));
  return v;
}
export const loadFrontUpdates = async (sector: unknown, format: unknown) => updatesOf(await loadFront(sector, format));
