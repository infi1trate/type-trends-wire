import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { replayLibrary, type ReplaySnapshot } from "./library-replay";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
const rowsSchema=z.array(z.object({id:z.number(),domain:z.string(),sector:z.string(),page_type:z.string(),viewport:z.string(),source:z.literal("wayback"),captured_at:z.string(),signals:z.record(z.string(),z.unknown())}));
export async function replayArchive(domain:string) {
 for(let attempt=0;attempt<3;attempt++){
  const {data,error}=await db.rpc("library_archive_input",{p_domain:domain});if(error)throw new Error("Archive replay read failed");
  const rows:ReplaySnapshot[]=rowsSchema.parse(data);const history=replayLibrary(rows);
  // D1 Part 3 · writes only the archive events and baselines that differ (the old function deleted and re-inserted them all).
  const result=await db.rpc("library_archive_replace_changed",{p_domain:domain,p_expected:data as Json,p_history:history as unknown as Json});
  if(result.error)throw new Error("Archive replay write failed");if((result.data as {ok?:boolean}|null)?.ok)return history.events.length;
 }
 throw new Error("Archive replay contention");
}