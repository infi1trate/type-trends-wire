import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { advance, type Baseline, type Pending } from "./library-diff";
import { pricingSchema, tagsSchema, type ExtractionKind } from "./ai-schema";
import { replayArchive } from "./library-archive.server";
export async function storeAiResult(snapshot: { id: number; domain: string; page_type: string; viewport: string; captured_at: string; source?: string }, kind: "vision" | ExtractionKind, model: string, data: Json) {
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
  if(stored.data) {if(snapshot.source==="wayback")await replayArchive(snapshot.domain);return;} // history: the library_tags trigger marks it dirty; refreshLibraryHistory picks it up (never inline)
 }
 throw new Error("AI confirmation contention");
}