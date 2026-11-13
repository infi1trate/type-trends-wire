// Weekly forecast job: loads public aggregates, runs pure models, persists a run. Service-role writes only.
import { forecastSeries, backtestSeries, median, qIndex, usablePoints, type SeriesPoint } from "./forecast";
import { crossingQuarter, nextWaveIneligibleReason, trendsetterScores, trendsetterGap, leadLag, keywordCount, nextWaveScores, siteTraits, type SiteRow, type Components } from "./forecast-signals";
import { EXCLUDED_DIMENSIONS, TRAIT_SPREAD, TRAIT_GFONT_CATEGORY } from "./forecast-constants";
import { SECTORS } from "./library";
type Db = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
async function pages<T>(f: (from: number) => PromiseLike<{ data: T[] | null; error: unknown }>) { const out: T[] = []; for (let from = 0; ; from += 1000) { const { data, error } = await f(from); if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < 1000) break; } return out; }
const CUTOFF = "2025Q2", KEEP_RUNS = 12, MIN_OBSERVED = 3;
const AI_DIMENSIONS = ["imagery", "aesthetic", "components", "hero_layout", "ai_positioning", "tone", "color_mood"];

export async function runForecast(opts: { brief?: boolean } = {}) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const run = await db.from("forecast_runs").insert({ status: "running" }).select("id").single();
  if (run.error) throw run.error; const runId = run.data.id;
  try {
    const result = await compute(db, runId);
    const { refreshTaste } = await import("./taste/refresh.server");
    await refreshTaste();
    const fin = await db.from("forecast_runs").update({ status: "ok", data_cutoff_quarter: result.cutoff, coverage: result.coverage, model_card: result.card }).eq("id", runId);
    if (fin.error) throw fin.error;
    const old = await db.from("forecast_runs").select("id").order("id", { ascending: false }).range(KEEP_RUNS, KEEP_RUNS + 500);
    if (old.data?.length) await db.from("forecast_runs").delete().in("id", old.data.map(r => r.id));
    let brief: unknown = null;
    if (opts.brief !== false) { const { generateWeeklyBrief } = await import("./forecast-brief.server"); brief = await generateWeeklyBrief(runId).catch(e => ({ ok: false, code: e instanceof Error ? e.message : "brief_failed" })); }
    return { ok: true, run_id: runId, model_card: result.card, brief };
  } catch (e) { await db.from("forecast_runs").update({ status: "error" }).eq("id", runId); throw e; }
}

async function compute(db: Db, runId: number) {
  const since90 = new Date(Date.now() - 90 * 864e5).toISOString(), since30 = Date.now() - 30 * 864e5;
  const [share, sites, spread, wire, gfLatest] = await Promise.all([
    pages(f => db.from("library_history_share").select("quarter,sector,dimension,value,denom,share,coverage").order("quarter").order("sector").order("dimension").order("value").range(f, f + 999)),
    pages(f => db.from("library_site_history").select("domain,quarter,sector,theme,h1_family,webfont,h1_tracking,css_features,frameworks,hero_media,ai_tags").order("domain").order("quarter").range(f, f + 999)),
    db.from("crawl_spread").select("signal,spread_pts,vanguard_share,mainstream_share").eq("scope", "all"),
    pages(f => db.from("wire_items").select("title,excerpt,published_at").gte("published_at", since90).order("id").range(f, f + 999)),
    db.from("gfont_snapshots").select("captured_on").order("captured_on", { ascending: false }).limit(1),
  ]);
  if (spread.error || gfLatest.error) throw spread.error ?? gfLatest.error;
  const gfDay = gfLatest.data[0]?.captured_on;
  const gfTop = gfDay ? (await db.from("gfont_snapshots").select("category,trending_rank").eq("captured_on", gfDay).not("trending_rank", "is", null).order("trending_rank").limit(50)).data ?? [] : [];
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
  const traits = [...new Set([...series.keys()].map(k => k.split("|")[0]!))].sort();
  const allPts = (t: string) => series.get(`${t}|all`) ?? [];
  const latestAll = traits.flatMap(t => usablePoints(allPts(t), "all").slice(-1).map(p => p.quarter)).sort((a, b) => qIndex(a) - qIndex(b)).at(-1) ?? null;

  // Trendsetters: traits crossing 20% library-wide
  const crossings = Object.fromEntries(traits.map(t => [t, crossingQuarter(allPts(t), "all", 0.2)]).filter((e): e is [string, string] => !!e[1]));
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
      if (b.status === "ok" && scope === "all") bt.push({ mae: b.mae_pts, hit: b.hit_rate });
      const spKey = TRAIT_SPREAD[t], sp = spKey ? spread.data.find(s => s.signal === spKey) : undefined;
      const cat = TRAIT_GFONT_CATEGORY[t], gf = cat && gfTop.length ? gfTop.filter(g => g.category === cat).length / gfTop.length * 100 : null;
      const w30 = keywordCount(t, texts30), w90 = keywordCount(t, texts90);
      const c: Components = scope === "all" ? { gap: top30.size ? trendsetterGap(latestSites, top30, t) : null, vanguard: sp?.spread_pts ?? null, momentum: f.status === "ok" ? f.momentum : null, corroboration: Math.log1p(w30) + 0.5 * Math.log1p(w90) + (gf ?? 0) / 20 } : { gap: null, vanguard: null, momentum: f.status === "ok" ? f.momentum : null, corroboration: null };
      if (scope === "all") allComponents.push({ trait: t, c });
      const led = setters.filter(s => s.traits_led.some(x => x.trait === t)).slice(0, 8).map(s => ({ domain: s.domain, lead: s.traits_led.find(x => x.trait === t)!.lead, adopted: s.traits_led.find(x => x.trait === t)!.adopted }));
      const lag = scope === "all" ? leadLag(Object.fromEntries(SECTORS.map(s => [s, series.get(`${t}|${s}`) ?? []]))) : undefined;
      const proj = (h: number) => (f.status === "ok" ? f.projections.find(p => p.h === h) : undefined);
      rows.push({ run_id: runId, dimension, value, scope, status: f.status, stage: f.status === "ok" ? f.stage : null, model: f.status === "ok" ? f.model : null,
        current_share: f.current_share, momentum: f.status === "ok" ? f.momentum : null,
        proj_q1: proj(1)?.mid ?? null, proj_q1_lo: proj(1)?.lo ?? null, proj_q1_hi: proj(1)?.hi ?? null, proj_q2: proj(2)?.mid ?? null, proj_q2_lo: proj(2)?.lo ?? null, proj_q2_hi: proj(2)?.hi ?? null, proj_q4: proj(4)?.mid ?? null, proj_q4_lo: proj(4)?.lo ?? null, proj_q4_hi: proj(4)?.hi ?? null,
        components: { raw: c, wire30: w30, wire90: w90, gfont_category_share: gf, spread: sp ?? null },
        evidence: { quarters: pts.map(p => ({ q: p.quarter, s: p.share, n: p.denom, c: Number(p.coverage.toFixed(3)) })), usable: f.usable, fitted: f.status === "ok" ? f.fitted : [], fits: f.status === "ok" ? { logistic: { sse: f.fits.logistic.sse, score: f.fits.logistic.score, params: f.fits.logistic.params }, linear: { sse: f.fits.linear.sse, score: f.fits.linear.score, params: f.fits.linear.params } } : null, sites: led, sectors: lag ?? null, crossed_20: scope === "all" ? crossings[t] ?? null : null },
        backtest: b });
    }
  }
  const rowOf = (t: string) => rows.find(x => x.scope === "all" && `${x.dimension}:${x.value}` === t)!;
  const eligible: typeof allComponents = [];
  for (const a of allComponents) {
    const r = rowOf(a.trait), n = latestSites.filter(s => siteTraits(s).includes(a.trait)).length;
    const reason = nextWaveIneligibleReason(r.value, (r["current_share"] as number | null) ?? null, n);
    (r.components as Record<string, unknown>)["sites"] = n;
    if (reason) { r.next_wave_score = null; (r.components as Record<string, unknown>)["ineligible_reason"] = reason; } else eligible.push(a);
  }
  const scores = nextWaveScores(eligible.map(a => a.c));
  eligible.forEach((a, i) => { const r = rowOf(a.trait); r.next_wave_score = scores[i]!.score; (r.components as Record<string, unknown>)["z"] = scores[i]!.z; });

  // Next-wave backtest: rank top-10 as of CUTOFF with data then available (gap + momentum), check ≥5pt growth by latest.
  const cutSites = latestPerSite(siteRows, CUTOFF), cutSetters = trendsetterScores(siteRows.filter(r => qIndex(r.quarter) <= qIndex(CUTOFF)), Object.fromEntries(Object.entries(crossings).filter(([, q]) => qIndex(q) <= qIndex(CUTOFF)))).filter(s => s.observed >= MIN_OBSERVED);
  const cutTop = new Set(cutSetters.filter(s => s.score > 0).slice(0, 30).map(s => s.domain));
  const cand = traits.map(t => { const train = allPts(t).filter(p => qIndex(p.quarter) <= qIndex(CUTOFF)); const f = forecastSeries(train, "all"); const u = usablePoints(allPts(t), "all"); const base = u.filter(p => qIndex(p.quarter) <= qIndex(CUTOFF)).at(-1); return f.status === "ok" && base ? { t, c: { gap: cutTop.size ? trendsetterGap(cutSites, cutTop, t) : null, vanguard: null, momentum: f.momentum, corroboration: null } as Components, growth: (u.at(-1)!.share - base.share) * 100 } : null; }).filter((x): x is NonNullable<typeof x> => !!x);
  const cs = nextWaveScores(cand.map(c => c.c)); const ranked = cand.map((c, i) => ({ ...c, s: cs[i]!.score })).sort((a, b) => b.s - a.s).slice(0, 10);
  const nwBacktest = ranked.length ? { ranked: ranked.length, grew_5pts: ranked.filter(r => r.growth >= 5).length, traits: ranked.map(r => ({ trait: r.t, growth_pts: Number(r.growth.toFixed(2)) })) } : { ranked: 0, grew_5pts: 0, status: "insufficient_data" };

  for (let i = 0; i < rows.length; i += 500) { const ins = await db.from("forecasts").insert(rows.slice(i, i + 500) as never); if (ins.error) throw ins.error; }
  const sectorOf = new Map(latestSites.map(r => [r.domain, r.sector]));
  const tsRows = setters.filter(s => s.score > 0).slice(0, 50).map((s, i) => ({ run_id: runId, domain: s.domain, rank: i + 1, score: s.score, traits_led: s.traits_led, sector: sectorOf.get(s.domain) ?? null }));
  if (tsRows.length) { const ins = await db.from("trendsetters").insert(tsRows); if (ins.error) throw ins.error; }

  const quarterCoverage = Object.fromEntries([...new Set(share.filter(r => r.sector === "all").map(r => r.quarter!))].sort().map(q => { const r = share.find(x => x.sector === "all" && x.quarter === q)!; return [q, { denom: Number(r.denom ?? 0), coverage: Number((r.coverage ?? 0).toFixed(3)) }]; }));
  const allRows = rows.filter(r => r.scope === "all");
  const card = { data_through: latestAll, backtest_cutoff: CUTOFF, median_mae_pts: median(bt.map(b => b.mae)), hit_rate: median(bt.map(b => b.hit)), n_backtested: bt.length, n_traits: traits.length, n_forecast_ok: allRows.filter(r => r.status === "ok").length, n_insufficient: allRows.filter(r => r.status !== "ok").length,
    usable_quarters_all: Object.entries(quarterCoverage).filter(([, v]) => v.denom >= 15 && v.coverage >= 0.25).map(([q]) => q), next_wave_backtest: nwBacktest, thresholds: { denom_all: 15, denom_sector: 8, coverage: 0.25, min_quarters: 4, bootstrap: 200, interval: 0.8 } };
  return { cutoff: latestAll, coverage: quarterCoverage, card };
}
