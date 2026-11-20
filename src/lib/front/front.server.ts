// Loads what the front page model needs with the shared anonymous SELECT-only reads (stories, signal snapshot, real runs, freshness,
// editions, crops for the lead) and runs the pure model. No AI, no writes. Memoised briefly per (sector, format) for the page and /front.json.
import { dataShelf } from "../data-stories/build";
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
import { memoBy } from "../memo";
import { stored } from "../records/store.server";
import { frontModel, pageState, updatesOf, type ArchiveMove, type FrontInput, type FrontModel, type FrontTop, type FrontRest } from "./front";
import { resolveFormat, type FormatFilter } from "./formats";
import { streamOf } from "../stories/view";
import { collectionPath, liveCollections } from "../collections/registry";

/** Quarter series (with quarter labels) for every library-wide row of the reader run: chart of the day and the lead's sparkline. */
export const quarterSeries = stored("quarter-series", async (): Promise<QuarterSeries[]> => {
    const db = supabaseAnon(), runId = await readerRunId(db), out: QuarterSeries[] = [];
    for (let from = 0; from < 20000; from += 200) {
      const { data, error } = await db.from("forecasts").select("dimension,value,quarters:evidence->quarters").eq("run_id", runId).eq("scope", "all").order("dimension").order("value").range(from, from + 199);
      if (error) throw error;
      out.push(...(data ?? []).map(r => ({ key: `${r.dimension}:${r.value}`, quarters: Array.isArray(r.quarters) ? (r.quarters as QuarterSeries["quarters"]) : [] })));
      if (!data || data.length < 200) break;
    }
    return out;
}, { ttl: 10 * 60_000 });
const clip = (s: string, n = 180) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

async function build(sector: string, format: FormatFilter, withEditions = true): Promise<FrontModel> {
  const now = Date.now();
  const [read, { loadFreshness }, { loadEditions }, { siteTraitIndex }] = await Promise.all([import("../read.server"), import("../freshness.server"), import("../editions/editions.server"), import("../read.server")]);
  const [all, { snap, tiers, signals }, moves, fresh, editions, series, index] = await Promise.all([
    storyIndex(), latestSignals("all"), read.movingRuns(), loadFreshness().catch(() => null), withEditions ? loadEditions(null).catch(() => null) : Promise.resolve(null), quarterSeries().catch(() => []), siteTraitIndex().catch(() => []),
  ]);
  const headlineKeys = new Set([...tiers.values()].filter(t => t.tier === "headline").map(t => t.key));
  const byKey = new Map(signals.map(s => [s.key, s]));
  const lens = sector === "all" ? null : lensSignals(snap.rows, tiers, sector);
  const points: Record<string, number[]> = Object.fromEntries(series.map(s => [s.key, s.quarters.filter(wellCovered).map(p => p.s as number)]));
  const quarters: Record<string, string[]> = Object.fromEntries(series.map(s => [s.key, s.quarters.filter(wellCovered).map(p => p.q)]));
  const quiet = pageState(streamOf(all).filter(s => s.type !== "launch").map(s => s.happened_at), now) === "quiet";
  const archiveMoves: ArchiveMove[] = quiet ? await import("../rebrands.server").then(m => m.readerRebrands()).then(r => r.rows.map(x => ({ id: `rebrand:${x.id}`, at: x.confirmed_at, headline: rebrandSentence(x), line: x.read ? clip(untick(x.read)) : null, href: `/brands/${encodeURIComponent(x.domain)}`, source: x.source }))).catch(() => []) : [];
  const digestWeek = editions?.digest?.week ?? null, digestNo = digestWeek ? issueNumber(digestWeek) : null;
  const input: FrontInput = {
    now, sector, format, stories: all, signals, lens, stages: new Map(signals.map(s => [s.key, s.stage])),
    moving: { items: read.movingItems(moves, headlineKeys, byKey), pair: moves.pair, next: moves.next },
    freshness: fresh?.line ?? null, leadEvidence: null, series: points, seriesQuarters: quarters,
    chart: { composites: signals.filter(s => isComposite(s.key)), headline: signals.filter(s => s.tier === "headline"), series },
    editions: {
      morning: editions?.morning ? { day: editions.morning.href.split("/").at(-1) ?? "", title: editions.morning.title, href: editions.morning.href, count: editions.morning.count } : null,
      digest: digestWeek && digestNo ? { week: digestWeek, number: digestNo, dates: weekRange(digestWeek)?.label ?? digestWeek, href: `/digest/${digestWeek}` } : null,
      sectors: editions ? { at: editions.run?.at ?? null, count: editions.sectors.length } : null,
    },
    archiveMoves, patternKeys: new Set(signals.filter(isPatternSignal).map(s => s.key)), brandNames: new Map(index.map(s => [s.domain, s.name])),
    dataStories: dataShelf(),
    collections: liveCollections().map(c => ({ slug: c.slug, number: c.number, title: c.title, href: collectionPath(c.slug) })),
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
export const FRONT_TTL_MS = 20_000;
const fronts = memoBy(FRONT_TTL_MS, (k: { sector: string; format: FormatFilter }) => build(k.sector, k.format), { key: k => `${k.sector}|${k.format}`, max: 100 });
export function loadFront(rawSector: unknown, rawFormat: unknown): Promise<FrontModel> {
  return fronts({ sector: resolveSector(rawSector), format: resolveFormat(rawFormat) });
}
// P1 · shell first: the lead and the live column are critical (built without the editions read); the side column, chart of the day
// and lower lists are deferred and come from the full model, memoised, so the server builds each lens once.
const tops = memoBy(FRONT_TTL_MS, (k: { sector: string; format: FormatFilter }) => build(k.sector, k.format, false), { key: k => `${k.sector}|${k.format}`, max: 100 });
export async function loadFrontTop(rawSector: unknown, rawFormat: unknown): Promise<FrontTop> {
  const k = { sector: resolveSector(rawSector), format: resolveFormat(rawFormat) };
  const m = fronts.peek(k) ?? await tops(k);
  const { chart: _c, launches: _l, strip: _s, collections: _co, editions: _e, dataStories: _d, archive: _a, ...top } = m;
  return top;
}
export async function loadFrontRest(rawSector: unknown, rawFormat: unknown): Promise<FrontRest> {
  const m = await loadFront(rawSector, rawFormat);
  return { chart: m.chart, launches: m.launches, strip: m.strip, collections: m.collections, editions: m.editions, dataStories: m.dataStories, archive: m.archive, sections: m.sections, format: m.format, sector: m.sector, now: m.now, state: m.state };
}
export const loadFrontUpdates = async (sector: unknown, format: unknown) => updatesOf(await loadFront(sector, format));
