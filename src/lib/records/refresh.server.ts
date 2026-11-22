// Writes precomputed page inputs (records.ts) from the jobs that change them: the 15-minute wire job sweeps whatever is due, a library
// batch rewrites only the cards of the brands it captured (`only: "captured"`, a few seconds), the crawl finish forces everything.
// Time-boxed, never throws, service role only. Every body is computed with the same anonymous reads and pure models the pages use,
// so a page serving a record shows the same thing.
//
// Deadline rules: each step has a cost estimate (the last run's duration on this instance, else STEP_ESTIMATE_MS). A step whose
// estimate does not fit in the time left is skipped (the next sweep picks it up), and a step that starts is still cut off at the
// deadline, so no call runs past it by more than a timer tick. Card loops check the per-chunk estimate before each chunk.
import { SHARED, brandKey, cardsDue, due, pageKey, PAGES, type PageKind, type SharedKey } from "./records";
import { CALL_BUDGET_MS } from "../jobs/steps";

export type RefreshResult = { written: string[]; skipped: number; timed_out: boolean; errors: string[] };
type Site = { domain: string; sector: string; last_snapshot_at: string | null };
type Row = { key: string; body: unknown };
/** Everything the refresh reads, computes and writes; injectable so tests run with fake steps and a fake clock. */
export type RefreshDeps = {
  metas: () => Promise<{ key: string; computed_at: string }[]>;
  write: (rows: (Row & { source: string })[]) => Promise<string[]>;
  card: (domain: string) => Promise<unknown>;
  shared: (k: SharedKey) => Promise<unknown>;
  sites: () => Promise<Site[]>;
  similar: (sites: Site[]) => Promise<Row[]>;
  sector: (sites: Site[]) => Promise<Row[]>;
  pageKeys: () => Promise<string[]>;
  page: (key: string) => Promise<unknown>;
};
const short = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/\s+/g, " ").slice(0, 120);

async function sharedBody(k: SharedKey): Promise<unknown> {
  switch (k) {
    case "site-index": return (await import("../read.server")).siteTraitIndex.compute();
    case "signals": { const m = await import("../signals.server"); return m.snapshot.encode(await m.snapshot.compute()); }
    case "rebrands": return (await import("../rebrands.server")).readerRebrands.compute();
    case "moving-runs": return (await import("../read.server")).movingRuns.compute();
    case "quarter-series": return (await import("../front/front.server")).quarterSeries.compute();
    case "front-tape": return (await import("../front/tape.server")).frontTapeRecord.compute();
    case "front-cards": return (await import("../front/front.server")).frontCards.compute();
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
  write: async rows => (await import("./store.server")).writeRecords(rows),
  card: async d => (await import("../brand-read.server")).computeBrandCard(d),
  shared: sharedBody,
  sites: async () => {
    const { supabaseAnon } = await import("../mcp/supabase");
    const { data, error } = await supabaseAnon().from("library_sites").select("domain,sector,active,last_snapshot_at").eq("active", true).order("domain").limit(2000);
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
};

/** Fixed starting estimates (ms) per step, used until this instance has timed the step once. Generous on purpose. */
export const STEP_ESTIMATE_MS: Readonly<Record<string, number>> = {
  metas: 1_500, sites: 1_500, "page-keys": 1_500, "card-chunk": 2_500,
  "site-index": 5_000, signals: 5_000, rebrands: 4_000, "moving-runs": 4_000, "quarter-series": 4_000, "front-tape": 6_000, "front-cards": 6_000,
  "brand-similar": 12_000, "brand-sector": 15_000, page: 5_000, "page:digest": 6_000,
};
const learned = new Map<string, number>();
export const resetStepEstimates = () => learned.clear();
/** The estimate bucket: a named step, or `page:<kind>` / `page` for a page model key (`brands-index`, `digest:2026-W46`, …). */
const stepOf = (what: string) => {
  if (what in STEP_ESTIMATE_MS) return what;
  const kind = what.split(":")[0] ?? what;
  return kind in PAGES ? (`page:${kind}` in STEP_ESTIMATE_MS ? `page:${kind}` : "page") : what;
};
export const estimateOf = (what: string, seed: Partial<Record<string, number>> = {}) => learned.get(stepOf(what)) ?? seed[stepOf(what)] ?? STEP_ESTIMATE_MS[stepOf(what)] ?? 5_000;

const TIMED_OUT = Symbol("timed out");
/** Resolve with the work, or with TIMED_OUT once `ms` passes (the work is abandoned, not awaited). */
function within<T>(ms: number, work: Promise<T>): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = new Promise<typeof TIMED_OUT>(r => { timer = setTimeout(() => r(TIMED_OUT), Math.max(0, ms)); });
  work.catch(() => {}); // an abandoned step's late failure must not surface as an unhandled rejection
  return Promise.race([work, stop]).finally(() => clearTimeout(timer));
}

export type RefreshOptions = { job: string; deadline: number; domains?: string[]; force?: boolean; only?: "captured"; now?: () => number; deps?: Partial<RefreshDeps>; estimates?: Partial<Record<string, number>> };
/** Rewrite what is due (or forced) until the deadline. `domains`: brands just captured, whose cards are rewritten first.
 *  `only: "captured"`: those cards and nothing else (a crawl batch). */
export async function refreshRecords(o: RefreshOptions): Promise<RefreshResult> {
  const now = o.now ?? Date.now, deps: RefreshDeps = { ...DEFAULT_DEPS, ...o.deps }, out: RefreshResult = { written: [], skipped: 0, timed_out: false, errors: [] };
  const left = () => o.deadline - now();
  const write = async (rows: Row[]) => { if (rows.length) out.written.push(...await deps.write(rows.map(r => ({ ...r, source: o.job })))); };
  /** Run one step if its estimate fits; cut it off at the deadline. Returns false when the step was skipped or cut off. */
  const attempt = async (what: string, f: () => Promise<void>): Promise<boolean> => {
    const step = stepOf(what), est = estimateOf(what, o.estimates);
    if (left() < est) { out.timed_out = true; out.skipped++; return false; }
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
  if (!await attempt("metas", async () => { metas = new Map((await deps.metas()).map(m => [m.key, m.computed_at])); })) return out;
  const metaOf = (key: string) => (metas.has(key) ? { key, computed_at: metas.get(key)! } : undefined);

  // 2. Shared inputs that are due (forced on a crawl finish).
  for (const k of Object.keys(SHARED) as SharedKey[]) {
    if (!o.force && !due(metaOf(k), now())) { out.skipped++; continue; }
    await attempt(k, async () => { const body = await deps.shared(k); await write([{ key: k, body }]); });
  }
  // 3. Similar brands and the sector field for every brand (one pass over the shared inputs).
  let sites: Site[] = [];
  if (!await attempt("sites", async () => { sites = await deps.sites(); })) return out;
  const oldest = (kind: "brand-similar" | "brand-sector") => sites.map(s => metaOf(brandKey(kind, s.domain))).reduce<{ key: string; computed_at: string } | undefined>((m, x) => (!x ? undefined : !m ? x : x.computed_at < m.computed_at ? x : m), sites.length ? { key: brandKey(kind, "~"), computed_at: "9999" } : undefined);
  const missingAny = (kind: "brand-similar" | "brand-sector") => sites.some(s => !metas.has(brandKey(kind, s.domain)));
  for (const kind of ["brand-similar", "brand-sector"] as const) {
    const meta = missingAny(kind) ? undefined : oldest(kind);
    if (!o.force && meta && !due(meta, now())) { out.skipped++; continue; }
    await attempt(kind, async () => { await write(await (kind === "brand-similar" ? deps.similar(sites) : deps.sector(sites))); });
  }
  // 4. Page models that are due.
  let keys: string[] = [];
  await attempt("page-keys", async () => { keys = await deps.pageKeys(); });
  for (const key of keys) {
    if (!o.force && !due(metaOf(key), now(), null, PAGES[key.split(":")[0] as PageKind]?.every)) { out.skipped++; continue; }
    await attempt(key, async () => { const body = await deps.page(key); if (body !== undefined) await write([{ key, body }]); });
  }
  // 5. Cards that are missing, dirtied by a newer capture or a newer signals record, or old — most out of date first, until the deadline.
  const queue = cardsDue(sites, metas, now(), metas.get("signals") ?? null).filter(d => !captured.includes(d));
  if (queue.length) await cards(queue);
  return out;
}

const MIN_LEFT_MS = 6_000, MIN_LEFT_CAPTURED_MS = 1_000;
/** The end of a job's call: whatever time the call has left (CALL_BUDGET_MS minus a safety margin, or `limitMs` from `jobStartedAt`
 *  when shorter) goes to records. Never throws. */
export async function refreshAfterJob(job: string, jobStartedAt: number, o: { domains?: string[]; force?: boolean; only?: "captured"; limitMs?: number; deps?: Partial<RefreshDeps> } = {}): Promise<RefreshResult | null> {
  try {
    const { limitMs, ...rest } = o;
    const deadline = Math.min(jobStartedAt + CALL_BUDGET_MS - 5_000, limitMs !== undefined ? jobStartedAt + limitMs : Infinity);
    if (deadline - Date.now() < (o.only === "captured" ? MIN_LEFT_CAPTURED_MS : MIN_LEFT_MS)) return null;
    // N4c · a job run row for the sweep (not for tests, which inject deps).
    const run = o.deps ? null : await (await import("../jobs/runs.server")).startRun("records-refresh", { note: job });
    const r = await refreshRecords({ job, deadline, ...rest });
    console.info("records refresh", job, { written: r.written.length, skipped: r.skipped, timed_out: r.timed_out, errors: r.errors.length });
    await run?.finish(r.errors.length === 0, `${job} · ${r.written.length} written, ${r.skipped} skipped${r.timed_out ? ", timed out" : ""}${r.errors.length ? `, ${r.errors.length} errors` : ""}`);
    return r;
  } catch (e) { console.error("records refresh failed", job, short(e)); return null; }
}

/** E3b · the front page's two records, written by the story build right after it runs (it has just recorded the integrity checks and
 *  stored the day's stories): the tape block and Also today's card pictures. Each is cut off at the deadline; never throws. */
export type FrontRecordDeps = { tape: () => Promise<unknown>; cards: () => Promise<unknown>; write: (rows: { key: string; body: unknown; source: string }[]) => Promise<string[]>; fresh?: () => Promise<unknown>; now?: () => number };
export async function writeFrontRecords(job: string, deadline: number, deps?: FrontRecordDeps): Promise<string[]> {
  try {
    const d: FrontRecordDeps = deps ?? {
      tape: async () => (await import("../front/tape.server")).frontTapeRecord.compute(),
      cards: async () => (await import("../front/front.server")).frontCards.compute(),
      write: async rows => (await import("./store.server")).writeRecords(rows),
      // The build just stored stories: read them fresh, not this instance's minute-old copy.
      fresh: async () => (await import("../stories/read.server")).deskIndex(),
    };
    const now = d.now ?? Date.now, out: string[] = [];
    if (d.fresh) { const r = await within(deadline - now(), d.fresh()); if (r === TIMED_OUT) return out; }
    for (const [key, f] of [["front-tape", d.tape], ["front-cards", d.cards]] as const) {
      if (deadline - now() < 1_000) break;
      const body = await within(deadline - now(), f());
      if (body === TIMED_OUT) break;
      out.push(...await d.write([{ key, body, source: job }]));
    }
    return out;
  } catch (e) { console.error("front records failed", job, short(e)); return []; }
}
