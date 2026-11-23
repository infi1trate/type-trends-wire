import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { advance, type Baseline, type Pending } from "./library-diff";
import { pricingSchema, tagsSchema, type ExtractionKind } from "./ai-schema";
import { replayArchive } from "./library-archive.server";
export async function storeAiResult(snapshot: { id: number; domain: string; page_type: string; viewport: string; captured_at: string; source?: string }, kind: "vision" | ExtractionKind, model: string, data: Json, readVersion: string | null = null) {
 const baselineKind = snapshot.source === "wayback" ? `${kind}:wayback` : kind;
 for (let attempt=0;attempt<3;attempt++) {
  const { data: current, error } = await db.from("library_ai_baselines").select("*").eq("domain",snapshot.domain).eq("page_type",snapshot.page_type).eq("viewport",snapshot.viewport).eq("kind",baselineKind).maybeSingle();
  if(error) throw new Error("AI confirmation lookup failed");
  const baseline: Baseline | null = current ? { signals: current.signals as Baseline["signals"], snapshot_id: current.snapshot_id, confirmed_at: current.confirmed_at } : null;
  let signals: Record<string, unknown> = {};
  if(kind==="vision") signals={ai_tags:tagsSchema.parse(data)};
  if(kind==="pricing") { const p=pricingSchema.parse(data);signals={ai_pricing:{cheapest_paid_monthly:p.cheapest_paid_monthly,plans:p.plans.map(p=>p.name.trim().toLowerCase()).sort()}}; }
  const state=advance(baseline,(current?.pending ?? {}) as Pending,{signals,snapshot_id:snapshot.id,captured_at:snapshot.captured_at,context:{page_type:snapshot.page_type,viewport:snapshot.viewport,source:snapshot.source??"live"}});
  if(snapshot.source==="wayback")state.events=[];
  const stored=await db.rpc("library_ai_store",{p_snapshot:snapshot.id,p_kind:kind,p_model:model,p_data:data,p_expected:current as Json,p_state:state as unknown as Json});
  if(stored.error) throw new Error("AI result write failed");
  // I3b: stamp the stored vision read with how it was made (read-version.ts); a failed stamp leaves it null and the read stands.
  if(stored.data && kind==="vision" && readVersion) { const {error:stampError}=await db.from("library_tags").update({read_version:readVersion}).eq("snapshot_id",snapshot.id); if(stampError) console.warn("read version stamp failed"); }
  if(stored.data) {if(snapshot.source==="wayback")await replayArchive(snapshot.domain);return;} // history: the library_tags trigger marks the domain dirty; the scheduled history job replaces its rows
 }
 throw new Error("AI confirmation contention");
}
/** T2 · store a carried vision reading for `snapshot` without advancing the AI confirmation: the baseline and its pending changes are
 *  written back unchanged and no event is made, so a carried reading can never be the second sighting that confirms a change. The tags
 *  row is marked `carried_from` (the date of the fresh read the chain began with) and keeps that read's version stamp. Returns false
 *  (and stores nothing) when the domain has no AI baseline yet, so the caller reads fresh instead. */
export async function storeCarriedVision(snapshot: { id: number; domain: string; page_type: string; viewport: string; captured_at: string; source?: string }, model: string, data: Json, carriedFrom: string, readVersion: string | null): Promise<boolean> {
 if (snapshot.source === "wayback") return false;
 for (let attempt=0;attempt<3;attempt++) {
  const { data: current, error } = await db.from("library_ai_baselines").select("*").eq("domain",snapshot.domain).eq("page_type",snapshot.page_type).eq("viewport",snapshot.viewport).eq("kind","vision").maybeSingle();
  if(error) throw new Error("AI confirmation lookup failed");
  if(!current) return false;
  const state={baseline:{signals:current.signals,snapshot_id:current.snapshot_id,confirmed_at:current.confirmed_at},pending:current.pending ?? {},events:[]};
  const stored=await db.rpc("library_ai_store",{p_snapshot:snapshot.id,p_kind:"vision",p_model:model,p_data:data,p_expected:current as Json,p_state:state as unknown as Json});
  if(stored.error) throw new Error("AI result write failed");
  if(stored.data) {
   const {error:markError}=await db.from("library_tags").update({carried_from:carriedFrom,...(readVersion?{read_version:readVersion}:{})} as never).eq("snapshot_id",snapshot.id);
   if(markError) throw new Error("carried mark failed");
   return true;
  }
 }
 throw new Error("AI confirmation contention");
}
