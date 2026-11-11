import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { replayLibrary, type ReplaySnapshot } from "./library-replay";
import type { Json } from "@/integrations/supabase/types";
export async function rebuildLibraryHistory() {
  const { data, error } = await db.rpc("library_replay_input");
  if (error) throw new Error("Replay input failed");
  const rows = data as unknown as ReplaySnapshot[];
  const replay = replayLibrary(rows);
  const { data: result, error: writeError } = await db.rpc("library_replace_history", { p_ids: rows.map(r => r.id), p_history: replay as unknown as Json });
  if (writeError) throw new Error("Replay changed concurrently or could not be stored");
  return Response.json(result);
}