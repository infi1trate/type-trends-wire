// Writes precomputed page inputs (records.ts) from the jobs that change them: the 15-minute wire job sweeps whatever is due, a library
// batch rewrites only the cards of the brands it captured (`only: "captured"`, a few seconds), the crawl finish forces everything.
// Time-boxed, never throws, service role only. Every body is computed with the same anonymous reads and pure models the pages use,
// so a page serving a record shows the same thing.
//
// Deadline rules: each step has a cost estimate (the last run's duration on this instance, else STEP_ESTIMATE_MS). A step whose
// estimate does not fit in the time left is skipped (the next sweep picks it up), and a step that starts is still cut off at the
// deadline, so no call runs past it by more than a timer tick. Card loops check the per-chunk estimate before each chunk.
import { pagedRows } from "../paged";
import { SHARED, brandKey, cardsDue, due, everyOf, isUrgent, lastLook, maxAgeOf, pageKey, PAGES, type PageKind, type RecordMeta, type SharedKey } from "./records";
import { CALL_BUDGET_MS } from "../jobs/steps";

export type RefreshResult = { written: string[]; /** D1b · bodies unchanged since the stored copy: only their time moved. */ retimed: string[]; /** D1c · unchanged and inside four fifths of their limit: only the check was recorded. */ checked: string[]; skipped: number; timed_out: boolean; errors: string[]; /** D1b · the queue as run, and the overdue items it reached. */ order?: string[]; overdue_tried: string[] };
type Site = { domain: string; sector: string; last_snapshot_at: string | null };
type Row = { key: string; body: unknown };
/** Everything the refresh reads, computes and writes; injectable so tests run with fake steps and a fake clock. */
export type RefreshDeps = {
  metas: () => Promise<{ key: string; computed_at: string }[]>;
  /** D1c · when each record (or per-brand set, by kind) was last found unchanged; and the newest real change of the signals record. */
  checks: () => Promise<Map<string, string>>;
  signalsChanged: () => Promise<string | null>;
  /** The keys rewritten; or (the real store) those rewritten, those whose unchanged body only had its time moved, and those only checked.
   *  `set`: the rows are one whole per-brand set (its check is one row). */
  write: (rows: (Row & { source: string })[], o?: { set?: string }) => Promise<string[] | { written: string[]; retimed: string[]; checked?: string[] }>;
  card: (domain: string) => Promise<unknown>;
  shared: (k: SharedKey) => Promise<unknown>;
  sites: () => Promise<Site[]>;
  similar: (sites: Site[]) => Promise<Row[]>;
  sector: (sites: Site[]) => Promise<Row[]>;
  pageKeys: () => Promise<string[]>;
  page: (key: string) => Promise<unknown>;
  /** W3d-c · copies written by another build that go first, as if missing (records.ts `copiesOfOldBuild`); none when unreadable. */
  oldBuild?: () => Promise<string[]>;
};
const short = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/\s+/g, " ").slice(0, 120);

async function sharedBody(k: SharedKey): Promise<unknown> {
  switch (k) {
    case "site-index": return (await import("../read.server")).siteTraitIndex.compute();
    case "signals": { const m = await import("../signals.server"); return m.snapshot.encode(await m.snapshot.compute()); }
    // P2c · a rebrands list built without the change checks is missing every live rebrand: never stored (the record stays as it was).
    case "rebrands": { const b = await (await import("../rebrands.server")).readerRebrands.compute(); if (b.partial) throw new Error("rebrands_incomplete"); return b; }
    case "moving-runs": return (await import("../read.server")).movingRuns.compute();
    case "quarter-series": return (await import("../front/front.server")).quarterSeries.compute();
    case "front-tape": return (await import("../front/tape.server")).frontTapeRecord.compute();
    case "front-cards": return (await import("../front/front.server")).frontCards.compute();
    case "front-leads": return (await import("../front/front.server")).computeFrontLeads();
    case "front-first": return (await import("../front/front.server")).computeFrontFirst();
    case "library": return (await import("../library-read.server")).computeLibrary();
  }
}
/** Page models: one record per key (`kind:part…`), built by the page's own loader. A finished week's Digest holds its week's stories
 * as they stand now (E5), so its records are rechecked every half hour like the other pages. */
async function pageKeys(): Promise<string[]> {
  const [{ DATA_STORIES }, { COLLECTIONS }] = await Promise.all([import("../data-stories/registry"), import("../collections/registry")]);
  const d = await import("../digest/digest.server"), weeks = (await d.latestIssueWeeks(4).catch(() => [] as string[])).filter(w => d.finishedWeek(w));
  return [pageKey("brands-index"), pageKey("data-index"), ...DATA_STORIES.map(e => pageKey("data-story", e.slug)), pageKey("collections"), ...COLLECTIONS.map(c => pageKey("collection", c.slug, 1)), pageKey("gallery", "default"), ...weeks.map(w => pageKey("digest", w))];
}
export async function pageBody(key: string): Promise<unknown> {
  const [kind, a, b] = key.split(":") as [PageKind, string?, string?];
  // W3d-c · a study copy is never built from input cached before the newest removal (another server took it).
  if (kind === "data-story" || kind === "data-index") await (await import("../removal.server")).freshAfterRemovals().catch(() => false);
  switch (kind) {
    case "data-index": return (await import("../data-stories/page.server")).computeDataIndex();
    case "data-story": return (await import("../data-stories/page.server")).computeDataStory(a ?? "");
    case "collections": return (await import("../gallery.server")).computeCollections();
    case "collection": return (await import("../gallery.server")).computeCollection(a ?? "", Number(b ?? 1));
    case "gallery": return (await import("../gallery.server")).computeDefaultGallery();
    case "digest": return (await import("../digest/digest.server")).computeIssue(a ?? null);
    case "brands-index": return (await import("../read.server")).computeBrands();
  }
}
const DEFAULT_DEPS: RefreshDeps = {
  metas: async () => (await import("./store.server")).recordMetas(),
  write: async (rows, o) => (await import("./store.server")).writeRecordsCounted(rows, o),
  checks: async () => (await import("./store.server")).recordChecks(),
  signalsChanged: async () => (await import("./store.server")).changedAt("signals"),
  card: async d => (await import("../brand-read.server")).computeBrandCard(d),
  shared: sharedBody,
  sites: async () => {
    const { supabaseAnon } = await import("../mcp/supabase");
    const { data, error } = await pagedRows((f, t) => supabaseAnon().from("library_sites").select("domain,sector,active,last_snapshot_at").eq("active", true).order("domain").range(f, t));
    if (error) throw new Error("site list read failed");
    return (data ?? []) as Site[];
  },
  similar: async sites => {
    const { computeBrandSimilar } = await import("../brand-read.server");
    const bodies = await Promise.all(sites.map(s => computeBrandSimilar(s.domain)));
    return sites.map((s, k) => ({ key: brandKey("brand-similar", s.domain), body: bodies[k] }));
  },
  sector: async sites => {
    const [{ sectorFor }, { dataInput }, { sectorField, signalContrast }] = await Promise.all([import("../brand-read.server"), import("../data-stories/data.server"), import("../data-stories/stories")]);
    const input = await dataInput(), fields = new Map<string, ReturnType<typeof sectorField> | null>();
    for (const s of sites) if (!fields.has(s.sector)) fields.set(s.sector, sectorField(input, s.sector));
    return sites.map(s => ({ key: brandKey("brand-sector", s.domain), body: sectorFor(input, s.sector, s.domain, sectorField, signalContrast, fields.get(s.sector) ?? null) }));
  },
  pageKeys,
  page: pageBody,
  oldBuild: async () => { const [{ oldBuildCopies }, { BUILD }] = await Promise.all([import("./store.server"), import("../build-stamp")]); return oldBuildCopies(BUILD); },
};

/** Fixed starting estimates (ms) per step, used until this instance has timed the step once. Generous on purpose.
 *  D1b · page models have one bucket per kind (a 9 s data-index no longer makes every page look slow); measured cold on 23 Nov:
 *  brands-index 9.5 s, data-index 9.5 s (it loads the studies' shared input; the data-story pages after it take 0.2 s), digest 3.3 s,
 *  collections 1.9 s, a collection or the gallery under 0.6 s, brand-similar 1.4 s, brand-sector 11 s (the same studies input + 1.6 s). */
export const STEP_ESTIMATE_MS: Readonly<Record<string, number>> = {
  metas: 1_500, sites: 1_500, "page-keys": 1_500, "card-chunk": 2_500,
  "site-index": 5_000, signals: 5_000, rebrands: 6_000, "moving-runs": 4_000, "quarter-series": 4_000, "front-tape": 8_000, "front-cards": 6_000, "front-leads": 8_000, "front-first": 4_000, library: 4_000,
  "brand-similar": 4_000, "brand-sector": 12_000, page: 5_000,
  "page:brands-index": 11_000, "page:data-index": 11_000, "page:data-story": 11_000, "page:digest": 5_000, "page:collections": 3_000, "page:collection": 2_000, "page:gallery": 2_000,
};
const learned = new Map<string, number>();
export const resetStepEstimates = () => learned.clear();
/** The estimate bucket: a named step, or `page:<kind>` for a page model key (`brands-index`, `digest:2026-W46`, …). */
const stepOf = (what: string) => {
  if (what in STEP_ESTIMATE_MS) return what;
  const kind = what.split(":")[0] ?? what;
  return kind in PAGES ? `page:${kind}` : what;
};
export const estimateOf = (what: string, seed: Partial<Record<string, number>> = {}) => {
  const step = stepOf(what), isPage = step.startsWith("page:");
  return learned.get(step) ?? seed[step] ?? (isPage ? seed["page"] : undefined) ?? STEP_ESTIMATE_MS[step] ?? (isPage ? STEP_ESTIMATE_MS["page"] : undefined) ?? 5_000;
};

const TIMED_OUT = Symbol("timed out");
/** Resolve with the work, or with TIMED_OUT once `ms` passes (the work is abandoned, not awaited). */
function within<T>(ms: number, work: Promise<T>): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = new Promise<typeof TIMED_OUT>(r => { timer = setTimeout(() => r(TIMED_OUT), Math.max(0, ms)); });
  work.catch(() => {}); // an abandoned step's late failure must not surface as an unhandled rejection
  return Promise.race([work, stop]).finally(() => clearTimeout(timer));
}

export type RefreshOptions = { job: string; deadline: number; domains?: string[]; force?: boolean; only?: "captured"; now?: () => number; deps?: Partial<RefreshDeps>; estimates?: Partial<Record<string, number>>;
  /** D1c · the record times the pass already read (to decide the sweep was urgent), so they are not read twice. */ metas?: readonly RecordMeta[] | { key: string; computed_at: string }[] };
/** Rewrite what is due (or forced) until the deadline. `domains`: brands just captured, whose cards are rewritten first.
 *  `only: "captured"`: those cards and nothing else (a crawl batch). */
export async function refreshRecords(o: RefreshOptions): Promise<RefreshResult> {
  const now = o.now ?? Date.now, deps: RefreshDeps = { ...DEFAULT_DEPS, ...o.deps }, out: RefreshResult = { written: [], retimed: [], checked: [], skipped: 0, timed_out: false, errors: [], overdue_tried: [] };
  const left = () => o.deadline - now();
  const write = async (rows: Row[], wo?: { set?: string }) => {
    if (!rows.length) return;
    const r = await deps.write(rows.map(x => ({ ...x, source: o.job })), wo);
    if (Array.isArray(r)) out.written.push(...r); else { out.written.push(...r.written); out.retimed.push(...r.retimed); out.checked.push(...(r.checked ?? [])); }
  };
  /** Run one step if its estimate fits (an urgent step runs whatever its estimate: D1c); cut it off at the deadline. Returns false when
   *  the step was skipped or cut off. */
  const attempt = async (what: string, f: () => Promise<void>, urgent = false): Promise<boolean> => {
    const step = stepOf(what), est = estimateOf(what, o.estimates);
    if (urgent ? left() <= 0 : left() < est) { out.timed_out = true; out.skipped++; return false; }
    const t0 = now();
    try {
      const r = await within(left(), f());
      const took = now() - t0;
      if (r === TIMED_OUT) { out.timed_out = true; out.errors.push(`${what}: cut off at the deadline`); learned.set(step, Math.min(60_000, Math.max(est, took) * 1.5)); return false; }
      learned.set(step, took);
      return true;
    } catch (e) { out.errors.push(`${what}: ${short(e)}`); return false; }
  };
  const cards = async (domains: string[]) => {
    for (let i = 0; i < domains.length; i += 4) {
      const chunk = domains.slice(i, i + 4);
      const ok = await attempt("card-chunk", async () => {
        const bodies = await Promise.all(chunk.map(d => deps.card(d).catch(e => { out.errors.push(`card ${d}: ${short(e)}`); return undefined; })));
        await write(chunk.flatMap((d, k) => (bodies[k] === undefined ? [] : [{ key: brandKey("brand-card", d), body: bodies[k] }])));
      });
      if (!ok && out.timed_out) return; // the rest wait for the next sweep (cardsDue puts them first)
    }
  };
  const captured = [...new Set((o.domains ?? []).map(d => d.toLowerCase()))];

  // 1. Cards of the brands this job just captured (cheap: a few audit reads each).
  if (captured.length) await cards(captured);
  if (o.only === "captured") return out;

  let metas = new Map<string, string>();
  if (o.metas) metas = new Map(o.metas.map(m => [m.key, m.computed_at]));
  else if (!await attempt("metas", async () => { metas = new Map((await deps.metas()).map(m => [m.key, m.computed_at])); })) return out;
  const metaOf = (key: string) => (metas.has(key) ? { key, computed_at: metas.get(key)! } : undefined);
  // D1c · the recorded checks (an unreadable list means every record looks due by its own time, as before D1c).
  let checks = new Map<string, string>(), signalsChanged: string | null = null;
  try {
    const r = await within(left(), Promise.all([deps.checks(), deps.signalsChanged().catch(() => null)]));
    if (r === TIMED_OUT) { out.timed_out = true; out.errors.push("checks: cut off at the deadline"); return out; }
    [checks, signalsChanged] = r;
  } catch (e) { out.errors.push(`checks: ${short(e)}`); }
  // W3d-c · a copy from another build that must not outlive it is treated as missing: due and urgent on this pass.
  try {
    // Injected deps (tests) name their own list or none; only the real store reads it.
    const oldBuild = o.deps ? o.deps.oldBuild : DEFAULT_DEPS.oldBuild;
    const r = oldBuild ? await within(left(), oldBuild()) : [];
    if (r !== TIMED_OUT) for (const k of r) { metas.delete(k); checks.delete(k); }
  } catch (e) { out.errors.push(`old-build: ${short(e)}`); }
  const lookOf = (key: string) => { const at = lastLook(metas.get(key), checks.get(key)); return at ? { key, computed_at: at } : undefined; };

  // D1b · one queue for the shared inputs, the page models and the two per-brand sets, in this order: what is past the age a page
  // will serve (cheapest first, so one slow build cannot keep the rest overdue), then what is merely due (closest to its limit first).
  // Before, every shared input was rewritten each pass first (≈18 s) and the first overdue page was cut off at the deadline, so seven
  // kinds stayed 6–14 h past their limits. Past their limit, the per-brand sets (48 h limits) go after the pages.
  let keys: string[] = [];
  await attempt("page-keys", async () => { keys = await deps.pageKeys(); });
  let sites: Site[] | null = null, sitesFailed = false;
  const loadSites = async () => {
    if (sites || sitesFailed) return !!sites;
    if (!await attempt("sites", async () => { sites = await deps.sites(); })) { sitesFailed = true; return false; }
    return true;
  };
  // D1c · the site list first: a per-brand set's age is its tracked brands' oldest row (a brand no longer tracked is never rewritten).
  await loadSites();
  const tracked = sites ? new Set((sites as Site[]).map(s => s.domain.toLowerCase())) : null;
  const page = async (key: string, urgent: boolean) => attempt(key, async () => { const body = await deps.page(key); if (body !== undefined) await write([{ key, body }]); }, urgent);
  type Meta = { computed_at: string } | undefined;
  type Item = { what: string; brand: boolean; meta: Meta; look: Meta; run: (urgent: boolean) => Promise<unknown> };
  const items: Item[] = [
    ...(Object.keys(SHARED) as SharedKey[]).map(k => ({ what: k, brand: false, meta: metaOf(k), look: lookOf(k), run: (u: boolean) => attempt(k, async () => { const body = await deps.shared(k); await write([{ key: k, body }]); }, u) })),
    ...keys.map(k => ({ what: k, brand: false, meta: metaOf(k), look: lookOf(k), run: (u: boolean) => page(k, u) })),
  ];
  const brandRows = (kind: "brand-similar" | "brand-sector") => [...metas].filter(([k]) => k.startsWith(`${kind}:`) && (!tracked || tracked.has(k.slice(kind.length + 1))));
  const brandMeta = (kind: "brand-similar" | "brand-sector"): Meta => { const rows = brandRows(kind).map(([, at]) => at); return rows.length ? { computed_at: rows.sort()[0]! } : undefined; };
  const brandMissing = (kind: "brand-similar" | "brand-sector") => !sites || (sites as Site[]).some(s => !metas.has(brandKey(kind, s.domain)));
  for (const kind of ["brand-similar", "brand-sector"] as const) {
    const m = brandMeta(kind), at = lastLook(m?.computed_at, checks.get(kind));
    items.push({ what: kind, brand: true, meta: m, look: brandMissing(kind) || !at ? undefined : { computed_at: at }, run: async (u: boolean) => {
      if (!sites) return false;
      const all = sites as Site[];
      return attempt(kind, async () => { await write(await (kind === "brand-similar" ? deps.similar(all) : deps.sector(all)), { set: kind }); }, u);
    } });
  }
  const t = now();
  const ageOf = (it: { meta: Meta }) => (it.meta ? t - Date.parse(it.meta.computed_at) : Infinity);
  const limitOf = (what: string) => maxAgeOf(what.startsWith("brand-") ? brandKey(what as "brand-similar", "~") : what) || 1;
  const overdue = (it: Item) => ageOf(it) >= limitOf(it.what);
  const isDue = (it: Item) => o.force || due(it.look ? { key: it.what, ...it.look } : undefined, t, null, everyOf(it.what.startsWith("brand-") ? brandKey(it.what as "brand-similar", "~") : it.what));
  const order = sweepOrder(items.map(it => ({ what: it.what, brand: it.brand, age: ageOf(it), limit: limitOf(it.what), est: estimateOf(it.what, o.estimates), due: isDue(it) })));
  out.order = order.map(x => x.what);
  for (const x of order) {
    const it = items.find(i => i.what === x.what)!;
    if (!x.due) { out.skipped++; continue; }
    if (overdue(it)) out.overdue_tried.push(it.what);
    await it.run(isUrgent(x.age, x.limit));
  }
  // Cards that are missing, dirtied by a newer capture or a changed signals record, or old (by their last look) — most out of date
  // first, until the deadline. D1c · a re-timed signals record is not a change (before, every re-timing dirtied all 300 cards).
  if (!sites) return out;
  const cardLooks = new Map([...metas].filter(([k]) => k.startsWith("brand-card:")).map(([k, at]) => [k, lastLook(at, checks.get(k)) ?? at]));
  const queue = cardsDue(sites, cardLooks, now(), signalsChanged).filter(d => !captured.includes(d));
  if (queue.length) await cards(queue);
  return out;
}

/** D1b · the sweep's order (pure): shared inputs and page models past their limit, cheapest first (then most overdue); per-brand sets
 *  past their limit (cheapest first too); then everything due but inside its limit, closest to its limit first (a 48 h per-brand set at
 *  40 h goes before a shared input at 20 min of 3 h, so the slow sets are rebuilt before they go past). Not-due items
 *  keep their place at the end (the sweep counts them as skipped). */
export type SweepItem = { what: string; brand: boolean; age: number; limit: number; est: number; due: boolean };
export function sweepOrder(items: readonly SweepItem[]): SweepItem[] {
  const tier = (x: SweepItem) => (!x.due ? 4 : isUrgent(x.age, x.limit) ? (x.brand ? 1 : 0) : 2);
  const frac = (x: SweepItem) => (Number.isFinite(x.age) ? x.age / x.limit : Infinity);
  const lateBy = (x: SweepItem) => (Number.isFinite(x.age) ? x.age - x.limit : Infinity);
  // D1c · urgent items (past their limit, or passing it before the next pass) most late first, whatever they cost; the rest by closeness.
  return [...items].sort((a, b) => tier(a) - tier(b) || (tier(a) <= 1 ? lateBy(b) - lateBy(a) || a.est - b.est : 0) || frac(b) - frac(a)); // stable: ties keep the given order
}

/** Page keys whose record is missing or older than the age a page will serve (`maxAgeOf`), most overdue first. */
export function overdueFirst(keys: readonly string[], metaOf: (key: string) => { computed_at: string } | undefined, now: number): string[] {
  const over = (k: string) => { const m = metaOf(k); return m ? now - Date.parse(m.computed_at) - maxAgeOf(k) : Infinity; };
  return keys.filter(k => over(k) > 0).sort((a, b) => over(b) - over(a) || a.localeCompare(b));
}

/** The sweep's run note: "wire · 6 written, 9 re-timed, 4 skipped, timed out, 1 error (rebrands: rebrands_incomplete)". */
export const sweepNote = (job: string, r: Pick<RefreshResult, "written" | "retimed" | "skipped" | "timed_out" | "errors"> & { checked?: string[] }) =>
  `${job} · ${r.written.length} written, ${r.retimed.length} re-timed${r.checked?.length ? `, ${r.checked.length} checked unchanged` : ""}, ${r.skipped} skipped${r.timed_out ? ", timed out" : ""}${r.errors.length ? `, ${r.errors.length} error${r.errors.length === 1 ? "" : "s"} (${r.errors.slice(0, 2).join("; ").slice(0, 160)})` : ""}`;
const MIN_LEFT_MS = 6_000, MIN_LEFT_CAPTURED_MS = 1_000;
/** The end of a job's call: whatever time the call has left (CALL_BUDGET_MS minus a safety margin, or `limitMs` from `jobStartedAt`
 *  when shorter) goes to records. Never throws. */
export async function refreshAfterJob(job: string, jobStartedAt: number, o: { domains?: string[]; force?: boolean; only?: "captured"; limitMs?: number; deps?: Partial<RefreshDeps>; metas?: NonNullable<RefreshOptions["metas"]> } = {}): Promise<RefreshResult | null> {
  try {
    const { limitMs, ...rest } = o;
    const deadline = Math.min(jobStartedAt + CALL_BUDGET_MS - 5_000, limitMs !== undefined ? jobStartedAt + limitMs : Infinity);
    if (deadline - Date.now() < (o.only === "captured" ? MIN_LEFT_CAPTURED_MS : MIN_LEFT_MS)) return null;
    // N4c · a job run row for the sweep (not for tests, which inject deps).
    const run = o.deps ? null : await (await import("../jobs/runs.server")).startRun("records-refresh", { note: job });
    const r = await refreshRecords({ job, deadline, ...rest });
    console.info("records refresh", job, { written: r.written.length, retimed: r.retimed.length, checked: r.checked.length, skipped: r.skipped, timed_out: r.timed_out, errors: r.errors });
    // D1b · the run row names its errors and what it only re-timed, so a stuck sweep is readable from job_runs and health alone.
    await run?.finish(r.errors.length === 0, sweepNote(job, r), { written: r.written.length, retimed: r.retimed.length, checked: r.checked.length, skipped: r.skipped, timed_out: r.timed_out, errors: r.errors.slice(0, 8), overdue_tried: r.overdue_tried.slice(0, 20), order: (r.order ?? []).slice(0, 30) });
    return r;
  } catch (e) { console.error("records refresh failed", job, short(e)); return null; }
}

/** E3b · the front page's records (C1: three, with the lead pictures), written by the story build right after it runs (it has just recorded the integrity checks and
 *  stored the day's stories): the latest changes block and Also today's card pictures. Each is cut off at the deadline; never throws. */
export type FrontRecordDeps = { tape: () => Promise<unknown>; cards: () => Promise<unknown>; /** C1 · the lead pictures (optional so older callers keep their two). */ leads?: () => Promise<unknown>; /** C1b · the lead's announced picture (optional, like `leads`). */ first?: () => Promise<unknown>; write: (rows: { key: string; body: unknown; source: string }[]) => Promise<string[]>; fresh?: () => Promise<unknown>; now?: () => number };
export async function writeFrontRecords(job: string, deadline: number, deps?: FrontRecordDeps): Promise<string[]> {
  try {
    const d: FrontRecordDeps = deps ?? {
      tape: async () => (await import("../front/tape.server")).frontTapeRecord.compute(),
      cards: async () => (await import("../front/front.server")).frontCards.compute(),
      leads: async () => (await import("../front/front.server")).computeFrontLeads(),
      first: async () => (await import("../front/front.server")).computeFrontFirst(),
      write: async rows => (await import("./store.server")).writeRecords(rows),
      // The build just stored stories: read them fresh, not this instance's minute-old copy.
      fresh: async () => (await import("../stories/read.server")).deskIndex(),
    };
    const now = d.now ?? Date.now, out: string[] = [];
    if (d.fresh) { const r = await within(deadline - now(), d.fresh()); if (r === TIMED_OUT) return out; }
    for (const [key, f] of [["front-tape", d.tape], ["front-cards", d.cards], ...(d.leads ? [["front-leads", d.leads] as const] : []), ...(d.first ? [["front-first", d.first] as const] : [])] as const) {
      if (deadline - now() < 1_000) break;
      const body = await within(deadline - now(), f());
      if (body === TIMED_OUT) break;
      out.push(...await d.write([{ key, body, source: job }]));
    }
    return out;
  } catch (e) { console.error("front records failed", job, short(e)); return []; }
}
