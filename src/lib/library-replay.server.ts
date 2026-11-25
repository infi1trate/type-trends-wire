import { pagedRows } from "./paged";
import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { replayLibrary, type ReplaySnapshot } from "./library-replay";
import type { Json } from "@/integrations/supabase/types";
export async function rebuildLibraryHistory() {
  const { data: sites, error: siteError } = await pagedRows((f, t) => db.from("library_sites").select("domain,sector").order("domain").range(f, t));
  if (siteError) throw new Error("Replay sites failed");
  const sectors = new Map((sites ?? []).map(s => [s.domain, s.sector]));
  const rows: ReplaySnapshot[] = [];
  // Small pages avoid constructing a full raw-signal JSON aggregate in PostgreSQL.
  for (let from = 0; ; from += 50) {
    const { data, error } = await db.from("library_snapshots").select("id,domain,page_type,viewport,source,captured_at,signals").order("id").range(from, from + 49);
    if (error) throw new Error("Replay snapshots failed");
    rows.push(...(data ?? []).map(r => ({ ...r, sector: sectors.get(r.domain) ?? "", signals: r.signals as Record<string, unknown> })));
    if (!data || data.length < 50) break;
  }
  const replay = replayLibrary(rows);
  const { data: result, error: writeError } = await db.rpc("library_replace_history", { p_ids: rows.map(r => r.id), p_history: replay as unknown as Json });
  if (writeError) { console.error("Library replay database error", writeError.code, writeError.message); throw new Error("Replay changed concurrently or could not be stored"); }
  return Response.json(result);
}