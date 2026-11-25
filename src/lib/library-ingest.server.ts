import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { advance, diffLibrarySignals, type Baseline, type Pending } from "./library-diff";
import { librarySnapshotsPayload, librarySyncPayload } from "./library-payload";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
import { correctSites, isWrongSite } from "./site-corrections";

const contextSchema = z.object({
  prev: z.object({ id: z.number(), signals: z.record(z.string(), z.json()), content_hash: z.string().nullable() }).nullable(),
  new_surface: z.boolean(),
  first_captured_at: z.string().nullable(),
  sector: z.string(),
  latest_captured_at: z.string().nullable(),
  baseline: z.object({ signals: z.record(z.string(), z.json()), snapshot_id: z.number().nullable(), confirmed_at: z.string(), pending: z.record(z.string(), z.json()) }).nullable(),
});
const resultSchema = z.object({ retry: z.boolean().optional(), inserted: z.number().optional(), events: z.number().optional() });
export async function ingestLibrary(payload: z.infer<typeof librarySyncPayload> | z.infer<typeof librarySnapshotsPayload>): Promise<Response> {
  if (payload.kind === "library_sync") {
    // I3b: a wrong address on file is replaced by the brand's real one, so the wrong one stays inactive whatever the seeds say.
    // R2a · the RPC is unchanged and gets the fields it always got; categories are filled after it, in server code.
    const sites = correctSites(payload.sites);
    const [{ splitSync }, { fillClassification }] = await Promise.all([import("./library-sync"), import("./categories")]);
    const res = await splitSync(syncStore(), sites, s => fillClassification({ domain: s.domain, sector: s.sector }, { ...(s.category ? { category: s.category } : {}), ...(s.subcategory ? { subcategory: s.subcategory } : {}) }));
    if (!res.ok) return Response.json({ error: res.error }, { status: 422 });
    await fillCategories(db, sites).catch(() => undefined);
    return Response.json({ ok: true, inserted: 0, events: 0, panel: res.panel, onboarding_new: res.onboarding_new, onboarding_kept: res.onboarding_kept, onboarding_cleared: res.onboarding_cleared });
  }
  let inserted = 0, events = 0;
  // Sort archive/backfill batches so each key compares to its immediately earlier capture.
  for (const snapshot of payload.snapshots.filter(x => !isWrongSite(x.domain)).sort((a, b) => Date.parse(a.captured_at) - Date.parse(b.captured_at))) {
    const row = { ...snapshot, ...(payload.run_id ? { run_id: payload.run_id } : {}) };
    if(snapshot.source==="wayback") {
      const {data,error}=await db.rpc("library_archive_store",{p_snapshot:row as Json});if(error)throw new Error("Archive snapshot write failed");inserted+=Number(data??0);continue;
    }
    let stored = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await db.rpc("library_snapshot_context", { p_snapshot: row as Json });
      if (error) throw new Error("Library context lookup failed");
      const context = contextSchema.parse(data);
      const rules = { page_type: snapshot.page_type, viewport: snapshot.viewport, source: snapshot.source, sector: context.sector, new_surface: context.new_surface, first_captured_at: context.first_captured_at, captured_at: snapshot.captured_at };
      const changes = advance(context.baseline as Baseline | null, (context.baseline?.pending ?? {}) as Pending, { signals: snapshot.signals, snapshot_id: null, captured_at: snapshot.captured_at, context: rules });
      changes.events.push(...diffLibrarySignals(null, snapshot.signals, rules));
      const { data: result, error: storeError } = await db.rpc("library_store_snapshot", { p_snapshot: row as Json, p_context: data as Json, p_events: changes as unknown as Json });
      if (storeError) throw new Error("Library snapshot write failed");
      const outcome = resultSchema.parse(result);
      if (outcome.retry) continue;
      inserted += outcome.inserted ?? 0;
      events += outcome.events ?? 0;
      stored = true;
      break;
    }
    if (!stored) throw new Error("Library snapshot contention");
  }
  // D1 Part 2 · archive replays run in the follow-up worker (crawl-ingest marks each brand), never inside the crawler's request.
  // No history refresh here: the insert triggers mark the domain dirty (library_history_dirty_domains) and the scheduled
  // library-history-refresh job replaces its stored rows, so a stored batch always answers with its counts.
  return Response.json({ ok: true, inserted, events });
}
/** R2a · rows whose category or sub-category is null get them from the sync payload (when valid) or the category map, by domain. */
async function fillCategories(db: { from: (t: "library_sites") => any }, sites: readonly { domain: string; category?: string | undefined; subcategory?: string | undefined }[]) {
  const { fillClassification } = await import("./categories");
  const want = new Map(sites.map(s => [s.domain, s]));
  for (let i = 0; i < sites.length; i += 200) {
    const { data } = await db.from("library_sites").select("domain,sector,category,subcategory").in("domain", sites.slice(i, i + 200).map(s => s.domain)).or("category.is.null,subcategory.is.null");
    for (const r of (data ?? []) as { domain: string; sector: string; category: string | null; subcategory: string | null }[]) {
      const p = want.get(r.domain), fill = fillClassification(r, p ? { ...(p.category ? { category: p.category } : {}), ...(p.subcategory ? { subcategory: p.subcategory } : {}) } : undefined);
      if (fill) await db.from("library_sites").update(fill).eq("domain", r.domain).or("category.is.null,subcategory.is.null");
    }
  }
}

/** R2a-2 · the store behind splitSync: paged reads (200 domains, 1,000-row pages), the RPC unchanged. */
function syncStore(): import("./library-sync").SyncStore {
  const fail = (m: string) => { throw new Error(m); };
  return {
    async read(domains) { const { data, error } = await db.from("library_sites").select("domain,sector,active,onboarding,panel_since").in("domain", [...domains]).range(0, 999); if (error) fail("Library site read failed"); return data ?? []; },
    async onboardingDomains() {
      const out: string[] = [];
      for (let from = 0; ; from += 1000) { const { data, error } = await db.from("library_sites").select("domain").eq("onboarding", true).order("domain").range(from, from + 999); if (error) fail("Onboarding read failed"); out.push(...(data ?? []).map(r => r.domain)); if ((data ?? []).length < 1000) return out; }
    },
    async activeDomains() {
      const out: string[] = [];
      for (let from = 0; ; from += 1000) { const { data, error } = await db.from("library_sites").select("domain").eq("active", true).order("domain").range(from, from + 999); if (error) fail("Active read failed"); out.push(...(data ?? []).map(r => r.domain)); if (!data || data.length < 1000) break; }
      return out;
    },
    async insertOnboarding(rows) { for (let i = 0; i < rows.length; i += 200) { const { error } = await db.from("library_sites").insert(rows.slice(i, i + 200).map(r => ({ ...r }))); if (error) fail("Onboarding insert failed"); } },
    async updateOnboarding(domain, patch) { const { error } = await db.from("library_sites").update(patch).eq("domain", domain).is("panel_since", null); if (error) fail("Onboarding update failed"); },
    async clearOnboarding(domains) { for (let i = 0; i < domains.length; i += 200) { const { error } = await db.from("library_sites").update({ onboarding: false }).in("domain", domains.slice(i, i + 200)).eq("onboarding", true); if (error) fail("Onboarding clear failed"); } },
    async rpcSync(sites) { const { error } = await db.rpc("library_sync", { p_sites: sites as never }); if (error) fail("Library sync failed"); },
  };
}
