// One bounded, idempotent story build: load what exists (anonymous public reads), make candidates, score, plan, write
// at most a few "why it matters" lines inside the AI budget, and insert with ON CONFLICT DO NOTHING. Never runs in DEV runs.
import { historyRows as readHistory } from "../history.server";
import { decodeEntities } from "../entities";
import { forecastSiteTraits, type SiteRow } from "../forecast-signals";
import { canonical } from "../labels";
import type { EventRow, RebrandRow } from "../agency/changes";
import type { SignalRow } from "../signals";
import { allCandidates, archiveMeasured, type BuildInput, type RunRows } from "./candidates";
import { comparisonPair } from "../run-gap";
import { fetchRealRuns } from "../real-runs";
import { planStories, type Existing, type Planned } from "./score";
import { brandFolds, confirmedInput, type Fold, type ShownStory } from "./editor";
import type { Check } from "../integrity";
import { siteKind } from "../brand-names";
import { knownFrom, validateWhy, WHY_PER_BUILD, WHY_PER_DAY } from "./why";
import { soWhatOf } from "./view";
import { CALL_BUDGET_MS } from "../jobs/steps";
import { REVERSAL_DAYS } from "../reversal";
import { basis as basisOf, label, sectorName } from "../labels";
import { seededNames } from "../brand-names";
import { sheetNumbers } from "./sheet";
import { writerFacts, type FactSource, type FactStory, type ShareBase } from "./writer-facts";
import { triedWriter, writeStories, writerIO, type WriterIO, type WriteResult } from "./writer.server";
import { AI_MODELS } from "../ai-models";
import type { Ctx } from "./candidates";
import { carouselEventIds, isShowcaseSector } from "../carousel";

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
/** A stored story with the editor's edits applied (state, and the shown text a fold compares against). */
export type ExistingShown = Existing & Partial<Pick<ShownStory, "headline" | "deck" | "facts" | "source_ids">>;
export type BuildDeps = {
  load: (o: { days: number; allRuns: boolean; realRunIds: number[] }) => Promise<BuildInput>; existing: (sinceIso: string) => Promise<ExistingShown[]>; insert: (rows: StoryRowOut[]) => Promise<number>; why?: WhyWriter | null;
  /** The editor's headline calls for these events (stored, rule pass, model inside the budget); merged over the loaded calls. */
  calls?: (events: EventRow[], deadline: number, carousel?: ReadonlySet<number>) => Promise<Record<number, { call: string; reason: string }>>;
  /** Append the fold corrections (one brand, one story) as `correct` edits; returns how many were written. */
  appendFolds?: (folds: Fold[]) => Promise<number>;
  /** Stored published stories without a line yet, best first (lines left over after new stories go to these). */
  lineless?: (limit: number) => Promise<WhyInput[]>; insertLines?: (rows: LineRow[]) => Promise<number>;
  /** Give newly published stories their permanent numbers (story_numbers); returns how many were numbered. */
  assignNumbers?: () => Promise<number>;
  /** E2b · the writer: its I/O, and the stories to write now (fresh ones first, then published in the last seven days without a version
   *  newer than their last correction). */
  writer?: WriterIO | null; toWrite?: (freshIds: string[], limit: number) => Promise<FactStory[]>;
  /** E2c · count and base per "key|scope" for the latest run's shares (writer facts). */
  bases?: (runId: number, keys: string[], scopes: string[]) => Promise<Map<string, ShareBase>>;
  /** E2c · keep the crops each published story cites (story_kept_crops); returns how many were kept. */
  keepCrops?: () => Promise<number>;
  /** E2e · append the integrity verdicts that changed (change_checks, read by every tape surface); returns how many were written. */
  recordChecks?: (checks: Record<number, Check>) => Promise<number>;
  /** E2g · append the count each census story runs on (census_counts) before the story is stored; a census whose count can't be recorded is not stored. */
  recordCensus?: (rows: import("../census").CensusRow[]) => Promise<number>;
  /** Append a kill to every published single-brand story told only by these reversed events (retire.ts reversedStory); returns how many. */
  retireReversed?: (eventIds: number[], identityIds: string[]) => Promise<number>;
  /** I3 · append a kill to every published story left without support once its changes are marked re-reads (retire.ts rereadRetire). */
  retireRereads?: (shown: ExistingShown[]) => Promise<number>;
  /** U4 · answer the open pitches from this build's plan and the rules' refusals (appends pitch_verdicts; never changes the plan). */
  pitches?: (view: Omit<import("./pitch").EngineView, "numberOf">) => Promise<number>;
};
export type BuildOptions = { dev?: boolean; days?: number; allRuns?: boolean; budgetMs?: number; aiPerBuild?: number; realRunIds?: number[]; now?: () => number;
  /** U4 · the desk asking now: a run that writes nothing, whose pitch answers say "would run" instead of "ran". */ pitchDry?: boolean;
  /** When the writer must stop starting calls (absolute ms); default the build's own budget. */ writeDeadline?: number; writerPerBuild?: number; writeLimit?: number };
export type BuildResult = { ok: true; checks_recorded?: number; retired_reread?: number; pitched?: number; skipped?: "dev"; kept_crops?: number; retired_reversed?: number; folded?: number; considered: number; inserted: number; published: number; held: number; why_lines: number; timed_out: boolean; news_kept: number; news_dropped: number; news_drops?: import("./candidates").NewsDrops; numbered?: number; plan?: Planned[]; texts?: Pick<WriteResult, "written" | "checked" | "calls" | "skipped"> & { rows?: WriteResult["rows"] } };

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
  const raw = await deps.load({ days, allRuns: !!o.allRuns, realRunIds: o.realRunIds ?? [] });
  const integrityOut = confirmedInput(raw).unconfirmed;
  // E2e: the verdicts are stored first (every tape surface reads them), then only the passing part of each change goes on (integrity.ts).
  const checksRecorded = raw.checks && deps.recordChecks ? await deps.recordChecks(raw.checks).catch(() => 0) : 0;
  const loaded = confirmedInput(raw).input;
  // Headline calls first (they decide which headline changes count), inside a third of the budget; failures leave the change uncounted.
  const kinds = new Map(loaded.sites.map(x => [x.domain, x.kind ?? null]));
  const rotating = carouselEventIds(loaded.events, new Set(loaded.carousel ?? []));
  const fresh = deps.calls ? await deps.calls(loaded.events.filter(e => siteKind(e.domain, kinds.get(e.domain)) === "standard"), start + budget / 3, rotating).catch(() => ({})) : {};
  const input: BuildInput = { ...loaded, calls: { ...(loaded.calls ?? {}), ...fresh } };
  const existing = await deps.existing(new Date(Date.parse(input.now) - (days + 30) * 864e5).toISOString());
  const { candidates, ctx, newsDropped, newsKept, newsDrops, reversed, reversedIdentity } = allCandidates(input);
  const allShare = (k: string) => ctx.row(ctx.cur, canonical(k))?.current_share ?? null;
  const tracked = new Set(input.sites.map(s => s.domain));
  // One brand, one story: a later change to a brand with a published story in the window becomes a correction to that story.
  const shown: ShownStory[] = existing.filter(e => e.headline != null).map(e => ({ id: e.id, type: e.type, state: e.state ?? e.status, happened_at: e.happened_at, domains: e.domains, headline: e.headline!, deck: e.deck ?? null, facts: e.facts ?? [], source_ids: e.source_ids ?? [] }));
  const { folds, told } = brandFolds(candidates, shown, input.now);
  const plan = planStories(candidates, existing, { tierOf: k => ctx.tiers.get(canonical(k)) ?? null, rankOf: d => ctx.rank.get(d) ?? null, tracked: d => tracked.has(d), covered: ctx.covered, shareOf: allShare }, { told });
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
  let rows = plan.map(p => toRow(p, lines.get(p.id) ?? null));
  // E2g: a census story is stored only once the count it runs on is recorded (the next census compares with that count).
  const census = plan.filter(p => p.status === "published" && p.census);
  if (census.length && deps.recordCensus) {
    const ok = await deps.recordCensus(census.map(p => ({ ...p.census!, story_id: p.id }))).then(() => true, () => false);
    if (!ok) { const drop = new Set(census.map(p => p.id)); rows = rows.filter(r => !drop.has(r.id)); }
  }
  const inserted = rows.length ? await deps.insert(rows) : 0;
  const linesLater = later.length && deps.insertLines ? await deps.insertLines(later) : 0;
  // Numbers come after the insert so a story is numbered once it is published; a failure here never fails the build (the next build retries).
  const numbered = deps.assignNumbers ? await deps.assignNumbers().catch(() => 0) : 0;
  // E2c: a published story keeps the crops it cites (never fails the build; the next build retries).
  const kept = deps.keepCrops ? await deps.keepCrops().catch(() => 0) : 0;
  // A change back retires the story that already ran on the change it reverses (append-only kill edits; never fails the build).
  const retired = reversed.length && deps.retireReversed ? await deps.retireReversed(reversed, reversedIdentity).catch(() => 0) : 0;
  const folded = folds.length && deps.appendFolds ? await deps.appendFolds(folds).catch(() => 0) : 0;
  // I3: a story whose changes turned out to be AI re-reads is re-checked on what still passes (append-only; never fails the build).
  const reread = deps.retireRereads ? await deps.retireRereads(existing).catch(() => 0) : 0;
  // U4: pitches are answered from the plan just made (after numbering, so a pitch that ran gets its number); never fails the build.
  const pitched = deps.pitches ? await deps.pitches(pitchView(plan, existing, integrityOut, rotating, input, !!o.pitchDry)).catch(() => 0) : 0;
  // The writer comes last: every story above is already stored with its template text, so nothing waits on it and a failure changes nothing.
  let texts: BuildResult["texts"];
  if (deps.writer && deps.toWrite) {
    try {
      const fresh = plan.filter(p => p.status === "published" && p.type !== "launch").sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).map(p => p.id);
      const stories = await deps.toWrite(fresh, o.writeLimit ?? 12);
      // E2c: the count and base behind each share the writer may cite (one read for the stories being written; none = the share alone).
      const keys = [...new Set(stories.flatMap(st => st.signal_keys.slice(0, 3).map(canonical)))], scopes = [...new Set(["all", ...stories.map(st => st.sector).filter((x): x is string => !!x)])];
      const bases = ctx.cur && keys.length && deps.bases ? await deps.bases(ctx.cur.id, keys, scopes).catch(() => new Map<string, ShareBase>()) : new Map<string, ShareBase>();
      const src = factSource(input, ctx, bases);
      const r = await writeStories(stories.map(st => ({ story: st, ...writerFacts(st, src) })), deps.writer, { names: src.known }, { deadline: o.writeDeadline ?? start + budget, now: clock, ...(o.writerPerBuild != null ? { perBuild: o.writerPerBuild } : {}) });
      texts = { written: r.written, checked: r.checked, calls: r.calls, skipped: r.skipped, rows: r.rows };
    } catch { texts = { written: 0, checked: 0, calls: 0, skipped: 0 }; }
  }
  return { ok: true, checks_recorded: checksRecorded, numbered, ...(deps.pitches ? { pitched } : {}), kept_crops: kept, ...(texts ? { texts } : {}), retired_reversed: retired, ...(deps.retireRereads ? { retired_reread: reread } : {}), folded, considered: candidates.length, inserted, published: plan.filter(p => p.status === "published").length, held: plan.filter(p => p.status === "held").length, why_lines: lines.size + linesLater, timed_out: timedOut || clock() - start > budget, news_kept: newsKept, news_dropped: newsDropped, news_drops: newsDrops, plan };
}

/** What the writer may know about the stories of this build: the loaded events, captured copy, headline calls, names and library numbers. */
/** U4 · what the pitch check reads from one build: the plan, the stories stored before it, and the three rules' refusals. */
export function pitchView(plan: Planned[], existing: ExistingShown[], unconfirmed: { id: number; failed: string[] }[], rotating: ReadonlySet<number>, input: BuildInput, dry: boolean): Omit<import("./pitch").EngineView, "numberOf"> {
  const kinds = new Map(input.sites.map(x => [x.domain, siteKind(x.domain, x.kind ?? null)])), sectors = new Map(input.sites.map(x => [x.domain, x.sector ?? null]));
  const evs = new Map(input.events.map(e => [e.id, e.domain]));
  return {
    plan, dry, rotating, unconfirmed: unconfirmed.map(u => ({ id: u.id, failed: u.failed.map(String) })),
    stories: existing.map(e => ({ id: e.id, state: e.state ?? e.status, headline: e.headline ?? e.id, domains: e.domains, signalKeys: e.signal_keys, sourceIds: e.source_ids ?? [], type: e.type })),
    kindOf: d => kinds.get(d) ?? siteKind(d), showcase: d => isShowcaseSector(sectors.get(d) ?? null), eventDomain: id => evs.get(id) ?? null,
  };
}
export function factSource(input: BuildInput, ctx: Ctx, bases: ReadonlyMap<string, ShareBase> = new Map()): FactSource {
  const events = new Map([...(input.history ?? []), ...input.events].map(e => [e.id, e]));
  const names = new Map(input.sites.map(x => [x.domain, x.name]));
  const known = [...new Set([...seededNames(), ...input.sites.map(x => x.name).filter((n): n is string => !!n)])];
  // E2c: every share carries its own count and base ("4 of 29"), never the number of tracked brands. U2b: the count is the run's own
  // latest-quarter sample (the one white-space candidates are judged on), so the sheet, the stored lines and the page agree.
  // A story with its own run (a white space, a breakout) counts from that run, the one its stored lines and stage came from.
  const numbers = (keys: string[], sector: string | null, runId?: number | null) => {
    const own = runId != null ? ctx.runs.find(r => r.id === runId) ?? null : null;
    return sheetNumbers((k, scope) => ctx.row(own ?? ctx.cur, k, scope), keys, sector, own && own.id !== ctx.cur?.id ? new Map() : bases);
  };
  return { events, texts: new Map(Object.entries(input.texts ?? {}).map(([k, v]) => [Number(k), v])), calls: input.calls ?? {}, names, known, numbers };
}

// ---- Real I/O ---------------------------------------------------------------------------------------------------
const HIST = "domain,quarter,sector,captured_at,theme,h1_family,webfont,h1_tracking,css_features,frameworks,hero_media,ai_tags,h1_size_px,cta_radius_bucket,whitespace_ratio";
async function pages<T>(f: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, size = 500) {
  const out: T[] = [];
  for (let from = 0; from < 50000; from += size) { const { data, error } = await f(from, from + size - 1); if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < size) break; }
  return out;
}

export async function loadInput(o: { days: number; allRuns: boolean; realRunIds: number[]; /** Fixed "now" (the golden fixture); default the clock. */ now?: number }): Promise<BuildInput> {
  const { supabaseAnon } = await import("../mcp/supabase");
  const db = supabaseAnon(), now = o.now ?? Date.now(), since = new Date(now - o.days * 864e5).toISOString();
  // Real runs, newest first: the latest three (tiers read the two before the latest) plus the gap partner for shifts and crossovers.
  const realRuns = (await fetchRealRuns(db, { extra: o.realRunIds })).map(r => ({ id: r.id, computed_at: r.at })).reverse();
  const pair = comparisonPair(realRuns.map(r => ({ id: r.id, at: r.computed_at })));
  const inWindow = realRuns.filter(r => r.computed_at >= since), pick = o.allRuns ? realRuns.slice(0, inWindow.length + 1) : realRuns.slice(0, 3);
  const chosen = [...new Map([...pick, ...realRuns.filter(r => r.id === pair?.earlier.id)].map(r => [r.id, r])).values()].sort((a, b) => a.id - b.id);
  const runs: RunRows[] = await Promise.all(chosen.map(async r => ({ id: r.id, at: r.computed_at, rows: (await (await import("../forecast-rows.server")).forecastRunRows(r.id)).map(x => ({ ...x, present: Array.isArray(x.present) ? x.present : [], sites: typeof x.sites === "number" ? x.sites : null, usable: typeof x.usable === "number" ? x.usable : null })) })));
  const latest = chosen.at(-1)?.id ?? null;
  const [historyRows, alerts, wire, launches, sites, now_, archive, setters, rebrands] = await Promise.all([
    // From REVERSAL_DAYS before the window, so a change back inside the window finds the change it reverses (reversal.ts).
    // library_events itself (the feed view keeps only the latest 200 rows, which a busy day overruns); sector comes from library_sites.
    pages<EventRow>((f, t) => db.from("library_events").select("id,domain,type,before,after,detected_at,source,page_type,viewport,summary,snapshot_id,prev_snapshot_id").eq("source", "live").eq("viewport", "desktop").gte("detected_at", new Date(now - (o.days + REVERSAL_DAYS) * 864e5).toISOString()).order("id").range(f, t) as never),
    db.from("wire_items").select("id,title,url,source,source_kind,published_at,excerpt,ref").eq("source_kind", "alert").gte("published_at", since).order("id").limit(500),
    pages<BuildInput["wire"][number]>((f, t) => db.from("wire_items").select("id,title,url,source,source_kind,published_at,excerpt").in("source_kind", ["rss", "hn", "bluesky"]).gte("published_at", since).lte("published_at", new Date(now).toISOString()).order("id").range(f, t) as never),
    db.from("wire_items").select("id,title,url,source,source_kind,published_at,excerpt").eq("source_kind", "producthunt").gte("published_at", since).order("id").limit(200),
    pages<{ domain: string; name: string | null; sector: string; active: boolean; last_snapshot_at: string | null; site_kind: string | null }>((f, t) => db.from("library_sites").select("domain,name,sector,active,last_snapshot_at,site_kind").order("domain").range(f, t) as never),
    readHistory<SiteRow & { captured_at: string | null }>(db, HIST, { now: true }),
    readHistory<SiteRow>(db, HIST, { now: false }),
    latest == null ? Promise.resolve({ data: [], error: null }) : db.from("trendsetters").select("domain,rank").eq("run_id", latest).order("rank"),
    import("../rebrands.server").then(m => m.rebrandRows()),
  ]);
  for (const r of [alerts, launches, setters]) if (r.error) throw r.error;
  const sectorOf = new Map(sites.map(x => [x.domain, x.sector]));
  const history = historyRows.filter(e => sectorOf.has(e.domain)).map(e => ({ ...e, sector: sectorOf.get(e.domain) ?? null })), events = history.filter(e => e.detected_at >= since);
  // E2e: every live change of the window (both viewports, every page) judged against the stored live captures. A failure fails the
  // build (fail closed: no change reaches a story unchecked).
  const checkEvents = await pages<EventRow & { viewport: string | null }>((f, t) => db.from("library_events").select("id,domain,type,before,after,detected_at,source,page_type,viewport,snapshot_id,prev_snapshot_id").eq("source", "live").gte("detected_at", new Date(now - (o.days + REVERSAL_DAYS) * 864e5).toISOString()).order("id").range(f, t) as never);
  const checks = await (await import("../integrity.server")).computeChecks(db, checkEvents);
  const [texts, calls, carousel, census] = await Promise.all([
    (await import("../promo.server")).snapshotTexts(db, events.flatMap(e => [e.snapshot_id, e.prev_snapshot_id])),
    (await import("./headline-call.server")).storedCalls(db as never, events.filter(e => e.type === "message_pivot").map(e => e.id)).catch(() => ({})),
    // E2c: snapshots whose first screen is a carousel (a failure reads as none: changes are judged as before).
    (await import("../carousel.server")).carouselSnapshots(db, events.flatMap(e => [e.snapshot_id, e.prev_snapshot_id])).catch(() => new Set<number>()),
    // E2g: the census captures and stored counts (a failure means no census this build; everything else is unaffected).
    (await import("../census.server")).censusInput(db, now).catch(() => null),
  ]);
  const h = new Map(now_.map(r => [r.domain, r]));
  const dec = <W extends { title: string; excerpt: string | null }>(w: W): W => ({ ...w, title: decodeEntities(w.title), excerpt: w.excerpt ? decodeEntities(w.excerpt) : null });
  return {
    now: new Date(now).toISOString(), events, history, runs,
    rebrands: rebrands.rows.filter(x => x.source === "live" && x.confirmed_at >= since) as unknown as RebrandRow[],
    alerts: (alerts.data ?? []).map(a => dec({ ...a, ref: a.ref ?? null })) as BuildInput["alerts"], wire: wire.map(dec), launches: (launches.data ?? []).map(dec) as BuildInput["launches"],
    sites: sites.filter(s => s.active).map(s => { const r = h.get(s.domain); return { domain: s.domain, name: s.name, kind: s.site_kind, sector: s.sector, captured: r?.captured_at ?? s.last_snapshot_at, traits: r ? [...new Set(forecastSiteTraits({ ...r, sector: s.sector }))] : [] }; }),
    archive: archive.map(r => ({ domain: r.domain, sector: r.sector, quarter: r.quarter, traits: [...new Set(forecastSiteTraits(r))], measured: archiveMeasured(r) })),
    trendsetters: (setters.data ?? []) as { domain: string; rank: number }[],
    texts: Object.fromEntries(texts),
    calls,
    carousel: [...carousel],
    checks: Object.fromEntries(checks),
    census,
  };
}


type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
/** `withAi` false: no model calls at all (dry runs and backfills). */
export function dbDeps(admin: Admin, withAi = true): BuildDeps {
  return {
    load: loadInput,
    existing: async since => {
      const { applyEdits } = await import("./edits");
      const rows = await pages<import("./edits").StoredStory>((f, t) => admin.from("stories").select("id,type,status,reason,score,components,why_ran,kicker,headline,deck,facts,why_line,why_model,why_at,sector,signal_keys,domains,evidence,source_ids,basis,happened_at,created_at").gte("happened_at", since).order("id").range(f, t) as never, 1000);
      const edits = await pages<import("./edits").EditRow>((f, t) => admin.from("story_edits").select("id,story_id,action,payload,note,at").order("id").range(f, t) as never, 1000);
      const by = new Map<string, import("./edits").EditRow[]>(); for (const e of edits) by.set(e.story_id, [...(by.get(e.story_id) ?? []), e]);
      return rows.map(r => { const v = applyEdits(r, by.get(r.id) ?? [], Date.now()); return { id: r.id, type: v.type as Existing["type"], status: r.status, state: v.state, score: r.score, basis: r.basis, happened_at: r.happened_at, domains: r.domains, signal_keys: r.signal_keys, sector: r.sector, headline: v.headline, deck: v.deck, facts: v.facts, source_ids: r.source_ids }; });
    },
    recordCensus: async rows => (await import("../census.server")).recordCensus(admin as never, rows),
    recordChecks: async checks => (await import("../integrity.server")).recordChecks(admin as never, new Map(Object.entries(checks).map(([k, v]) => [Number(k), v]))),
    calls: async (events, deadline, carousel) => (await import("./headline-call.server")).headlineCalls(admin, events.filter(e => e.type === "message_pivot" && (!e.page_type || e.page_type === "home")), { deadline, ...(carousel ? { carousel } : {}) }),
    appendFolds: async folds => {
      if (!folds.length) return 0;
      const { error } = await admin.from("story_edits").insert(folds.map(f => ({ story_id: f.story_id, action: "correct", payload: f.payload, note: f.note })) as never);
      if (error) throw new Error("fold_insert_failed");
      return folds.length;
    },
    insert: async rows => {
      let n = 0;
      for (let i = 0; i < rows.length; i += 200) {
        const { data, error } = await admin.from("stories").upsert(rows.slice(i, i + 200) as never, { onConflict: "id", ignoreDuplicates: true }).select("id");
        if (error) throw new Error("story_insert_failed");
        n += data?.length ?? 0;
      }
      return n;
    },
    // E2b: the writer replaced the "why it matters" line; stored lines stay in the database but no new ones are written.
    why: null,
    writer: withAi ? writerIO(admin) : null,
    toWrite: (fresh, limit) => storiesToWrite(admin, fresh, limit, writerIO(admin).runs(AI_MODELS.writer)),
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
    assignNumbers: () => assignStoryNumbers(admin, { sinceDays: NUMBER_LOOKBACK_DAYS }),
    retireReversed: (ids, identity) => retireReversedStories(admin, ids, identity),
    retireRereads: async shown => (await (await import("./reread-retire.server")).retireRereadStories(admin, shown)).retired.length,
    bases: shareBases,
    keepCrops: async () => (await import("./kept-crops.server")).keepStoryCrops(admin),
    pitches: async view => (await import("./pitch.server")).answerPitches(admin, view, "build"),
    insertLines: async rows => { const { data, error } = await admin.from("story_lines").upsert(rows, { onConflict: "story_id", ignoreDuplicates: true }).select("story_id"); if (error) throw new Error("line_insert_failed"); return data?.length ?? 0; },
  };
}

/** Count and base behind each share of the run (anonymous read of the forecast rows' stored quarters; see writer-facts.ts baseOf). */
export async function shareBases(runId: number, keys: string[], scopes: string[]): Promise<Map<string, ShareBase>> {
  const { supabaseAnon } = await import("../mcp/supabase"), { baseOf } = await import("./writer-facts");
  const split = keys.map(k => { const i = k.indexOf(":"); return [k.slice(0, i), k.slice(i + 1)] as const; }).filter(([d, v]) => d && v);
  if (!split.length) return new Map();
  const { data, error } = await supabaseAnon().from("forecasts").select("dimension,value,scope,current_share,quarters:evidence->quarters").eq("run_id", runId)
    .in("dimension", [...new Set(split.map(x => x[0]))]).in("value", [...new Set(split.map(x => x[1]))]).in("scope", scopes).limit(500);
  if (error) throw new Error("share_bases_failed");
  const want = new Set(keys), out = new Map<string, ShareBase>();
  for (const r of (data ?? []) as unknown as { dimension: string; value: string; scope: string; current_share: number | null; quarters: unknown }[]) {
    const k = `${r.dimension}:${r.value}`; if (!want.has(k)) continue;
    const b = baseOf(r.quarters, r.current_share); if (b) out.set(`${k}|${r.scope}`, b);
  }
  return out;
}

/** Stories the writer owes a version: the fresh ids first, then stories published in the last seven days (editor's overlay applied) with no
 *  version yet, or whose last correction is newer than their last version. Best first. */
export async function storiesToWrite(admin: Admin, fresh: string[], limit: number, writerRuns = true): Promise<FactStory[]> {
  const { applyEdits } = await import("./edits");
  const since = new Date(Date.now() - BUILD_DAYS * 864e5).toISOString();
  const cols = "id,type,status,reason,score,components,why_ran,kicker,headline,deck,facts,why_line,why_model,why_at,sector,signal_keys,domains,evidence,source_ids,basis,happened_at,created_at";
  const rows = await pages<import("./edits").StoredStory>((f, t) => admin.from("stories").select(cols).gte("happened_at", since).neq("type", "launch").order("id").range(f, t) as never, 1000);
  if (!rows.length) return [];
  type Last = { created_at: string; model: string; attempts: number; checked: boolean; headline: string; deck: string; body: string[] | null; how_we_know: string };
  const ids = rows.map(r => r.id), edits: import("./edits").EditRow[] = [], last = new Map<string, Last>();
  for (let i = 0; i < ids.length; i += 200) {
    const [e, t] = await Promise.all([admin.from("story_edits").select("id,story_id,action,payload,note,at").in("story_id", ids.slice(i, i + 200)).order("id"), admin.from("story_texts").select("story_id,created_at,model,attempts,checked,headline,deck,body,how_we_know").in("story_id", ids.slice(i, i + 200))]);
    if (e.error || t.error) throw new Error("to_write_read_failed");
    edits.push(...((e.data ?? []) as unknown as import("./edits").EditRow[]));
    for (const x of (t.data ?? []) as unknown as (Last & { story_id: string })[]) if ((last.get(x.story_id)?.created_at ?? "") < x.created_at) last.set(x.story_id, x);
  }
  const by = new Map<string, import("./edits").EditRow[]>(); for (const e of edits) by.set(e.story_id, [...(by.get(e.story_id) ?? []), e]);
  const shown = rows.map(r => applyEdits(r, by.get(r.id) ?? [], Date.now())).filter(s => s.state === "published");
  const { foldedIds } = await import("./edits"), folded = foldedIds(shown);
  // Owed: no version since the last correction, the newest one never reached the writer (made while the writer was out of calls), or (E2c)
  // the newest checked version puts a share beside a base it was not counted on (today's check would refuse it).
  const { shareBaseFailures, textOf, writePriority } = await import("./writer");
  const owed = shown.filter(s => { if (folded.has(s.id)) return false; const l = last.get(s.id); return !l || (s.correctedAt != null && s.correctedAt > l.created_at) || (writerRuns && !triedWriter(l)) || (l.checked && shareBaseFailures(textOf(l)).length > 0); });
  // E3b: the front page's lead first, then the census pieces, then the rest by the front page's rank. `fresh` (this build's stories)
  // are already among the owed ones and take their place by rank.
  void fresh;
  const [{ pickLead }, { rankScores }] = await Promise.all([import("../front/front"), import("./score")]);
  const stream = shown.filter(s => !folded.has(s.id)), leadId = pickLead(stream, "all", Date.now())?.story.id ?? null;
  return writePriority(owed, { leadId, rank: rankScores(stream) }).slice(0, limit)
    .map(s => ({ id: s.id, type: s.type, headline: s.headline, deck: s.deck, facts: s.facts, sector: s.sector, signal_keys: s.signal_keys, domains: s.domains, source_ids: s.source_ids, basis: s.basis, happened_at: s.happened_at, kicker: s.kicker }));
}

/** Builds number stories first published in this many days (older ones were numbered by earlier builds or the backfill). */
export const NUMBER_LOOKBACK_DAYS = 45;
/**
 * Number every published story (editor's overlay applied) that has none yet, continuing after the highest number. Insert-only; a clash with a
 * concurrent build (unique number or story) re-reads and retries, so numbers are never reused or changed. `sinceDays: null` reads every story (backfill).
 */
export async function assignStoryNumbers(admin: Admin, o: { sinceDays: number | null }): Promise<number> {
  const { applyEdits } = await import("./edits"), { assignNumbers } = await import("./numbers");
  type Row = { id: string; status: "published" | "held"; happened_at: string; created_at: string };
  const since = o.sinceDays == null ? null : new Date(Date.now() - o.sinceDays * 864e5).toISOString();
  const stories = await pages<Row>((f, t) => { let q = admin.from("stories").select("id,status,happened_at,created_at"); if (since) q = q.gte("created_at", since); return q.order("id").range(f, t) as never; }, 1000);
  if (!stories.length) return 0;
  const edits = await pages<import("./edits").EditRow>((f, t) => admin.from("story_edits").select("id,story_id,action,payload,note,at").order("id").range(f, t) as never, 1000);
  const by = new Map<string, import("./edits").EditRow[]>(); for (const e of edits) by.set(e.story_id, [...(by.get(e.story_id) ?? []), e]);
  const published = stories.filter(s => applyEdits(s as unknown as import("./edits").StoredStory, by.get(s.id) ?? [], Date.now()).state === "published");
  for (let attempt = 0; attempt < 3; attempt++) {
    const have = await pages<{ story_id: string; number: number }>((f, t) => admin.from("story_numbers").select("story_id,number").order("number").range(f, t) as never, 1000);
    const rows = assignNumbers(published, have);
    if (!rows.length) return 0;
    const { error } = await admin.from("story_numbers").insert(rows);
    if (!error) return rows.length;
    if (error.code !== "23505") throw new Error("story_numbers_insert_failed");
  }
  throw new Error("story_numbers_contended");
}

/** Stories that ran on a change since reversed get a kill edit "Retired: reversed within seven days" (once; stories are never rewritten). */
export async function retireReversedStories(admin: Admin, eventIds: number[], identityIds: string[] = []): Promise<number> {
  const { applyEdits } = await import("./edits"), { reversedStory, E0_RETIRE } = await import("./retire");
  const marked = new Set(eventIds), identity = new Set(identityIds), since = new Date(Date.now() - (BUILD_DAYS + 30) * 864e5).toISOString();
  const cols = "id,type,status,reason,score,components,why_ran,kicker,headline,deck,facts,why_line,why_model,why_at,sector,signal_keys,domains,evidence,source_ids,basis,happened_at,created_at";
  const stories = await pages<import("./edits").StoredStory>((f, t) => admin.from("stories").select(cols).in("type", ["move", "counter_move", "rebrand"]).gte("happened_at", since).order("id").range(f, t) as never, 1000);
  if (!stories.length) return 0;
  const edits: import("./edits").EditRow[] = [];
  for (let i = 0; i < stories.length; i += 200) { const { data, error } = await admin.from("story_edits").select("id,story_id,action,payload,note,at").in("story_id", stories.slice(i, i + 200).map(s => s.id)).order("id"); if (error) throw new Error("edits_read_failed"); edits.push(...((data ?? []) as unknown as import("./edits").EditRow[])); }
  const by = new Map<string, import("./edits").EditRow[]>(); for (const e of edits) by.set(e.story_id, [...(by.get(e.story_id) ?? []), e]);
  const now = Date.now(), why = E0_RETIRE.reversed;
  const kills = stories.filter(s => { const shown = applyEdits(s, by.get(s.id) ?? [], now); return shown.state === "published" && (reversedStory({ id: s.id, type: shown.type, source_ids: s.source_ids }, marked) || (shown.type === "move" && identity.has(s.id))); })
    .map(s => ({ story_id: s.id, action: "kill" as const, payload: { reason: why }, note: why }));
  if (!kills.length) return 0;
  const { error } = await admin.from("story_edits").insert(kills as never);
  if (error) throw new Error("reversed_kill_failed");
  return kills.length;
}

/** Entry point for jobs and the backfill script. */
export async function buildStories(o: BuildOptions & { withAi?: boolean } = {}): Promise<BuildResult> {
  if (o.dev) return runBuild({ load: async () => { throw new Error("unreachable"); }, existing: async () => [], insert: async () => 0 }, o);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return runBuild(dbDeps(supabaseAdmin, o.withAi !== false), o);
}

/** Wrapped call at the end of a job: never throws, never fails the job, skips when the job already used most of its time. */
// Scheduled calls answer within CALL_BUDGET_MS (jobs/steps.ts); the build only uses what is left of it.
const JOB_LIMIT_MS = CALL_BUDGET_MS, MIN_INTERVAL_MS = 120_000;
let lastRun = 0;
export async function afterJob(job: string, jobStartedAt: number, extra: Pick<BuildOptions, "realRunIds"> = {}): Promise<void> {
  try {
    const now = Date.now(), left = JOB_LIMIT_MS - (now - jobStartedAt) - 10_000;
    if (left < 5000 || now - lastRun < MIN_INTERVAL_MS) return void await studies(job, jobStartedAt);
    lastRun = now;
    const budgetMs = Math.min(BUILD_BUDGET_MS, left), writeDeadline = jobStartedAt + JOB_LIMIT_MS - 8000;
    const r = await Promise.race([buildStories({ ...extra, budgetMs, writeDeadline }), new Promise<null>(res => setTimeout(() => res(null), Math.max(budgetMs, writeDeadline - now) + 2000))]);
    if (r) console.info("story build", job, { inserted: r.inserted, published: r.published, held: r.held, texts: r.texts ? { written: r.texts.written, checked: r.texts.checked, calls: r.texts.calls } : null });
    else console.warn("story build timed out", job);
    // E3b: the front page's tape and card pictures come from records this build writes now, not from live reads per visit.
    if (r) await (await import("../records/refresh.server")).writeFrontRecords(job, jobStartedAt + JOB_LIMIT_MS - 5000);
    await studies(job, jobStartedAt);
  } catch (e) { console.error("story build failed", job, e instanceof Error ? e.message.slice(0, 80) : "UnknownError"); }
}
/** E4 · after the stories (their twelve calls come first), the study writer takes what time is left, when a call still fits. Never throws. */
async function studies(job: string, jobStartedAt: number) {
  await (await import("../data-stories/writer.server")).runStudyWriter(job, jobStartedAt + JOB_LIMIT_MS - 6000).catch(() => null);
  // E5 · then the digest writer (two calls a day at most, its own count), when a call still fits.
  await (await import("../digest/writer.server")).runDigestWriter(job, jobStartedAt + JOB_LIMIT_MS - 6000).catch(() => null);
}
export const storyLabel = (k: string) => label(k).name;
