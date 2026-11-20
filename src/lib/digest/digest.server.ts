// Digest + explainer loaders: anonymous SELECT-only reads of stored rows for one week (never today's data for an old issue).
import { comparisonPair } from "../run-gap";
import { fetchRealRuns, fetchStageRows } from "../real-runs";
import { supabaseAnon } from "../mcp/supabase";
import { DIGEST_FIRST_WEEK } from "../site";
import { weekRange } from "./week";
import { issueModel, archiveEntries, STORIES_FIRST_WEEK, type WeekStory, type IssueRows, type FRow, type SiteEvent, type FontMove, type StoredBrief, type RebrandLite } from "./issue";
import { traitModel, type TraitRows } from "./trait";
import type { CardModel } from "../chart/card";
import type { ThumbRow } from "../thumbs";
import { basis, canonical, explainerPath, label, stageName } from "../labels";
import { traitDefinition } from "./copy";
import { evidenceKeys, tierFor } from "../tiers";
import { tiersFrom } from "../signals";
import { asOf, ledgerSummary, type StoredCall } from "../ledger/ledger";
import { readerRunId } from "../real-runs";
import { storedBy } from "../records/store.server";
import { pageKey } from "../records/records";
type Db = ReturnType<typeof supabaseAnon>;
async function pages<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, size = 500) {
  const out: T[] = [];
  for (let from = 0; ; from += size) { const { data, error } = await page(from, from + size - 1); if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < size) break; }
  return out;
}
const must = <T,>(r: { data: T; error: unknown }) => { if (r.error) throw r.error; return r.data; };
const FCOLS = "dimension,value,scope,status,stage,current_share,momentum,next_wave_score,sites:components->sites,lead_sites:evidence->sites";

async function fontMoves(db: Db, start: string, end: string) {
  const { fontSnapshot } = await import("../mcp/store.server");
  const { movers } = await import("../mcp/analysis");
  const latest = await fontSnapshot(end); if (!latest) return null;
  const dayBefore = new Date(Date.parse(`${start}T00:00:00Z`) - 864e5).toISOString().slice(0, 10);
  let earlierDate = must(await db.from("gfont_snapshots").select("captured_on").lte("captured_on", dayBefore).order("captured_on", { ascending: false }).limit(1))?.[0]?.captured_on
    ?? must(await db.from("gfont_snapshots").select("captured_on").gte("captured_on", start).order("captured_on").limit(1))?.[0]?.captured_on;
  if (!earlierDate || earlierDate >= latest.date) return null;
  const earlier = await fontSnapshot(earlierDate); if (!earlier) return null;
  const pick = (dir: "rising" | "falling"): FontMove[] => movers(latest.rows, earlier.rows, { direction: dir, limit: 12 }).map(m => ({ family: m.family, category: m.category, change: m.popularity_change ?? 0, rank: m.popularity_rank }));
  return { date: latest.date, since: earlier.date, rising: pick("rising"), fading: pick("falling") };
}

export async function issueRows(week: string | null): Promise<IssueRows | null> {
  const db = supabaseAnon();
  let q = db.from("weekly_briefs").select("week,run_id,brief").gte("week", DIGEST_FIRST_WEEK);
  q = week ? q.eq("week", week) : q.order("week", { ascending: false });
  const b = must(await q.limit(1).maybeSingle());
  if (!b) return null;
  const range = weekRange(b.week); if (!range) return null;
  const runId = b.run_id;
  const [run, card, prevRuns, alerts, typeEvents, colorEvents, sites, thumbs, libCount, crawl, wire] = await Promise.all([
    runId == null ? Promise.resolve(null) : db.from("forecast_runs").select("id,computed_at,data_through:model_card->>data_through").eq("id", runId).maybeSingle().then(must),
    db.from("chart_cards").select("model").eq("week", b.week).maybeSingle().then(must),
    runId == null ? Promise.resolve([]) : db.from("forecast_runs").select("id").eq("status", "ok").lt("id", runId).order("id", { ascending: false }).limit(2).then(must),
    runId == null ? Promise.resolve([]) : db.from("wire_items").select("title,ref,url,tags,published_at").eq("source_kind", "alert").ilike("url", `%alert=${runId}-%`).order("published_at", { ascending: false }).limit(20).then(must),
    pages<SiteEvent>((f, t) => db.from("library_event_feed").select("domain,sector,before,after,detected_at").eq("source", "live").eq("type", "type_change").eq("page_type", "home").eq("viewport", "desktop").gte("detected_at", range.startIso).lt("detected_at", range.endIso).order("detected_at", { ascending: false }).range(f, t) as never),
    pages<SiteEvent>((f, t) => db.from("library_event_feed").select("domain,sector,before,after,detected_at").eq("source", "live").eq("type", "palette_shift").eq("page_type", "home").eq("viewport", "desktop").gte("detected_at", range.startIso).lt("detected_at", range.endIso).order("detected_at", { ascending: false }).range(f, t) as never),
    pages<{ domain: string; sector: string; name: string | null }>((f, t) => db.from("library_sites").select("domain,sector,name").order("domain").range(f, t) as never),
    pages<ThumbRow>((f, t) => db.from("site_thumbs").select("domain,captured_at,viewport,path,width,height,bytes,variants").order("id").range(f, t) as never),
    db.from("library_sites").select("domain", { count: "exact", head: true }).eq("active", true).lt("added_at", range.endIso),
    db.from("crawl_runs").select("finished_at,stats").eq("status", "finished").lt("finished_at", range.endIso).order("finished_at", { ascending: false }).limit(1).maybeSingle().then(must),
    db.from("wire_items").select("id", { count: "exact", head: true }).neq("source_kind", "alert").gte("published_at", range.startIso).lt("published_at", range.endIso),
  ]);
  // Ledger as it stood at the end of the issue week (later resolutions don't rewrite old issues).
  const ledgerCalls = await pages<StoredCall>((f, t) => db.from("forecast_calls").select("made_at,resolved_at,outcome,trait,stage_at_call,target_quarter").lt("made_at", range.endIso).order("id").range(f, t) as never);
  const ledger = ledgerSummary(asOf(ledgerCalls, range.endIso));
  if (libCount.error || wire.error) throw libCount.error ?? wire.error;
  const [prevRun, prev2Run] = (prevRuns ?? []) as { id: number }[];
  const [forecasts, previous, previous2] = runId == null ? [[], [], []] : await Promise.all([
    pages<FRow>((f, t) => db.from("forecasts").select(FCOLS).eq("run_id", runId).order("scope").order("dimension").order("value").range(f, t) as never),
    prevRun ? pages<FRow>((f, t) => db.from("forecasts").select("dimension,value,stage,momentum,current_share").eq("run_id", prevRun.id).eq("scope", "all").order("dimension").order("value").range(f, t) as never) : Promise.resolve([]),
    prev2Run ? pages<FRow>((f, t) => db.from("forecasts").select("dimension,value,stage").eq("run_id", prev2Run.id).eq("scope", "all").order("dimension").order("value").range(f, t) as never) : Promise.resolve([]),
  ]);
  // Movers compare this run only with the most recent real run at least MIN_RUN_GAP_DAYS older (closer runs are reruns, not a week).
  const real = runId == null ? [] : await fetchRealRuns(db, { upTo: runId, extra: [runId] });
  const pair = comparisonPair(real), partner = pair && pair.latest.id === runId ? pair.earlier.id : null;
  const compare: FRow[] = partner == null ? [] : partner === prevRun?.id ? previous : (await fetchStageRows(db, partner)).map(r => ({ ...r, scope: "all" }));
  // Tiers as of this issue's run (and its two previous runs), so an old issue's selection never changes with newer data.
  const prevStages = new Map<string, (string | null)[]>();
  for (const [i, list] of [previous, previous2].entries()) for (const p of list) { const k = `${p.dimension}:${p.value}`, a = prevStages.get(k) ?? [null, null]; a[i] = p.stage; prevStages.set(k, a); }
  const tiers = tiersFrom((forecasts as (FRow & { status: string })[]).map(f => ({ ...f, status: f.status ?? "ok", next_wave_score: f.next_wave_score ?? null, sites: f.sites ?? null })), prevStages);
  const families = [...new Set(typeEvents.flatMap(e => ["h1", "body"].map(k => e.after?.[k]).filter((x): x is string => typeof x === "string" && !!x)))];
  const [google, fonts, rebrandAll] = await Promise.all([
    families.length ? db.from("font_catalog").select("family").eq("source", "google").in("family", families).then(must) : Promise.resolve([]),
    fontMoves(db, range.start, range.end),
    import("../rebrands.server").then(m => m.readerRebrands()),
  ]);
  const crawlSites = crawl?.stats && typeof crawl.stats === "object" ? Object.values(crawl.stats as Record<string, { ok?: number }>).reduce((s, v) => s + (typeof v?.ok === "number" ? v.ok : 0), 0) : 0;
  const rebrands: RebrandLite[] = rebrandAll.rows.filter(x => x.source === "live" && x.confirmed_at >= range.startIso && x.confirmed_at < range.endIso)
    .map(x => ({ domain: x.domain, sector: x.sector, name: x.name, confirmed_at: x.confirmed_at, read: x.read, reasons: x.reasons, seasonal: x.seasonal, before: { h1: x.before.h1, accent: x.before.accent }, after: { h1: x.after.h1, accent: x.after.accent } }));
  // The week in stories: published stories of the issue week as they stood when it ended (later edits never rewrite an old issue).
  const stories = b.week >= STORIES_FIRST_WEEK ? await weekStories(range.startIso, range.endIso).catch(() => null) : null;
  return {
    week: b.week, brief: b.brief as unknown as StoredBrief, stories,
    run: run ? { id: run.id, computed_at: run.computed_at, data_through: (run as { data_through: string | null }).data_through } : null,
    card: (card?.model as unknown as CardModel | undefined) ?? null, forecasts, previous: compare, alerts: alerts ?? [], headline: [...tiers.values()].filter(t => t.tier === "headline").map(t => t.key), fonts, typeEvents, googleFamilies: (google ?? []).map(g => g.family), colorEvents, sites, thumbs, rebrands,
    numbers: { ledger: { rate: ledger.rate, hits: ledger.hits, resolved: ledger.resolved }, library_sites: libCount.count ?? null, crawl: crawl?.finished_at && crawlSites ? { finished_at: crawl.finished_at, sites: crawlSites } : null, wire_stories: wire.count ?? 0 },
  };
}
async function weekStories(startIso: string, endIso: string): Promise<WeekStory[]> {
  const [{ storyRaw }, { shownAsOf, MORNING_BASELINE }, { streamOf }] = await Promise.all([import("../stories/read.server"), import("../editions/morning"), import("../stories/view")]);
  const end = Math.min(Date.parse(endIso), Date.now()), known = Math.min(Math.max(Date.parse(endIso), Date.parse(MORNING_BASELINE)), Date.now());
  return streamOf(shownAsOf(await storyRaw(), end, known)).filter(s => s.type !== "launch" && s.happened_at >= startIso && s.happened_at < endIso)
    .map(s => ({ id: s.id, number: s.number ?? null, type: s.type, kicker: s.kicker, headline: s.headline, deck: s.deck, happened_at: s.happened_at, sector: s.sector, score: s.score }));
}
export async function computeIssue(week: string | null) { const rows = await issueRows(week); return rows ? issueModel(rows) : null; }
// P1: an issue whose week has ended never changes (stories as they stood at its end, the run it was written from), so finished
// weeks are precomputed records (records.ts "digest"); the issue still in its week, or one not yet stored, is computed live.
const issueRecord = storedBy((week: string) => pageKey("digest", week), (week: string) => computeIssue(week));
export const finishedWeek = (week: string, now = Date.now()) => { const r = weekRange(week); return !!r && Date.parse(r.endIso) <= now; };
/** The newest issue weeks (records the sweeper keeps). */
export async function latestIssueWeeks(n = 4): Promise<string[]> {
  return ((must(await supabaseAnon().from("weekly_briefs").select("week").gte("week", DIGEST_FIRST_WEEK).order("week", { ascending: false }).limit(n)) ?? []) as { week: string }[]).map(b => b.week);
}
export async function loadIssue(week: string | null) {
  const w = week ?? (await latestIssueWeeks(1))[0] ?? null;
  if (!w) return null;
  return finishedWeek(w) ? issueRecord(w) : computeIssue(w);
}
export async function loadArchive(limit = 60) {
  const db = supabaseAnon();
  const [briefs, cards] = await Promise.all([
    db.from("weekly_briefs").select("week,headline:brief->>headline").gte("week", DIGEST_FIRST_WEEK).order("week", { ascending: false }).limit(limit).then(must),
    db.from("chart_cards").select("week,model").gte("week", DIGEST_FIRST_WEEK).order("week", { ascending: false }).limit(limit).then(must),
  ]);
  const byWeek = new Map((cards ?? []).map(c => [c.week, c.model as unknown as CardModel]));
  return archiveEntries((briefs ?? []).map(b => ({ week: b.week, headline: (b as { headline: string | null }).headline ?? "", card: byWeek.get(b.week) ?? null })));
}

const TCOLS = "dimension,value,scope,status,stage,current_share,momentum,next_wave_score,components,quarters:evidence->quarters,lead_sites:evidence->sites,proj_q1,proj_q1_lo,proj_q1_hi,proj_q2,proj_q2_lo,proj_q2_hi,proj_q4,proj_q4_lo,proj_q4_hi,run_id,computed_at";
export async function traitRows(rawKey: string): Promise<TraitRows | null> {
  const key = canonical(rawKey), i = key.indexOf(":");
  if (i <= 0) return null;
  const dimension = key.slice(0, i), value = key.slice(i + 1);
  const db = supabaseAnon(), runId = await readerRunId(db);
  const rows = must(await db.from("forecasts").select(TCOLS).eq("run_id", runId).eq("dimension", dimension).eq("value", value).order("scope"));
  if (!rows?.length) return null;
  const [peers, sites, card] = await Promise.all([
    pages<{ dimension: string; value: string; stage: string | null; current_share: number | null; momentum: number | null }>((f, t) => db.from("forecasts").select("dimension,value,stage,current_share,momentum").eq("run_id", runId).eq("scope", "all").order("dimension").order("value").range(f, t) as never),
    pages<{ domain: string; sector: string; name: string | null }>((f, t) => db.from("library_sites").select("domain,sector,name").order("domain").range(f, t) as never),
    db.from("forecast_runs").select("data_through:model_card->>data_through").eq("id", runId).maybeSingle().then(must),
  ]);
  const domains = [...new Set(rows.flatMap(r => (((r as { lead_sites?: { domain: string }[] | null }).lead_sites) ?? []).map(s => s.domain)))].slice(0, 40);
  const [thumbs, calls] = await Promise.all([
    domains.length ? db.from("site_thumbs").select("domain,captured_at,viewport,path,width,height,bytes,variants").in("domain", domains).then(must) : Promise.resolve([]),
    db.from("forecast_calls").select("*").eq("trait", key).order("made_at", { ascending: false }).order("id", { ascending: false }).limit(24).then(must),
  ]);
  // Tier, Momentum, Confidence and evidence from the latest stored run (same pure code as the terminal).
  const { latestSignals } = await import("../signals.server");
  const { tiers, signals } = await latestSignals("all").catch(() => ({ tiers: new Map(), signals: [] as Awaited<ReturnType<typeof latestSignals>>["signals"] }));
  const byKey = new Map(signals.map(s => [s.key, s]));
  const evidence = evidenceKeys(key).map(k => { const l = label(k), x = byKey.get(k); return { key: k, name: l.name, dimension: l.dimension, basis: basis(k), tier: tierFor(tiers, k), stage: x?.stage ?? null, share: x?.share ?? null, href: explainerPath(k) }; });
  // Brands showing it now and recent stories naming it (shared Read-mode caches; never fail the page).
  const { siteTraitIndex } = await import("../read.server"), { storyIndex } = await import("../stories/read.server"), { storiesAbout } = await import("../stories/view");
  const [index, stories] = await Promise.all([siteTraitIndex().catch(() => []), storyIndex().then(all => storiesAbout(all, { signal: key, limit: 5 })).catch(() => [])]);
  const showing = index.filter(s => s.traits.includes(key)).sort((a, b) => (b.captured ?? "").localeCompare(a.captured ?? "") || a.domain.localeCompare(b.domain)).map(s => ({ domain: s.domain, name: s.name, sector: s.sector }));
  return { key, showing, stories, signal: byKey.get(key) ?? null, tier: tiers.get(key) ?? null, evidence, headline: tiers.size ? [...tiers.values()].filter(t => t.tier === "headline").map(t => t.key) : null, rows: rows as unknown as TraitRows["rows"], peers, sites, thumbs: (thumbs ?? []) as ThumbRow[], data_through: (card as { data_through: string | null } | null)?.data_through ?? null, calls: (calls ?? []) as unknown as StoredCall[] };
}
export async function loadTrait(key: string) { const rows = await traitRows(key); return rows ? traitModel(rows) : null; }
/** P1, critical for /signals/<key>: what the head and the title need, from the stored signals snapshot alone (the same reader run
 * as the full page), or null when the run has no all-sector row for the key (404). Examples, peers, calls and stories are deferred. */
export async function loadTraitHead(rawKey: string) {
  const key = canonical(rawKey), i = key.indexOf(":");
  if (i <= 0) return null;
  const { latestSignals } = await import("../signals.server");
  const { snap, tiers } = await latestSignals("all");
  const all = snap.rows.find(r => r.scope === "all" && r.dimension === key.slice(0, i) && r.value === key.slice(i + 1));
  if (!all) return null;
  const l = label(key);
  return { key, name: l.name, dimension: l.dimension, basis: basis(key), stage: stageName(all.stage), tier: tiers.get(key)?.tier ?? null, share: all.current_share, momentum: all.momentum, definition: traitDefinition(key) };
}
