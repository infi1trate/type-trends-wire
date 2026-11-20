// Writes precomputed page inputs (records.ts) from the jobs that change them: the 15-minute wire job sweeps whatever is due, a library
// batch rewrites the cards of the brands it captured, the crawl finish sweeps everything. Time-boxed, never throws, service role only.
// Every body is computed with the same anonymous reads and pure models the pages use, so a page serving a record shows the same thing.
import { SHARED, brandKey, cardsDue, due, pageKey, PAGES, type PageKind, type SharedKey } from "./records";
import { recordMetas, writeRecords } from "./store.server";
import { CALL_BUDGET_MS } from "../jobs/steps";

export type RefreshResult = { written: string[]; skipped: number; timed_out: boolean; errors: string[] };
const short = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/\s+/g, " ").slice(0, 120);

async function sharedBody(k: SharedKey): Promise<unknown> {
  switch (k) {
    case "site-index": return (await import("../read.server")).siteTraitIndex.compute();
    case "signals": { const m = await import("../signals.server"); return m.snapshot.encode(await m.snapshot.compute()); }
    case "rebrands": return (await import("../rebrands.server")).readerRebrands.compute();
    case "moving-runs": return (await import("../read.server")).movingRuns.compute();
    case "quarter-series": return (await import("../front/front.server")).quarterSeries.compute();
  }
}
/** Page models: one record per key (`kind:part…`), built by the page's own loader. None holds live stories (a finished week's Digest
 * shows its stories as they stood when the week ended), so a kill or a new story never waits on a record. */
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

/** Rewrite what is due (or forced) until the deadline. `domains`: brands just captured, whose cards are rewritten first. */
export async function refreshRecords(o: { job: string; deadline: number; domains?: string[]; force?: boolean; now?: () => number }): Promise<RefreshResult> {
  const now = o.now ?? Date.now, out: RefreshResult = { written: [], skipped: 0, timed_out: false, errors: [] };
  const left = () => o.deadline - now();
  const metas = new Map((await recordMetas()).map(m => [m.key, m.computed_at]));
  const metaOf = (key: string) => (metas.has(key) ? { key, computed_at: metas.get(key)! } : undefined);
  const write = async (rows: { key: string; body: unknown }[]) => { out.written.push(...await writeRecords(rows.map(r => ({ ...r, source: o.job })))); };
  const attempt = async (what: string, f: () => Promise<void>) => { if (left() < 3000) { out.timed_out = true; return; } try { await f(); } catch (e) { out.errors.push(`${what}: ${short(e)}`); } };

  // 1. Cards of the brands this job just captured (cheap: a few audit reads each).
  const { computeBrandCard, computeBrandSimilar, sectorFor } = await import("../brand-read.server");
  const cards = async (domains: string[]) => {
    for (let i = 0; i < domains.length; i += 4) {
      if (left() < 4000) { out.timed_out = true; return; }
      const chunk = domains.slice(i, i + 4), bodies = await Promise.all(chunk.map(d => computeBrandCard(d).catch(e => { out.errors.push(`card ${d}: ${short(e)}`); return undefined; })));
      await write(chunk.flatMap((d, k) => (bodies[k] === undefined ? [] : [{ key: brandKey("brand-card", d), body: bodies[k] }])));
    }
  };
  if (o.domains?.length) await attempt("cards (captured)", () => cards([...new Set(o.domains!.map(d => d.toLowerCase()))]));

  // 2. Shared inputs that are due (forced on a crawl finish).
  for (const k of Object.keys(SHARED) as SharedKey[]) {
    if (!o.force && !due(metaOf(k), now())) { out.skipped++; continue; }
    await attempt(k, async () => { const body = await sharedBody(k); await write([{ key: k, body }]); });
  }
  // 3. Similar brands and the sector field for every brand (one pass over the shared inputs).
  const { supabaseAnon } = await import("../mcp/supabase");
  const { data: siteRows } = await supabaseAnon().from("library_sites").select("domain,sector,active,last_snapshot_at").eq("active", true).order("domain").limit(2000);
  const sites = (siteRows ?? []) as { domain: string; sector: string; last_snapshot_at: string | null }[];
  const oldest = (kind: "brand-similar" | "brand-sector") => sites.map(s => metaOf(brandKey(kind, s.domain))).reduce<{ key: string; computed_at: string } | undefined>((m, x) => (!x ? undefined : !m ? x : x.computed_at < m.computed_at ? x : m), sites.length ? { key: brandKey(kind, "~"), computed_at: "9999" } : undefined);
  const missingAny = (kind: "brand-similar" | "brand-sector") => sites.some(s => !metas.has(brandKey(kind, s.domain)));
  for (const kind of ["brand-similar", "brand-sector"] as const) {
    const meta = missingAny(kind) ? undefined : oldest(kind);
    if (!o.force && meta && !due(meta, now())) { out.skipped++; continue; }
    await attempt(kind, async () => {
      if (kind === "brand-similar") {
        const bodies = await Promise.all(sites.map(s => computeBrandSimilar(s.domain)));
        await write(sites.map((s, k) => ({ key: brandKey(kind, s.domain), body: bodies[k] })));
      } else {
        const [{ dataInput }, { sectorField, signalContrast }] = await Promise.all([import("../data-stories/data.server"), import("../data-stories/stories")]);
        const input = await dataInput(), fields = new Map<string, ReturnType<typeof sectorField> | null>();
        for (const s of sites) if (!fields.has(s.sector)) fields.set(s.sector, sectorField(input, s.sector));
        await write(sites.map(s => ({ key: brandKey(kind, s.domain), body: sectorFor(input, s.sector, s.domain, sectorField, signalContrast, fields.get(s.sector) ?? null) })));
      }
    });
  }
  // 4. Page models that are due.
  for (const key of await pageKeys().catch(() => [] as string[])) {
    if (!o.force && !due(metaOf(key), now(), null, PAGES[key.split(":")[0] as PageKind]?.every)) { out.skipped++; continue; }
    await attempt(key, async () => { const body = await pageBody(key); if (body !== undefined) await write([{ key, body }]); });
  }
  // 5. Cards that are missing, dirtied by a newer capture or a newer signals record, or old — most out of date first, until the deadline.
  const queue = cardsDue(sites, metas, now(), metas.get("signals") ?? null).filter(d => !o.domains?.includes(d));
  if (queue.length) await attempt("cards (due)", () => cards(queue));
  return out;
}

const MIN_LEFT_MS = 6_000;
/** The end of a job's call: whatever time the call has left (CALL_BUDGET_MS minus a safety margin) goes to records. Never throws. */
export async function refreshAfterJob(job: string, jobStartedAt: number, o: { domains?: string[]; force?: boolean } = {}): Promise<RefreshResult | null> {
  try {
    const deadline = jobStartedAt + CALL_BUDGET_MS - 5_000;
    if (deadline - Date.now() < MIN_LEFT_MS) return null;
    const r = await refreshRecords({ job, deadline, ...o });
    console.info("records refresh", job, { written: r.written.length, skipped: r.skipped, timed_out: r.timed_out, errors: r.errors.length });
    return r;
  } catch (e) { console.error("records refresh failed", job, short(e)); return null; }
}
