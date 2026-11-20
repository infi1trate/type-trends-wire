import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { advance, diffLibrarySignals, type Baseline, type Pending } from "./library-diff";
import { librarySnapshotsPayload, librarySyncPayload } from "./library-payload";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
import { replayArchive } from "./library-archive.server";

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
    const { error } = await db.rpc("library_sync", { p_sites: payload.sites });
    if (error) throw new Error("Library sync failed");
    return Response.json({ ok: true, inserted: 0, events: 0 });
  }
  let inserted = 0, events = 0;
  const archiveDomains=new Set<string>();
  // Sort archive/backfill batches so each key compares to its immediately earlier capture.
  for (const snapshot of [...payload.snapshots].sort((a, b) => Date.parse(a.captured_at) - Date.parse(b.captured_at))) {
    const row = { ...snapshot, ...(payload.run_id ? { run_id: payload.run_id } : {}) };
    if(snapshot.source==="wayback") {
      const {data,error}=await db.rpc("library_archive_store",{p_snapshot:row as Json});if(error)throw new Error("Archive snapshot write failed");inserted+=Number(data??0);archiveDomains.add(snapshot.domain);continue;
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
  for(const domain of archiveDomains)events+=await replayArchive(domain);
  // No history refresh here: the insert trigger leaves library_history_control.dirty set and refreshLibraryHistory
  // (history-refresh.server.ts) picks it up after the answer, so a stored batch always answers with its counts.
  return Response.json({ ok: true, inserted, events });
}