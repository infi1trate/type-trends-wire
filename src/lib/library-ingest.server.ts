import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { diffLibrarySignals } from "./library-diff";
import { librarySnapshotsPayload, librarySyncPayload } from "./library-payload";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";

const contextSchema = z.object({
  prev: z.object({ id: z.number(), signals: z.record(z.string(), z.json()), content_hash: z.string().nullable() }).nullable(),
  new_surface: z.boolean(),
  first_captured_at: z.string().nullable(),
});
const resultSchema = z.object({ retry: z.boolean().optional(), inserted: z.number().optional(), events: z.number().optional() });
export async function ingestLibrary(payload: z.infer<typeof librarySyncPayload> | z.infer<typeof librarySnapshotsPayload>): Promise<Response> {
  if (payload.kind === "library_sync") {
    const { error } = await db.rpc("library_sync", { p_sites: payload.sites });
    if (error) throw new Error("Library sync failed");
    return Response.json({ ok: true, inserted: 0, events: 0 });
  }
  let inserted = 0, events = 0;
  // Sort archive/backfill batches so each key compares to its immediately earlier capture.
  for (const snapshot of [...payload.snapshots].sort((a, b) => Date.parse(a.captured_at) - Date.parse(b.captured_at))) {
    const row = { ...snapshot, ...(payload.run_id ? { run_id: payload.run_id } : {}) };
    let stored = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await db.rpc("library_snapshot_context", { p_snapshot: row as Json });
      if (error) throw new Error("Library context lookup failed");
      const context = contextSchema.parse(data);
      const changes = diffLibrarySignals(context.prev?.signals ?? null, snapshot.signals, {
        page_type: snapshot.page_type, viewport: snapshot.viewport, new_surface: context.new_surface, first_captured_at: context.first_captured_at, captured_at: snapshot.captured_at,
        prev_content_hash: context.prev?.content_hash, content_hash: snapshot.content_hash,
      });
      const { data: result, error: storeError } = await db.rpc("library_store_snapshot", { p_snapshot: row as Json, p_context: data as Json, p_events: changes as Json });
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
  return Response.json({ ok: true, inserted, events });
}