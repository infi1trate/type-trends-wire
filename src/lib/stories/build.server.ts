// One bounded, idempotent story build: load what exists (anonymous public reads), make candidates, score, plan, write
// at most a few "why it matters" lines inside the AI budget, and insert with ON CONFLICT DO NOTHING. Never runs in DEV runs.
import { decodeEntities } from "../entities";
import { forecastSiteTraits, type SiteRow } from "../forecast-signals";
import { canonical, label } from "../labels";
import type { EventRow, RebrandRow } from "../agency/changes";
import type { SignalRow } from "../signals";
import { allCandidates, archiveMeasured, type BuildInput, type RunRows } from "./candidates";
import { comparisonPair } from "../run-gap";
import { fetchRealRuns } from "../real-runs";
import { planStories, type Existing, type Planned } from "./score";
import { knownFrom, validateWhy, whyFacts, whyPrompt, WHY_KIND, WHY_PER_BUILD, WHY_PER_DAY, WHY_SYSTEM, WHY_TOOL } from "./why";
import { soWhatOf } from "./view";

/** Hard time budget for a build called at the end of a job; the rest waits for the next run. */
export const BUILD_BUDGET_MS = 20_000;
/** Incremental builds look back 7 days; the backfill script asks for 30. */
export const BUILD_DAYS = 7;
export { REAL_RUN_RULE } from "../run-gap";

export type StoryRowOut = {
  id: string; type: string; status: "published" | "held"; reason: string; score: number; components: unknown; why_ran: string; kicker: string; headline: string; deck: string | null;
  facts: unknown; why_line: string | null; why_model: string | null; why_at: string | null; sector: string | null; signal_keys: string[]; domains: string[]; evidence: unknown;
  source_ids: string[]; basis: string | null; happened_at: string;
};
export type WhyInput = Pick<Planned, "id" | "type" | "headline" | "deck" | "facts" | "signalKeys" | "domains"> & { stage?: string | null };
export type WhyWriter = { used: () => Promise<number>; write: (p: WhyInput, soWhatText: string, signal: AbortSignal) => Promise<{ line: string; model: string } | null> };
export type LineRow = { story_id: string; why_line: string; why_model: string; why_at: string };
export type BuildDeps = {
  load: (o: { days: number; allRuns: boolean; realRunIds: number[] }) => Promise<BuildInput>; existing: (sinceIso: string) => Promise<Existing[]>; insert: (rows: StoryRowOut[]) => Promise<number>; why?: WhyWriter | null;
  /** Stored published stories without a line yet, best first (lines left over after new stories go to these). */
  lineless?: (limit: number) => Promise<WhyInput[]>; insertLines?: (rows: LineRow[]) => Promise<number>;
};
export type BuildOptions = { dev?: boolean; days?: number; allRuns?: boolean; budgetMs?: number; aiPerBuild?: number; realRunIds?: number[]; now?: () => number };
export type BuildResult = { ok: true; skipped?: "dev"; considered: number; inserted: number; published: number; held: number; why_lines: number; timed_out: boolean; news_kept: number; news_dropped: number; plan?: Planned[] };

export const toRow = (p: Planned, why: { line: string; model: string; at: string } | null): StoryRowOut => ({
  id: p.id, type: p.type, status: p.status, reason: p.reason, score: p.score, components: p.components, why_ran: p.whyRan, kicker: p.kicker, headline: p.headline, deck: p.deck,
  facts: p.facts, why_line: why?.line ?? null, why_model: why?.model ?? null, why_at: why?.at ?? null, sector: p.sector, signal_keys: p.signalKeys, domains: p.domains,
  evidence: p.evidence, source_ids: p.sourceIds, basis: p.basis, happened_at: p.happenedAt,
});

/** The pure-ish core with injected I/O (tests run it against memory stores). */
export async function runBuild(deps: BuildDeps, o: BuildOptions = {}): Promise<BuildResult> {
  const empty = { considered: 0, inserted: 0, published: 0, held: 0, why_lines: 0, timed_out: false, news_kept: 0, news_dropped: 0 };
  if (o.dev) return { ok: true, skipped: "dev", ...empty };
  const clock = o.now ?? Date.now, start = clock(), budget = o.budgetMs ?? BUILD_BUDGET_MS, days = o.days ?? BUILD_DAYS;
  const input = await deps.load({ days, allRuns: !!o.allRuns, realRunIds: o.realRunIds ?? [] });
  const existing = await deps.existing(new Date(Date.parse(input.now) - (days + 30) * 864e5).toISOString());
  const { candidates, ctx, newsDropped, newsKept } = allCandidates(input);
  const allShare = (k: string) => ctx.row(ctx.cur, canonical(k))?.current_share ?? null;
  const tracked = new Set(input.sites.map(s => s.domain));
  const plan = planStories(candidates, existing, { tierOf: k => ctx.tiers.get(canonical(k)) ?? null, rankOf: d => ctx.rank.get(d) ?? null, tracked: d => tracked.has(d), covered: ctx.covered, shareOf: allShare });
  // AI lines: the top published new stories, then stored ones still without a line, inside the per-build and per-day caps, only while time remains.
  const lines = new Map<string, { line: string; model: string; at: string }>(), later: LineRow[] = [];
  let timedOut = false;
  if (deps.why && (o.aiPerBuild ?? WHY_PER_BUILD) > 0) {
    let left = Math.max(0, Math.min(o.aiPerBuild ?? WHY_PER_BUILD, WHY_PER_BUILD, WHY_PER_DAY - await deps.why.used()));
    const fresh = plan.filter(p => p.status === "published" && p.type !== "launch").sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, left);
    const old = deps.lineless && left > fresh.length ? await deps.lineless(left - fresh.length) : [];
    const todo: (WhyInput & { fresh: boolean })[] = [...fresh.map(p => ({ ...p, fresh: true })), ...old.map(p => ({ ...p, fresh: false }))];
    const remaining = budget - (clock() - start) - 3000;
    if (todo.length && remaining > 2000) {
      const signal = AbortSignal.timeout(remaining), known = knownFrom(input.sites, ctx.tiers.keys());
      const out = await Promise.all(todo.map(p => deps.why!.write(p, soWhatOf(p), signal).catch(() => null)));
      out.forEach((r, i) => {
        const p = todo[i]!; left--; if (!r) return;
        const v = validateWhy(r.line, p, known); if (!v.ok) return;
        const at = new Date(clock()).toISOString();
        if (p.fresh) lines.set(p.id, { line: v.line, model: r.model, at }); else later.push({ story_id: p.id, why_line: v.line, why_model: r.model, why_at: at });
      });
    } else if (todo.length) timedOut = true;
  }
  const rows = plan.map(p => toRow(p, lines.get(p.id) ?? null));
  const inserted = rows.length ? await deps.insert(rows) : 0;
  const linesLater = later.length && deps.insertLines ? await deps.insertLines(later) : 0;
  return { ok: true, considered: candidates.length, inserted, published: plan.filter(p => p.status === "published").length, held: plan.filter(p => p.status === "held").length, why_lines: lines.size + linesLater, timed_out: timedOut || clock() - start > budget, news_kept: newsKept, news_dropped: newsDropped, plan };
}

// ---- Real I/O ---------------------------------------------------------------------------------------------------
const COLS = "dimension,value,scope,status,stage,momentum,current_share,next_wave_score,present:components->present,sites:components->sites,usable:evidence->usable";
const HIST = "domain,quarter,sector,captured_at,theme,h1_family,webfont,h1_tracking,css_features,frameworks,hero_media,ai_tags,h1_size_px,cta_radius_bucket,whitespace_ratio";
async function pages<T>(f: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, size = 500) {
  const out: T[] = [];
  for (let from = 0; from < 50000; from += size) { const { data, error } = await f(from, from + size - 1); if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < size) break; }
  return out;
}

export async function loadInput(o: { days: number; allRuns: boolean; realRunIds: number[] }): Promise<BuildInput> {
  const { supabaseAnon } = await import("../mcp/supabase");
  const db = supabaseAnon(), now = Date.now(), since = new Date(now - o.days * 864e5).toISOString();
  // Real runs, newest first: the latest three (tiers read the two before the latest) plus the gap partner for shifts and crossovers.
  const realRuns = (await fetchRealRuns(db, { extra: o.realRunIds })).map(r => ({ id: r.id, computed_at: r.at })).reverse();
  const pair = comparisonPair(realRuns.map(r => ({ id: r.id, at: r.computed_at })));
  const inWindow = realRuns.filter(r => r.computed_at >= since), pick = o.allRuns ? realRuns.slice(0, inWindow.length + 1) : realRuns.slice(0, 3);
  const chosen = [...new Map([...pick, ...realRuns.filter(r => r.id === pair?.earlier.id)].map(r => [r.id, r])).values()].sort((a, b) => a.id - b.id);
  const runs: RunRows[] = await Promise.all(chosen.map(async r => ({ id: r.id, at: r.computed_at, rows: (await pages<SignalRow>((f, t) => db.from("forecasts").select(COLS).eq("run_id", r.id).order("scope").order("dimension").order("value").range(f, t) as never, 1000)).map(x => ({ ...x, present: Array.isArray(x.present) ? x.present : [], sites: typeof x.sites === "number" ? x.sites : null, usable: typeof x.usable === "number" ? x.usable : null })) })));
  const latest = chosen.at(-1)?.id ?? null;
  const [events, alerts, wire, launches, sites, now_, archive, setters, rebrands] = await Promise.all([
    pages<EventRow>((f, t) => db.from("library_event_feed").select("id,domain,type,before,after,detected_at,source,page_type,viewport,sector,summary").eq("source", "live").eq("viewport", "desktop").gte("detected_at", since).order("id").range(f, t) as never),
    db.from("wire_items").select("id,title,url,source,source_kind,published_at,excerpt,ref").eq("source_kind", "alert").gte("published_at", since).order("id").limit(500),
    pages<BuildInput["wire"][number]>((f, t) => db.from("wire_items").select("id,title,url,source,source_kind,published_at,excerpt").in("source_kind", ["rss", "hn", "bluesky"]).gte("published_at", since).lte("published_at", new Date(now).toISOString()).order("id").range(f, t) as never),
    db.from("wire_items").select("id,title,url,source,source_kind,published_at,excerpt").eq("source_kind", "producthunt").gte("published_at", since).order("id").limit(200),
    pages<{ domain: string; name: string | null; sector: string; active: boolean; last_snapshot_at: string | null }>((f, t) => db.from("library_sites").select("domain,name,sector,active,last_snapshot_at").order("domain").range(f, t) as never),
    pages<SiteRow & { captured_at: string | null }>((f, t) => db.from("library_site_history").select(HIST).eq("now", true).order("domain").range(f, t) as never, 200),
    pages<SiteRow>((f, t) => db.from("library_site_history").select(HIST).eq("now", false).order("domain").order("quarter").range(f, t) as never, 200),
    latest == null ? Promise.resolve({ data: [], error: null }) : db.from("trendsetters").select("domain,rank").eq("run_id", latest).order("rank"),
    import("../rebrands.server").then(m => m.rebrandRows()),
  ]);
  for (const r of [alerts, launches, setters]) if (r.error) throw r.error;
  const h = new Map(now_.map(r => [r.domain, r]));
  const dec = <W extends { title: string; excerpt: string | null }>(w: W): W => ({ ...w, title: decodeEntities(w.title), excerpt: w.excerpt ? decodeEntities(w.excerpt) : null });
  return {
    now: new Date(now).toISOString(), events, runs,
    rebrands: rebrands.rows.filter(x => x.source === "live" && x.confirmed_at >= since) as unknown as RebrandRow[],
    alerts: (alerts.data ?? []).map(a => dec({ ...a, ref: a.ref ?? null })) as BuildInput["alerts"], wire: wire.map(dec), launches: (launches.data ?? []).map(dec) as BuildInput["launches"],
    sites: sites.filter(s => s.active).map(s => { const r = h.get(s.domain); return { domain: s.domain, name: s.name, sector: s.sector, captured: r?.captured_at ?? s.last_snapshot_at, traits: r ? [...new Set(forecastSiteTraits({ ...r, sector: s.sector }))] : [] }; }),
    archive: archive.map(r => ({ domain: r.domain, sector: r.sector, quarter: r.quarter, traits: [...new Set(forecastSiteTraits(r))], measured: archiveMeasured(r) })),
    trendsetters: (setters.data ?? []) as { domain: string; rank: number }[],
  };
}

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
export function dbDeps(admin: Admin, withWhy = true): BuildDeps {
  return {
    load: loadInput,
    existing: async since => pages<Existing>((f, t) => admin.from("stories").select("id,type,status,score,happened_at,domains,signal_keys,sector").gte("happened_at", since).order("id").range(f, t) as never, 1000),
    insert: async rows => {
      let n = 0;
      for (let i = 0; i < rows.length; i += 200) {
        const { data, error } = await admin.from("stories").upsert(rows.slice(i, i + 200) as never, { onConflict: "id", ignoreDuplicates: true }).select("id");
        if (error) throw new Error("story_insert_failed");
        n += data?.length ?? 0;
      }
      return n;
    },
    why: withWhy ? aiWhy(admin) : null,
    lineless: async limit => {
      const since = new Date(Date.now() - 30 * 864e5).toISOString();
      const [st, have] = await Promise.all([
        admin.from("stories").select("id,type,headline,deck,facts,signal_keys,domains,score").eq("status", "published").neq("type", "launch").is("why_line", null).gte("happened_at", since).order("score", { ascending: false }).order("id").limit(200),
        admin.from("story_lines").select("story_id").gte("why_at", new Date(Date.now() - 60 * 864e5).toISOString()).limit(2000),
      ]);
      if (st.error || have.error) throw new Error("lineless_failed");
      const done = new Set((have.data ?? []).map(r => r.story_id));
      return (st.data ?? []).filter(r => !done.has(r.id)).slice(0, limit).map(r => ({ id: r.id, type: r.type as Planned["type"], headline: r.headline, deck: r.deck, facts: (Array.isArray(r.facts) ? r.facts : []) as unknown as Planned["facts"], signalKeys: r.signal_keys, domains: r.domains }));
    },
    insertLines: async rows => { const { data, error } = await admin.from("story_lines").upsert(rows, { onConflict: "story_id", ignoreDuplicates: true }).select("story_id"); if (error) throw new Error("line_insert_failed"); return data?.length ?? 0; },
  };
}

/** Budget-guarded line writer: reserve under the story_why purpose, call once, settle; unknown outcomes are charged in full and never replayed. */
export function aiWhy(admin: Admin): WhyWriter {
  return {
    used: async () => {
      const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
      const { count, error } = await admin.from("ai_usage").select("id", { count: "exact", head: true }).eq("kind", WHY_KIND).neq("state", "rejected").gte("created_at", dayStart.toISOString());
      if (error) throw new Error("why_usage_failed");
      return count ?? 0;
    },
    write: async (p, soWhatText, signal) => {
      const { aiClient, markProvider, ProviderError } = await import("../ai-provider.server");
      const { AI_MODELS } = await import("../ai-models"), { estimateCost } = await import("../ai-budget");
      const ai = aiClient(), provider = ai.provider, model = AI_MODELS.text;
      const estimate = estimateCost({ provider, model, input_tokens: 1500, output_tokens: 200 });
      const res = await admin.rpc("ai_reserve", { p_snapshot_id: null as unknown as number, p_kind: WHY_KIND, p_model: model, p_estimate: estimate });
      const r = res.data as { ok?: boolean; id?: number } | null;
      if (res.error || !r?.ok || typeof r.id !== "number") return null; // budget short: skip the line
      const uid = r.id;
      if (!await markProvider(admin, uid, provider)) { await admin.rpc("ai_settle", { p_id: uid, p_input: 0, p_output: 0, p_cost: 0, p_ok: false, p_error: "usage_write_failed", p_state: "rejected" }); return null; }
      try {
        const resp = await ai.complete({ model, max_tokens: 200, temperature: 0.3, signal, messages: [{ role: "system", content: WHY_SYSTEM }, { role: "user", content: [{ type: "text", text: whyPrompt(whyFacts(p, soWhatText)) }] }], tools: [WHY_TOOL], tool_choice: { type: "function", function: { name: "emit_line" } } });
        const u = resp.usage, cost = estimateCost({ provider, model, input_tokens: u.prompt_tokens, output_tokens: u.completion_tokens });
        let line: unknown = null; try { line = resp.tool_call_args ? (JSON.parse(resp.tool_call_args) as { line?: unknown }).line : resp.text; } catch { line = null; }
        await admin.rpc("ai_settle", { p_id: uid, p_input: u.prompt_tokens, p_output: u.completion_tokens, p_cost: cost, p_ok: typeof line === "string", p_error: typeof line === "string" ? null as unknown as string : "no_line", p_state: "done" });
        return typeof line === "string" ? { line, model } : null;
      } catch (e) {
        if (e instanceof ProviderError && e.usage) { await admin.rpc("ai_settle", { p_id: uid, p_input: e.usage.prompt_tokens, p_output: e.usage.completion_tokens, p_cost: estimateCost({ provider, model, input_tokens: e.usage.prompt_tokens, output_tokens: e.usage.completion_tokens }), p_ok: false, p_error: `${provider}_${e.code}`, p_state: "done" }); return null; }
        await admin.rpc("ai_settle", { p_id: uid, p_input: 0, p_output: 0, p_cost: estimate, p_ok: false, p_error: "why_unknown_outcome", p_state: "unknown" });
        return null;
      }
    },
  };
}

/** Entry point for jobs and the backfill script. */
export async function buildStories(o: BuildOptions & { withWhy?: boolean } = {}): Promise<BuildResult> {
  if (o.dev) return runBuild({ load: async () => { throw new Error("unreachable"); }, existing: async () => [], insert: async () => 0 }, o);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return runBuild(dbDeps(supabaseAdmin, o.withWhy !== false), o);
}

/** Wrapped call at the end of a job: never throws, never fails the job, skips when the job already used most of its time. */
const JOB_LIMIT_MS = 80_000, MIN_INTERVAL_MS = 120_000;
let lastRun = 0;
export async function afterJob(job: string, jobStartedAt: number, extra: Pick<BuildOptions, "realRunIds"> = {}): Promise<void> {
  try {
    const now = Date.now(), left = JOB_LIMIT_MS - (now - jobStartedAt) - 10_000;
    if (left < 5000 || now - lastRun < MIN_INTERVAL_MS) return;
    lastRun = now;
    const budgetMs = Math.min(BUILD_BUDGET_MS, left);
    const r = await Promise.race([buildStories({ ...extra, budgetMs }), new Promise<null>(res => setTimeout(() => res(null), budgetMs + 2000))]);
    if (r) console.info("story build", job, { inserted: r.inserted, published: r.published, held: r.held, why_lines: r.why_lines });
    else console.warn("story build timed out", job);
  } catch (e) { console.error("story build failed", job, e instanceof Error ? e.message.slice(0, 80) : "UnknownError"); }
}
export const storyLabel = (k: string) => label(k).name;
