// Weekly forecast job: loads public aggregates, runs pure models, persists a run. Service-role writes only.
import { forecastSeries, backtestSeries, median, qIndex, usablePoints, type SeriesPoint } from "./forecast";
import { crossingQuarter, nextWaveIneligibleReason, trendsetterScores, trendsetterGap, leadLag, keywordCount, nextWaveScores, forecastSiteTraits, siteTraits, emptyComponents, presentComponents, COMPONENT_KEYS, type SiteRow, type Components } from "./forecast-signals";
import { EXCLUDED_DIMENSIONS, TRAIT_SPREAD, TRAIT_GFONT_CATEGORY, NEXT_WAVE_WEIGHTS, LEGACY_NEXT_WAVE_WEIGHTS } from "./forecast-constants";
import { traitCuration, galleryMix, crawlSiteTraits, type CrawlTraitSite } from "./curation";
import { discourseSignal, traitTermMap, weeklyBuckets, DISCOURSE_WEEKS, type DiscourseSignal } from "./discourse";
import { gfAdditions, supplyValue, isFlooding, FLOODING_NOTE, type FirstSeen } from "./supply";
import { alertCandidates, alertRow, selectAlerts, ALERT_DEDUPE_DAYS, type Alert, type AlertInput } from "./alerts";
import { SECTORS } from "./library";
import { providerLabel } from "./ai-provider";
import { crawlCoverage, runErrorText, runSteps, type RunOptions } from "./forecast-run";
import { compositeSeries, isComposite } from "./composites";
import { headlineKeys, restrictToHeadline } from "./tiers";
type Db = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
async function pages<T>(f: (from: number) => PromiseLike<{ data: T[] | null; error: unknown }>) { const out: T[] = []; for (let from = 0; ; from += 1000) { const { data, error } = await f(from); if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < 1000) break; } return out; }
const CUTOFF = "2025Q2", KEEP_RUNS = 12, MIN_OBSERVED = 3;
const AI_DIMENSIONS = ["imagery", "aesthetic", "components", "hero_layout", "ai_positioning", "tone", "color_mood"];

/** Weekly defaults run every step. Sandbox/dev runs pass { brief: false, alerts: "off", ledger: false, derived: false, prune: false } (see scripts/forecast-dev-run.ts). */
export async function runForecast(opts: RunOptions = {}) {
  const steps = runSteps(opts);
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const run = await db.from("forecast_runs").insert({ status: "running" }).select("id").single();
  if (run.error) throw run.error; const runId = run.data.id;
  let stage = "compute";
  try {
    const result = await compute(db, runId);
    stage = "store";
    const fin = await db.from("forecast_runs").update({ status: "ok", data_cutoff_quarter: result.cutoff, coverage: result.coverage, model_card: result.card }).eq("id", runId);
    if (fin.error) throw fin.error;
    stage = "alerts";
    const alerts = steps.alerts === "off" ? null : await emitAlerts(db, runId, result.alertInputs, steps.alerts === "dry", result.headline);
    stage = "prune";
    if (steps.prune) {
      const old = await db.from("forecast_runs").select("id").order("id", { ascending: false }).range(KEEP_RUNS, KEEP_RUNS + 500);
      if (old.data?.length) await db.from("forecast_runs").delete().in("id", old.data.map(r => r.id));
    }
    // Derived outputs never fail a stored forecast: taste tables (own health job), brief, vibe map, then the brief's Chart of the Week.
    let taste: unknown = null, vibe: unknown = null;
    if (steps.derived) {
      const { refreshTaste } = await import("./taste/refresh.server");
      taste = await refreshTaste().then(() => ({ ok: true }), e => { console.error("forecast taste refresh failed:", runErrorText("taste", e)); return { ok: false, code: runErrorText("taste", e) }; });
    }
    let brief: unknown = null;
    if (steps.brief) { const { generateWeeklyBrief } = await import("./forecast-brief.server"); brief = await generateWeeklyBrief(runId).catch(e => ({ ok: false, code: e instanceof Error ? e.message : "brief_failed" })); }
    if (steps.derived) { const { computeVibe } = await import("./vibe.server"); vibe = await computeVibe(runId).catch(e => ({ ok: false, code: e instanceof Error ? e.message : "vibe_failed" })); }
    let chart: unknown = null;
    if (steps.brief) { const { generateChartCard } = await import("./chart/chart.server"); chart = await generateChartCard().catch(e => ({ ok: false, code: e instanceof Error ? e.message : "chart_failed" })); }
    // Forecast ledger last, so it sees this run's brief and alerts: records the calls, then resolves open ones. Never fails the run.
    let ledger: unknown = null;
    if (steps.ledger) { const { nonFatal } = await import("./ledger/ledger"); ledger = await nonFatal("ledger", async () => (await import("./ledger/store.server")).ledgerStep(runId)); }
    return { ok: true, run_id: runId, steps, model_card: result.card, alerts, taste, brief, vibe, chart, ledger };
  } catch (e) {
    const error = runErrorText(stage, e);
    console.error("forecast run failed:", error);
    // A run already stored as ok stays ok (alerts/prune failures are reported, not rewritten).
    if (stage === "compute" || stage === "store") await db.from("forecast_runs").update({ status: "error", error }).eq("id", runId);
    throw e;
  }
}

async function compute(db: Db, runId: number) {
  const since90 = new Date(Date.now() - 90 * 864e5).toISOString(), since30 = Date.now() - 30 * 864e5;
  const [share, sites, spread, wire, gfLatest] = await Promise.all([
    pages(f => db.from("library_history_share").select("quarter,sector,dimension,value,denom,share,coverage").order("quarter").order("sector").order("dimension").order("value").range(f, f + 999)),
    pages(f => db.from("library_site_history").select("domain,quarter,sector,theme,h1_family,webfont,h1_tracking,css_features,frameworks,hero_media,ai_tags,h1_size_px,cta_radius_bucket,whitespace_ratio").order("domain").order("quarter").range(f, f + 999)),
    db.from("crawl_spread").select("signal,spread_pts,vanguard_share,mainstream_share").eq("scope", "all"),
    pages(f => db.from("wire_items").select("title,excerpt,published_at").gte("published_at", since90).order("id").range(f, f + 999)),
    db.from("gfont_snapshots").select("captured_on").order("captured_on", { ascending: false }).limit(1),
  ]);
  if (spread.error || gfLatest.error) throw spread.error ?? gfLatest.error;
  const gfDay = gfLatest.data[0]?.captured_on;
  const gfTop = gfDay ? (await db.from("gfont_snapshots").select("category,trending_rank").eq("captured_on", gfDay).not("trending_rank", "is", null).order("trending_rank").limit(50)).data ?? [] : [];
  const now = Date.now();
  const crawlLatest = await db.from("crawl_latest").select("id,prev_id").limit(1);
  if (crawlLatest.error) throw crawlLatest.error;
  const latestId = crawlLatest.data[0]?.id ?? null;
  const [crawlRun, curatedCount] = latestId ? await Promise.all([
    db.from("crawl_runs").select("finished_at").eq("id", latestId).maybeSingle(),
    db.from("crawl_sites").select("domain", { count: "exact", head: true }).eq("run_id", latestId).eq("index_name", "curated").eq("ok", true),
  ]) : [null, null];
  if (crawlRun?.error || curatedCount?.error) throw crawlRun?.error ?? curatedCount?.error;
  // Stale or missing crawl data drops the crawl-derived components (vanguard, curation) for this run; the run itself still succeeds.
  const crawlCov = crawlCoverage({ run: latestId, finished_at: crawlRun?.data?.finished_at ?? null, curated_sites: curatedCount?.count ?? 0 }, now);
  const crawlIds = crawlCov.use ? [crawlLatest.data[0]?.id, crawlLatest.data[0]?.prev_id].filter((x): x is string => !!x) : [];
  const [crawlRows, discourseRows, firstSeen, prevRunRes] = await Promise.all([
    crawlIds.length ? pages(f => db.from("crawl_sites").select("run_id,domain,index_name,type,color,layout,tech,galleries").in("run_id", crawlIds).eq("ok", true).order("run_id").order("domain").range(f, f + 999)) : Promise.resolve([]),
    pages(f => db.from("discourse_counts").select("window_start,term,n,fatigue,sampled_posts").gte("window_start", new Date(now - DISCOURSE_WEEKS * 7 * 864e5).toISOString()).order("window_start").order("source").order("term").range(f, f + 999)),
    pages(f => db.from("gfont_first_seen").select("family,category,first_seen").order("family").range(f, f + 999)),
    db.from("forecast_runs").select("id").eq("status", "ok").lt("id", runId).order("id", { ascending: false }).limit(2),
  ]);
  if (prevRunRes.error) throw prevRunRes.error;
  const prevRunId = prevRunRes.data[0]?.id ?? null, prev2RunId = prevRunRes.data[1]?.id ?? null;
  const failedRes = await db.from("forecast_runs").select("id,computed_at,error").eq("status", "error").gt("id", prevRunId ?? 0).lt("id", runId).order("id").limit(10);
  if (failedRes.error) throw failedRes.error;
  const failedSince = (failedRes.data ?? []).map(r => ({ run_id: r.id, at: r.computed_at, error: r.error ?? null }));
  const prevRows = prevRunId ? await pages(f => db.from("forecasts").select("dimension,value,scope,current_share,stage").eq("run_id", prevRunId).eq("scope", "all").order("dimension").order("value").range(f, f + 999)) : [];
  const prevByTrait = new Map(prevRows.map(r => [`${r.dimension}:${r.value}`, r]));
  const prev2Rows = prev2RunId ? await pages(f => db.from("forecasts").select("dimension,value,stage").eq("run_id", prev2RunId).eq("scope", "all").order("dimension").order("value").range(f, f + 999)) : [];
  const prev2ByTrait = new Map(prev2Rows.map(r => [`${r.dimension}:${r.value}`, r.stage]));
  // Stage-change alerts compare against the newest real run at least MIN_RUN_GAP_DAYS older (alertBaseline), so a rerun cannot fire them; prevByTrait stays for everything else.
  const { fetchRealRuns } = await import("./real-runs"), { alertBaseline } = await import("./run-gap");
  const alertBase = alertBaseline(await fetchRealRuns(db as never, { upTo: runId - 1 }), { id: runId, at: new Date(now).toISOString() });
  const alertPrevRows = !alertBase ? [] : alertBase.id === prevRunId ? prevRows : await pages(f => db.from("forecasts").select("dimension,value,scope,current_share,stage").eq("run_id", alertBase.id).eq("scope", "all").order("dimension").order("value").range(f, f + 999));
  const alertPrevByTrait = new Map(alertPrevRows.map(r => [`${r.dimension}:${r.value}`, r]));
  const latestCrawl = crawlRows.filter(r => r.run_id === crawlIds[0]) as CrawlTraitSite[], prevCrawl = crawlRows.filter(r => r.run_id === crawlIds[1]) as CrawlTraitSite[];
  const curNow = traitCuration(latestCrawl), curPrev = traitCuration(prevCrawl), mix = galleryMix(latestCrawl);
  const phTraits = new Map<string, number>();
  for (const s of latestCrawl) if (s.index_name === "curated" && s.galleries?.includes("producthunt")) for (const t of crawlSiteTraits(s)) phTraits.set(t, (phTraits.get(t) ?? 0) + 1);
  const phCrawled = latestCrawl.some(s => s.galleries?.includes("producthunt"));
  const traitTerms = traitTermMap(), seen = firstSeen.filter((r): r is FirstSeen => !!r.family && !!r.first_seen);
  const texts90 = wire.map(w => `${w.title ?? ""} ${w.excerpt ?? ""}`), texts30 = wire.filter(w => w.published_at && Date.parse(w.published_at) >= since30).map(w => `${w.title ?? ""} ${w.excerpt ?? ""}`);

  // Series per trait/scope. AI-tag dimensions use AI-tagged captures as the denominator so untagged archive quarters cannot fake a crossing.
  const tagged = new Map<string, number>();
  for (const s of sites) if (s.quarter && s.ai_tags && typeof s.ai_tags === "object" && Object.keys(s.ai_tags).length) for (const sc of ["all", s.sector ?? ""]) tagged.set(`${s.quarter}|${sc}`, (tagged.get(`${s.quarter}|${sc}`) ?? 0) + 1);
  const series = new Map<string, SeriesPoint[]>();
  for (const r of share) {
    if (!r.dimension || !r.value || !r.sector || !r.quarter || EXCLUDED_DIMENSIONS.includes(r.dimension)) continue;
    let denom = Number(r.denom ?? 0), sh = r.share, cov = r.coverage ?? 0;
    if (AI_DIMENSIONS.includes(r.dimension)) { const t = tagged.get(`${r.quarter}|${r.sector}`) ?? 0; sh = t && sh !== null ? Math.min(1, sh * denom / t) : null; cov = denom ? cov * t / denom : 0; denom = t; }
    const k = `${r.dimension}:${r.value}|${r.sector}`; const l = series.get(k) ?? []; l.push({ quarter: r.quarter, share: sh, denom, coverage: cov }); series.set(k, l);
  }
  // Composite signals (combo:*) per site, on the same per-quarter denominators and coverage as library_history_share.
  const base = new Map<string, { denom: number; coverage: number }>();
  for (const r of share) if (r.quarter && r.sector && !base.has(`${r.quarter}|${r.sector}`)) base.set(`${r.quarter}|${r.sector}`, { denom: Number(r.denom ?? 0), coverage: r.coverage ?? 0 });
  for (const [k, pts] of compositeSeries(sites.filter(s => s.domain && s.quarter && s.sector) as SiteRow[], base, siteTraits)) series.set(k, pts);
  const traits = [...new Set([...series.keys()].map(k => k.split("|")[0]!))].sort();
  const allPts = (t: string) => series.get(`${t}|all`) ?? [];
  const latestAll = traits.flatMap(t => usablePoints(allPts(t), "all").slice(-1).map(p => p.quarter)).sort((a, b) => qIndex(a) - qIndex(b)).at(-1) ?? null;

  // Trendsetters: traits crossing 20% library-wide
  // Composites stay out of trendsetter crossings: their fragments already count, so a site's lead is not credited twice.
  const crossings = Object.fromEntries(traits.filter(t => !isComposite(t)).map(t => [t, crossingQuarter(allPts(t), "all", 0.2)]).filter((e): e is [string, string] => !!e[1]));
  const siteRows = sites.filter(s => s.domain && s.quarter) as SiteRow[];
  const setters = trendsetterScores(siteRows, crossings).filter(s => s.observed >= MIN_OBSERVED);
  const top30 = new Set(setters.filter(s => s.score > 0).slice(0, 30).map(s => s.domain));
  const latestPerSite = (rows: SiteRow[], maxQ?: string) => { const m = new Map<string, SiteRow>(); for (const r of rows) if (!maxQ || qIndex(r.quarter) <= qIndex(maxQ)) { const p = m.get(r.domain); if (!p || qIndex(r.quarter) > qIndex(p.quarter)) m.set(r.domain, r); } return [...m.values()]; };
  const latestSites = latestPerSite(siteRows);

  const rows: { [k: string]: unknown; scope: string; dimension: string; value: string; status: string; next_wave_score?: number | null; components: Record<string, unknown> }[] = []; const bt: { mae: number; hit: number }[] = []; const allComponents: { trait: string; c: Components }[] = [];
  for (const scope of ["all", ...SECTORS]) {
    for (const t of traits) {
      const pts = series.get(`${t}|${scope}`); if (!pts) continue;
      const [dimension, value] = [t.slice(0, t.indexOf(":")), t.slice(t.indexOf(":") + 1)];
      const f = forecastSeries(pts, scope), b = backtestSeries(pts, scope, CUTOFF);
      if (b.status === "ok" && scope === "all" && !isComposite(t)) bt.push({ mae: b.mae_pts, hit: b.hit_rate });
      const spKey = TRAIT_SPREAD[t], sp = spKey && crawlCov.use ? spread.data.find(s => s.signal === spKey) : undefined;
      const cat = TRAIT_GFONT_CATEGORY[t], gf = cat && gfTop.length ? gfTop.filter(g => g.category === cat).length / gfTop.length * 100 : null;
      const w30 = keywordCount(t, texts30), w90 = keywordCount(t, texts90);
      const cur = scope === "all" ? curNow.get(t) : undefined, prv = scope === "all" ? curPrev.get(t) : undefined;
      const termSet = scope === "all" ? traitTerms.get(t) : undefined;
      const disc: DiscourseSignal | null = termSet ? discourseSignal(weeklyBuckets(discourseRows, termSet, now)) : null;
      const gfAdd = scope === "all" && cat ? gfAdditions(seen, cat, now) : null, phSites = scope === "all" && cat && phCrawled ? phTraits.get(t) ?? 0 : null;
      const supply = scope === "all" && cat ? supplyValue(gfAdd, phSites) : null;
      const c: Components = scope === "all" ? emptyComponents({ gap: top30.size ? trendsetterGap(latestSites, top30, t) : null, vanguard: sp?.spread_pts ?? null, curation: cur?.curation_lead_pts ?? null, momentum: f.status === "ok" ? f.momentum : null, corroboration: Math.log1p(w30) + 0.5 * Math.log1p(w90) + (gf ?? 0) / 20, discourse: disc?.z ?? null, supply }) : emptyComponents({ momentum: f.status === "ok" ? f.momentum : null });
      const why: string[] = [];
      if (scope === "all" && cat && isFlooding(gfAdd, phSites, f.status === "ok" ? f.stage : null, f.status === "ok" ? f.momentum : null)) why.push(FLOODING_NOTE);
      if (disc?.fatigue_flag) why.push(`Praise turning to fatigue: fatigue language in ${((disc.fatigue_ratio ?? 0) * 100).toFixed(0)}% of mentions over 4 weeks.`);
      if (cur?.curation_lead_pts != null && Math.abs(cur.curation_lead_pts) >= 5) why.push(`Curated galleries ${cur.curation_lead_pts > 0 ? "lead" : "trail"} the mass web by ${Math.abs(cur.curation_lead_pts).toFixed(1)} pts (C ${cur.indexes.curated.hits}/${cur.indexes.curated.n} vs M ${cur.indexes.mainstream.hits}/${cur.indexes.mainstream.n}); gallery picks skew design-forward.`);
      if (scope === "all") allComponents.push({ trait: t, c });
      const led = setters.filter(s => s.traits_led.some(x => x.trait === t)).slice(0, 8).map(s => ({ domain: s.domain, lead: s.traits_led.find(x => x.trait === t)!.lead, adopted: s.traits_led.find(x => x.trait === t)!.adopted }));
      const lag = scope === "all" ? leadLag(Object.fromEntries(SECTORS.map(s => [s, series.get(`${t}|${s}`) ?? []]))) : undefined;
      const proj = (h: number) => (f.status === "ok" ? f.projections.find(p => p.h === h) : undefined);
      rows.push({ run_id: runId, dimension, value, scope, status: f.status, stage: f.status === "ok" ? f.stage : null, model: f.status === "ok" ? f.model : null,
        current_share: f.current_share, momentum: f.status === "ok" ? f.momentum : null,
        proj_q1: proj(1)?.mid ?? null, proj_q1_lo: proj(1)?.lo ?? null, proj_q1_hi: proj(1)?.hi ?? null, proj_q2: proj(2)?.mid ?? null, proj_q2_lo: proj(2)?.lo ?? null, proj_q2_hi: proj(2)?.hi ?? null, proj_q4: proj(4)?.mid ?? null, proj_q4_lo: proj(4)?.lo ?? null, proj_q4_hi: proj(4)?.hi ?? null,
        components: { raw: c, present: presentComponents(c), wire30: w30, wire90: w90, gfont_category_share: gf, spread: sp ?? null, why,
          ...(scope === "all" ? {
            curation: cur ? { lead_pts: cur.curation_lead_pts, prev_lead_pts: prv?.curation_lead_pts ?? null, vanguard_spread_pts: cur.vanguard_spread_pts, n: Object.fromEntries(Object.entries(cur.indexes).map(([k, v]) => [k, v.n])), hits: Object.fromEntries(Object.entries(cur.indexes).map(([k, v]) => [k, v.hits])), gallery_mix: mix, run: crawlIds[0] ?? null, prev_run: crawlIds[1] ?? null } : { lead_pts: null, reason: !crawlCov.run ? "no finished crawl run" : crawlCov.stale ? "crawl stale" : crawlCov.curated_sites === 0 ? "no curated index in the latest crawl" : "trait not measured by the crawl" },
            discourse: disc ? { ...disc, terms: [...termSet!].slice(0, 12) } : { z: null, reason: "no tracked terms map to this trait" },
            supply: cat ? { value: supply, category: cat, gf_additions: gfAdd, ph_sites: phSites, ph_note: phCrawled ? null : "no Product Hunt sites crawled yet" } : { value: null, reason: "not a font category trait" },
          } : {}) },
        evidence: { quarters: pts.map(p => ({ q: p.quarter, s: p.share, n: p.denom, c: Number(p.coverage.toFixed(3)) })), usable: f.usable, fitted: f.status === "ok" ? f.fitted : [], fits: f.status === "ok" ? { logistic: { sse: f.fits.logistic.sse, score: f.fits.logistic.score, params: f.fits.logistic.params }, linear: { sse: f.fits.linear.sse, score: f.fits.linear.score, params: f.fits.linear.params } } : null, sites: led, sectors: lag ?? null, crossed_20: scope === "all" ? crossings[t] ?? null : null },
        backtest: b });
    }
  }
  const rowOf = (t: string) => rows.find(x => x.scope === "all" && `${x.dimension}:${x.value}` === t)!;
  const eligible: typeof allComponents = [];
  for (const a of allComponents) {
    const r = rowOf(a.trait), n = latestSites.filter(s => forecastSiteTraits(s).includes(a.trait)).length;
    const reason = nextWaveIneligibleReason(r.value, (r["current_share"] as number | null) ?? null, n);
    (r.components as Record<string, unknown>)["sites"] = n;
    if (reason) { r.next_wave_score = null; (r.components as Record<string, unknown>)["ineligible_reason"] = reason; } else eligible.push(a);
  }
  // Traits are scored in their own cohort exactly as before; each composite is scored in that cohort plus itself, so adding composites moves no existing score.
  const scored = eligible.filter(a => !isComposite(a.trait)), combos = eligible.filter(a => isComposite(a.trait));
  const scores = nextWaveScores(scored.map(a => a.c));
  scored.forEach((a, i) => { const r = rowOf(a.trait); r.next_wave_score = scores[i]!.score; (r.components as Record<string, unknown>)["z"] = scores[i]!.z; });
  for (const a of combos) { const s = nextWaveScores([...scored.map(b => b.c), a.c]).at(-1)!; const r = rowOf(a.trait); r.next_wave_score = s.score; (r.components as Record<string, unknown>)["z"] = s.z; }

  const sitesIn = new Map<string, number>();
  for (const s of latestSites) for (const tr of new Set(forecastSiteTraits(s))) for (const sc of ["all", s.sector]) sitesIn.set(`${sc}|${tr}`, (sitesIn.get(`${sc}|${tr}`) ?? 0) + 1);
  const alertInputs: AlertInput[] = rows.map(r => {
    const t = `${r.dimension}:${r.value}`, comp = r.components as { curation?: { lead_pts?: number | null; prev_lead_pts?: number | null }; discourse?: DiscourseSignal & { z: number | null } };
    return { dimension: r.dimension, value: r.value, scope: r.scope, status: r.status, stage: (r["stage"] as string | null) ?? null, momentum: (r["momentum"] as number | null) ?? null, current_share: (r["current_share"] as number | null) ?? null,
      sites: sitesIn.get(`${r.scope}|${t}`) ?? 0, prev: r.scope === "all" ? alertPrevByTrait.get(t) ?? null : null,
      curation: r.scope === "all" && comp.curation ? { lead_pts: comp.curation.lead_pts ?? null, prev_lead_pts: comp.curation.prev_lead_pts ?? null } : null,
      discourse: r.scope === "all" && comp.discourse && "fatigue_flag" in comp.discourse ? comp.discourse : null };
  });

  // Next-wave backtest: rank top-10 as of CUTOFF with data then available (gap + momentum), check ≥5pt growth by latest.
  const cutSites = latestPerSite(siteRows, CUTOFF), cutSetters = trendsetterScores(siteRows.filter(r => qIndex(r.quarter) <= qIndex(CUTOFF)), Object.fromEntries(Object.entries(crossings).filter(([, q]) => qIndex(q) <= qIndex(CUTOFF)))).filter(s => s.observed >= MIN_OBSERVED);
  const cutTop = new Set(cutSetters.filter(s => s.score > 0).slice(0, 30).map(s => s.domain));
  // Model-card backtests stay over the base traits only, so composites change no reported backtest number.
  const cand = traits.filter(t => !isComposite(t)).map(t => { const train = allPts(t).filter(p => qIndex(p.quarter) <= qIndex(CUTOFF)); const f = forecastSeries(train, "all"); const u = usablePoints(allPts(t), "all"); const base = u.filter(p => qIndex(p.quarter) <= qIndex(CUTOFF)).at(-1); return f.status === "ok" && base ? { t, c: emptyComponents({ gap: cutTop.size ? trendsetterGap(cutSites, cutTop, t) : null, momentum: f.momentum }), growth: (u.at(-1)!.share - base.share) * 100 } : null; }).filter((x): x is NonNullable<typeof x> => !!x);
  // Curation, discourse, supply (and vanguard/corroboration) have no history at the cutoff: they stay null (= cohort mean), never back-filled.
  const backtestWith = (weights: Partial<Record<keyof Components, number>>) => { const cs = nextWaveScores(cand.map(c => c.c), weights); const ranked = cand.map((c, i) => ({ ...c, s: cs[i]!.score })).sort((a, b) => b.s - a.s).slice(0, 10);
    return ranked.length ? { ranked: ranked.length, grew_5pts: ranked.filter(r => r.growth >= 5).length, hit_rate: ranked.filter(r => r.growth >= 5).length / ranked.length, traits: ranked.map(r => ({ trait: r.t, growth_pts: Number(r.growth.toFixed(2)) })) } : { ranked: 0, grew_5pts: 0, hit_rate: null, status: "insufficient_data" }; };
  const nwBacktest = { ...backtestWith(NEXT_WAVE_WEIGHTS), components_at_cutoff: ["gap", "momentum"], absent_at_cutoff: ["vanguard", "curation", "corroboration", "discourse", "supply"] }, nwLegacy = backtestWith(LEGACY_NEXT_WAVE_WEIGHTS);

  for (let i = 0; i < rows.length; i += 500) { const ins = await db.from("forecasts").insert(rows.slice(i, i + 500) as never); if (ins.error) throw ins.error; }
  const sectorOf = new Map(latestSites.map(r => [r.domain, r.sector]));
  const tsRows = setters.filter(s => s.score > 0).slice(0, 50).map((s, i) => ({ run_id: runId, domain: s.domain, rank: i + 1, score: s.score, traits_led: s.traits_led, sector: sectorOf.get(s.domain) ?? null }));
  if (tsRows.length) { const ins = await db.from("trendsetters").insert(tsRows); if (ins.error) throw ins.error; }

  const quarterCoverage = Object.fromEntries([...new Set(share.filter(r => r.sector === "all").map(r => r.quarter!))].sort().map(q => { const r = share.find(x => x.sector === "all" && x.quarter === q)!; return [q, { denom: Number(r.denom ?? 0), coverage: Number((r.coverage ?? 0).toFixed(3)) }]; }));
  const allRows = rows.filter(r => r.scope === "all");
  const card = { data_through: latestAll, backtest_cutoff: CUTOFF, median_mae_pts: median(bt.map(b => b.mae)), hit_rate: median(bt.map(b => b.hit)), n_backtested: bt.length, n_traits: traits.length, n_forecast_ok: allRows.filter(r => r.status === "ok").length, n_insufficient: allRows.filter(r => r.status !== "ok").length,
    usable_quarters_all: Object.entries(quarterCoverage).filter(([, v]) => v.denom >= 15 && v.coverage >= 0.25).map(([q]) => q), next_wave_backtest: nwBacktest, next_wave_backtest_legacy_weights: nwLegacy, weights: NEXT_WAVE_WEIGHTS,
    component_coverage: { rows: allRows.length, scored: allRows.filter(r => r.next_wave_score != null).length, ...Object.fromEntries(COMPONENT_KEYS.map(k => [k, allRows.filter(r => ((r.components as { raw?: Components }).raw?.[k] ?? null) !== null).length])) },
    crawl: { run: crawlCov.run, used: crawlCov.use, finished_at: crawlCov.finished_at, age_days: crawlCov.age_days, stale: crawlCov.stale, notes: crawlCov.notes, prev_run: crawlIds[1] ?? null, n: Object.fromEntries(["mainstream", "vanguard", "curated"].map(i => [i, latestCrawl.filter(s => s.index_name === i).length])), gallery_mix: mix },
    failed_runs_since_last_ok: failedSince, discourse_rows: discourseRows.length, ai_provider: providerLabel(process.env), thresholds: { denom_all: 15, denom_sector: 8, coverage: 0.25, min_quarters: 4, bootstrap: 200, interval: 0.8 } };
  // Alert candidates are restricted to headline signals (tiers.ts) from this run's own rows; the alert rules themselves are unchanged.
  const headline = headlineKeys(allRows.map(r => ({ key: `${r.dimension}:${r.value}`, stats: { status: r.status, stage: (r["stage"] as string | null) ?? null, momentum: (r["momentum"] as number | null) ?? null, sites: ((r.components as Record<string, unknown>)["sites"] as number | undefined) ?? null, prevStages: [prevByTrait.get(`${r.dimension}:${r.value}`)?.stage ?? null, prev2ByTrait.get(`${r.dimension}:${r.value}`) ?? null] } })));
  return { cutoff: latestAll, coverage: quarterCoverage, card, alertInputs, headline };
}

/** Weekly wire alerts: rule hits → one per trait, skip traits alerted in the last 28 days, ≤10. Dry runs only return them. */
async function emitAlerts(db: Db, runId: number, inputs: AlertInput[], dry: boolean, headline: Set<string>): Promise<{ dry: boolean; candidates: number; skipped_recent: number; emitted: Alert[] }> {
  const candidates = restrictToHeadline(alertCandidates(inputs), headline), since = new Date(Date.now() - ALERT_DEDUPE_DAYS * 864e5).toISOString();
  const recent = await db.from("wire_items").select("ref").eq("source_kind", "alert").gte("published_at", since).not("ref", "is", null).limit(1000);
  if (recent.error) throw recent.error;
  const recentTraits = new Set((recent.data ?? []).map(r => r.ref!).filter(Boolean));
  const emitted = selectAlerts(candidates, recentTraits);
  if (!dry && emitted.length) {
    const now = new Date(), ins = await db.from("wire_items").upsert(emitted.map(a => alertRow(a, runId, now)), { onConflict: "url", ignoreDuplicates: true });
    if (ins.error) throw ins.error;
  }
  return { dry, candidates: candidates.length, skipped_recent: new Set(candidates.filter(c => recentTraits.has(c.trait)).map(c => c.trait)).size, emitted };
}
