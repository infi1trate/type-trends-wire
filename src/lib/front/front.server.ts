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
import { memo, memoBy } from "../memo";
import { within } from "../deadline";
import { stored } from "../records/store.server";
import { frontModel, pageState, updatesOf, type ArchiveMove, type FrontInput, type FrontModel, type FrontTop, type FrontRest } from "./front";
import { resolveFormat, type FormatFilter } from "./formats";
import { streamOf } from "../stories/view";
import { collectionPath, liveCollections } from "../collections/registry";
import { NO_PICS, coverOf, iconsFor } from "../pictures";
import { picturesSafe } from "../pictures.server";
import { candidateList, pickAlsoPictures, type CardCandidates } from "./also-pictures";

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

type Editions = Awaited<ReturnType<typeof import("../editions/editions.server").loadEditions>>;
/** The editions part of the model's input (the Morning Line, the Digest, sector editions); all empty when the read is missing. */
function editionsIn(editions: Editions | null): FrontInput["editions"] {
  const digestWeek = editions?.digest?.week ?? null, digestNo = digestWeek ? issueNumber(digestWeek) : null;
  return {
    morning: editions?.morning ? { day: editions.morning.href.split("/").at(-1) ?? "", title: editions.morning.title, href: editions.morning.href, count: editions.morning.count } : null,
    digest: digestWeek && digestNo ? { week: digestWeek, number: digestNo, dates: weekRange(digestWeek)?.label ?? digestWeek, href: `/digest/${digestWeek}`, headline: editions?.digest?.headline ?? null } : null,
    sectors: editions ? { at: editions.run?.at ?? null, count: editions.sectors.length } : null,
  };
}
const loadEditionsSafe = () => import("../editions/editions.server").then(m => m.loadEditions(null)).catch(() => null);

/** Everything the model needs except the editions (the stories, signals, charts, pictures and the lead's evidence). One build serves
 *  the top read, the rest read and the full model, so the page's parts never start a second build of the same thing. */
async function buildInput(sector: string, format: FormatFilter): Promise<FrontInput> {
  const now = Date.now();
  const [read, { loadFreshness }, { siteTraitIndex }] = await Promise.all([import("../read.server"), import("../freshness.server"), import("../read.server")]);
  // C1 · the lead pictures' stored record and the pictures index start with the first reads (they waited for them before).
  const leadsP = storedLeads(), picsP = picturesSafe();
  const [all, { snap, tiers, signals }, moves, fresh, series, index, studies] = await Promise.all([
    // N1 · the owner's wire-only switch takes stories off the front page only (off by default; an unreadable switch reads as off).
    Promise.all([storyIndex(), import("../newsroom/newsroom.server").then(m => m.wireOnlyOn()).catch(() => false), import("../newsroom/wire-only")]).then(([a, on, w]) => w.frontStories(a, on)),
    latestSignals("all"), read.movingRuns(), loadFreshness().catch(() => null), quarterSeries().catch(() => []), siteTraitIndex().catch(() => []),
    import("../data-stories/page.server").then(m => m.storedStudyShelf()).catch(() => null),
  ]);
  const headlineKeys = new Set([...tiers.values()].filter(t => t.tier === "headline").map(t => t.key));
  const byKey = new Map(signals.map(s => [s.key, s]));
  const lens = sector === "all" ? null : lensSignals(snap.rows, tiers, sector);
  const points: Record<string, number[]> = Object.fromEntries(series.map(s => [s.key, s.quarters.filter(wellCovered).map(p => p.s as number)]));
  const quarters: Record<string, string[]> = Object.fromEntries(series.map(s => [s.key, s.quarters.filter(wellCovered).map(p => p.q)]));
  const quiet = pageState(streamOf(all).filter(s => s.type !== "launch").map(s => s.happened_at), now) === "quiet";
  const archiveMoves: ArchiveMove[] = quiet ? await import("../rebrands.server").then(m => m.readerRebrands()).then(r => r.rows.map(x => ({ id: `rebrand:${x.id}`, at: x.confirmed_at, headline: rebrandSentence(x), line: x.read ? clip(untick(x.read)) : null, href: `/brands/${encodeURIComponent(x.domain)}`, source: x.source }))).catch(() => []) : [];
  // I1: stored site icons for single-brand rows (the pictures index; an empty map when it can't be read).
  const pics = await picsP;
  const input: FrontInput = {
    icons: iconsFor(pics, all.flatMap(s => (s.domains.length === 1 ? [s.domains[0]!] : []))),
    now, sector, format, stories: all, signals, lens, stages: new Map(signals.map(s => [s.key, s.stage])),
    moving: { items: read.movingItems(moves, headlineKeys, byKey), pair: moves.pair, next: moves.next },
    freshness: fresh?.line ?? null, leadEvidence: null, series: points, seriesQuarters: quarters,
    chart: { composites: signals.filter(s => isComposite(s.key)), headline: signals.filter(s => s.tier === "headline"), series },
    editions: editionsIn(null),
    archiveMoves, patternKeys: new Set(signals.filter(isPatternSignal).map(s => s.key)), brandNames: new Map(index.map(s => [s.domain, s.name])),
    dataStories: studies ?? dataShelf(),
    collections: liveCollections().map(c => ({ slug: c.slug, number: c.number, title: c.title, href: collectionPath(c.slug) })),
  };
  const model = frontModel(input);
  // The lead's evidence slot (I1: real pictures first): before/after crops when two captures straddle the change, else one "after"
  // crop of the changed section, else a single-brand story's own social card; otherwise the sparkline or nothing, as before.
  const lead = model.lead ? all.find(s => s.id === model.lead!.story.id) : null;
  if (lead) {
    // C1 · the lead's pictures from the stored `front-leads` record when it holds this story (a cold server spent ~1.4 s of reads on
    // them), else worked out here as before. Only the story's own sources and the stored pictures decide them, never its text.
    const rec = await leadsP;
    const leadEvidence = rec && lead.id in rec ? rec[lead.id] ?? null : await leadEvidenceOf(lead, pics, input.brandNames);
    if (leadEvidence) return { ...input, leadEvidence };
  }
  return input;
}
type LeadEvidence = NonNullable<FrontInput["leadEvidence"]>;
/** The lead's evidence slot (I1: real pictures first): before/after crops when two captures straddle the change, else one "after"
 *  crop of the changed section, else a single-brand story's own social card; otherwise the sparkline or nothing, as before. */
async function leadEvidenceOf(lead: Story, pics: Awaited<ReturnType<typeof picturesSafe>>, names: ReadonlyMap<string, string | null>): Promise<LeadEvidence | null> {
  const one = lead.domains.length === 1 ? lead.domains[0]! : null;
  const ps = await import("../stories/page.server");
  const ev = ["move", "counter_move", "rebrand", "roundup"].includes(lead.type) ? await ps.evidenceOf(lead, lead.type).catch(() => null) : null;
  // I3: the lead picture by rule (lead-picture.ts); the older slot logic stays as the fallback when the lookup fails.
  const { censusLines } = await import("../stories/view");
  const plan = await ps.leadOf(lead, ev, { colourEvents: await ps.colourEventsOf(lead).catch(() => []), census: lead.id.startsWith("census:") ? censusLines(Array.isArray(lead.facts) ? lead.facts as never : []) : null, chart: false, names: names }).catch(() => null);
  const pair = ev && lead.type !== "roundup" ? ev : null;
  const cover = one ? coverOf(one, pics.get(one) ?? NO_PICS) : null;
  const leadEvidence = plan ? { id: lead.id, crops: null, plan }
    : pair?.compare ? { id: lead.id, crops: { section: pair.sectionName ?? "", before: pair.compare.before, after: pair.compare.after } }
    : pair?.after ? { id: lead.id, crops: null, crop: { section: pair.sectionName ?? "", crop: pair.after } }
    : cover?.kind === "card" ? { id: lead.id, crops: null, cover } : null;
  return leadEvidence;
}
/** C1 · the stories the front page can lead with: published in the last week (a quiet day leads with an older story), newest first, at
 *  most this many. */
export const FRONT_LEADS_MAX = 12;
const LEADS_WINDOW_MS = 7 * 864e5;
/** C1 · `front-leads`: each lead-able story's evidence slot, keyed by story id, written by the story build and the records sweep like
 *  `front-cards`. No story text: a kill or a new story changes which id leads, and a lead the record lacks is worked out live. */
export async function computeFrontLeads(): Promise<Record<string, LeadEvidence | null>> {
  const [all, pics, { siteTraitIndex }] = await Promise.all([storyIndex(), picturesSafe(), import("../read.server")]);
  const index = await siteTraitIndex().catch(() => []), names = new Map(index.map(s => [s.domain, s.name] as [string, string | null])), now = Date.now();
  const these = streamOf(all).filter(s => s.type !== "launch" && Date.parse(s.happened_at) > now - LEADS_WINDOW_MS)
    .sort((a, b) => b.happened_at.localeCompare(a.happened_at)).slice(0, FRONT_LEADS_MAX);
  const out: Record<string, LeadEvidence | null> = {};
  // Three at a time: each story's pictures take a few reads (the hosted runtime allows six requests at once).
  for (let i = 0; i < these.length; i += 3) await Promise.all(these.slice(i, i + 3).map(async s => { out[s.id] = await leadEvidenceOf(s, pics, names).catch(() => null); }));
  return out;
}
/** Readers read the stored row only (never the twelve-story computation): a missing, unreadable or over-age row reads as empty and the
 *  lead is worked out live, as before. One small read, kept a minute per instance. */
const storedLeads = memo(60_000, async (): Promise<Record<string, LeadEvidence | null> | null> => {
  const [{ readRecord }, { usable }] = await Promise.all([import("../records/store.server"), import("../records/records")]);
  const row = await readRecord<Record<string, LeadEvidence | null>>("front-leads").catch(() => null);
  return row && usable(row, Date.now()) ? row.body : null;
});
export const FRONT_TTL_MS = 20_000;
type Lens = { sector: string; format: FormatFilter };
const lensKey = (k: Lens) => `${k.sector}|${k.format}`;
const inputs = memoBy(FRONT_TTL_MS, (k: Lens) => buildInput(k.sector, k.format), { key: lensKey, max: 100 });
const fronts = memoBy(FRONT_TTL_MS, async (k: Lens) => {
  const [input, editions] = await Promise.all([inputs(k), loadEditionsSafe()]);
  return frontModel({ ...input, editions: editionsIn(editions) });
}, { key: lensKey, max: 100 });
export function loadFront(rawSector: unknown, rawFormat: unknown): Promise<FrontModel> {
  return fronts({ sector: resolveSector(rawSector), format: resolveFormat(rawFormat) });
}
// P1 · shell first: the lead and the live column are critical (built without the editions read); the side column, chart of the day
// and lower lists are deferred. S1 polish: the deferred part reuses the top's build (the same memoised input) and adds only the
// editions, so it is ready as soon as the top is, instead of starting a second full build that a slow database could push past 4 s.
export async function loadFrontTop(rawSector: unknown, rawFormat: unknown): Promise<FrontTop> {
  const k = { sector: resolveSector(rawSector), format: resolveFormat(rawFormat) };
  const m = fronts.peek(k) ?? frontModel(await inputs(k));
  const { chart: _c, launches: _l, strip: _s, collections: _co, editions: _e, dataStories: _d, archive: _a, ...top } = m;
  return top;
}
const restOf = (m: FrontModel): FrontRest => ({ chart: m.chart, launches: m.launches, strip: m.strip, collections: m.collections, editions: m.editions, dataStories: m.dataStories, archive: m.archive, sections: m.sections, format: m.format, sector: m.sector, now: m.now, state: m.state });
/** The editions wait at most this long beside the rest; late, the last editions this instance read are used (or none). */
export const REST_EDITIONS_MS = 2_000;
/** A rest read still running after this is answered with the last good copy this instance sent for the lens, when it has one. */
export const REST_LAST_GOOD_MS = 3_000;
const lastEditions: { v: Editions | null } = { v: null };
const lastRest = new Map<string, FrontRest>();
async function freshRest(k: Lens): Promise<FrontRest> {
  const full = fronts.peek(k);
  if (full) return restOf(full);
  const eds = loadEditionsSafe().then(e => { if (e) lastEditions.v = e; return e; });
  const [input, editions] = await Promise.all([inputs(k), within(eds, REST_EDITIONS_MS, "front editions", () => lastEditions.v)]);
  return restOf(frontModel({ ...input, editions: editionsIn(editions) }));
}
export async function loadFrontRest(rawSector: unknown, rawFormat: unknown): Promise<FrontRest> {
  const k = { sector: resolveSector(rawSector), format: resolveFormat(rawFormat) }, key = lensKey(k);
  if (import.meta.env.DEV) { // PH1 · DEV ONLY proof pictures (`?__launches=1`, dev-late.server.ts); the live build drops this.
    const { devSampleLaunches } = await import("../dev-late.server"), input = await inputs(k), stories = await devSampleLaunches(input.stories);
    if (stories !== input.stories) return restOf(frontModel({ ...input, stories, editions: editionsIn(lastEditions.v ?? await loadEditionsSafe()) }));
  }
  const p = freshRest(k).then(r => { lastRest.delete(key); lastRest.set(key, r); while (lastRest.size > 100) lastRest.delete(lastRest.keys().next().value!); return r; });
  const last = lastRest.get(key);
  if (!last) return p;
  return within(p, REST_LAST_GOOD_MS, "front rest", () => last).catch(() => last);
}
// E3 · Also today's pictures, deferred. E3b: the candidates come from the stored `front-cards` record, which the story build writes
// right after it runs (and the records sweeper keeps fresh); a story newer than the record is computed for itself alone. The pure
// picker (also-pictures.ts) keeps two cards from showing the same picture.
export type AlsoPictures = Record<string, import("../crops").Crop | null>;
type Story = Awaited<ReturnType<typeof storyIndex>>[number];
/** The card candidates of one story: its own first-screen crop or its members' crops in order, then each brand's latest hero crop. */
async function candidatesOf(s: Story, pics: Awaited<ReturnType<typeof picturesSafe>>): Promise<import("../crops").Crop[]> {
  const [{ evidenceOf }, { heroCrop }] = await Promise.all([import("../stories/page.server"), import("../crops")]);
  const ev = ["move", "counter_move", "rebrand", "roundup"].includes(s.type) ? await evidenceOf(s, s.type).catch(() => null) : null;
  const own = ev?.grid ? ev.grid.map(g => g.crop) : ev?.section === "hero" ? [ev.compare?.after ?? ev.after ?? null] : [];
  // I3: a crop that fails the lead-quality rule (near-blank, flat, too small) is never a card's picture.
  const ok = await import("../lead-picture.server").then(m => m.cropOkFn()).catch(() => () => true);
  return candidateList([...own, ...s.domains.map(d => { const h = pics.get(d)?.hero; return h ? heroCrop(d, h) : null; })].filter(c => !c || ok(c)));
}
/** Stories the front page can show as cards: published in the last two days. */
const CARD_WINDOW_MS = 2 * 864e5;
export async function computeFrontCards(ids?: readonly string[]): Promise<CardCandidates> {
  const [all, pics] = await Promise.all([storyIndex(), picturesSafe()]);
  const want = ids ? new Set(ids) : null, now = Date.now();
  const these = streamOf(all).filter(s => (want ? want.has(s.id) : Date.parse(s.happened_at) > now - CARD_WINDOW_MS));
  const out: CardCandidates = {};
  await Promise.all(these.map(async s => { out[s.id] = await candidatesOf(s, pics).catch(() => []); }));
  return out;
}
export const frontCards = stored("front-cards", () => computeFrontCards(), { ttl: 60_000 });
const alsos = memoBy(FRONT_TTL_MS, async (k: { sector: string; format: FormatFilter }): Promise<AlsoPictures> => {
  const m = fronts.peek(k) ?? frontModel(await inputs(k));
  if (!m.also.length) return {};
  const rec = await frontCards().catch(() => ({} as CardCandidates));
  const missing = m.also.filter(a => !(a.id in rec)).map(a => a.id);
  const cands = missing.length ? { ...rec, ...await computeFrontCards(missing).catch(() => ({} as CardCandidates)) } : rec;
  return pickAlsoPictures(m.also.map(a => ({ id: a.id, gathered: !a.domain })), cands);
}, { key: k => `${k.sector}|${k.format}`, max: 100 });
export const loadFrontAlso = (rawSector: unknown, rawFormat: unknown) => alsos({ sector: resolveSector(rawSector), format: resolveFormat(rawFormat) });
export const loadFrontUpdates = async (sector: unknown, format: unknown) => updatesOf(await loadFront(sector, format));
