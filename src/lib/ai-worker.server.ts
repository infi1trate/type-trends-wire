import { z } from "zod";
import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { inferAI, AiFailure } from "./ai-inference.server";
import { storeAiResult } from "./ai-store.server";
import { extractionSchemas, normalizeExtraction } from "./ai-schema";
import { AI_LIMITS } from "./ai-models";
const claimSchema=z.object({ok:z.boolean(),jobs:z.array(z.object({id:z.number(),snapshot_id:z.number(),kind:z.enum(["pricing","changelog","product"])})).max(10)});
export async function runAiWorker() {
 const token=crypto.randomUUID();const claim=await db.rpc("library_ai_claim",{p_token:token});if(claim.error)throw new Error("AI job claim failed");
 const {ok,jobs}=claimSchema.parse(claim.data);if(!ok)return {ok:true,processed:0,paused_or_busy:true};
 let processed=0;
 try {
  // Ordered processing also avoids treating same-key captures out of order; one is within the <=3 cap.
  for(const job of jobs) {
   const {data:control,error:controlError}=await db.from("library_ai_control").select("paused,lease_token,lease_until").eq("name","text").single();
   if(controlError||control.paused||control.lease_token!==token||Date.parse(control.lease_until ?? "")<Date.now()) {await db.from("library_ai_jobs").update({claimed_at:null,lease_token:null}).eq("lease_token",token).eq("status","pending");break;}
   try {
    const {data:s,error}=await db.from("library_snapshots").select("id,domain,page_type,viewport,captured_at,content_hash").eq("id",job.snapshot_id).single();if(error)throw new Error("AI snapshot lookup failed");
    const {data:text,error:textError}=await db.from("library_snapshot_text").select("raw_text").eq("snapshot_id",s.id).maybeSingle();if(textError)throw new Error("Private text lookup failed");
    if(!text?.raw_text){await db.from("library_ai_jobs").update({status:"skipped",done_at:new Date().toISOString(),error:"no_text"}).eq("id",job.id);continue;}
    const {data:existing,error:existingError}=await db.from("library_extractions").select("model,data").eq("snapshot_id",s.id).maybeSingle();
    if(existingError)throw new Error("Existing extraction lookup failed");
    let reused: {model:string;data:unknown}|null=existing&&extractionSchemas[job.kind].safeParse(existing.data).success?existing:null;
    if(!reused&&s.content_hash) {
     const {data:prev}=await db.from("library_snapshots").select("id,content_hash").eq("domain",s.domain).eq("page_type",s.page_type).eq("viewport",s.viewport).eq("source","live").lt("captured_at",s.captured_at).order("captured_at",{ascending:false}).limit(1).maybeSingle();
     if(prev?.content_hash===s.content_hash){const {data:e}=await db.from("library_extractions").select("model,data").eq("snapshot_id",prev.id).maybeSingle();if(e&&extractionSchemas[job.kind].safeParse(e.data).success)reused=e;}
    }
    const result=reused?{model:reused.model,data:normalizeExtraction(job.kind,reused.data,s.captured_at)}:await inferAI({snapshot_id:s.id,kind:job.kind,context:text.raw_text.slice(0,AI_LIMITS.textChars),captured_at:s.captured_at});
    await storeAiResult(s,job.kind,result.model,result.data);
    const done=await db.rpc("library_ai_complete",{p_job:job.id,p_token:token,p_snapshot:s.id,p_domain:s.domain,p_kind:job.kind,p_model:result.model,p_data:result.data});if(done.error||!done.data)throw new Error("AI job completion failed");processed++;
    await db.from("library_ai_control").update({rate_limits:0}).eq("name","text").eq("lease_token",token);
   } catch(error) {
    const failure=error instanceof AiFailure?error:new AiFailure("job_failed");
    if(failure.code==="budget_exhausted"||failure.code==="already_claimed") {
     await db.from("library_ai_jobs").update({claimed_at:null,lease_token:null,error:failure.code}).eq("lease_token",token).eq("status","pending");break;
    }
    await db.from("library_ai_jobs").update({status:"error",done_at:new Date().toISOString(),error:failure.code}).eq("id",job.id);
    const {data:current}=await db.from("library_ai_control").select("rate_limits").eq("name","text").single();const rates=failure.code==="rate_limited"?(current?.rate_limits??0)+1:current?.rate_limits??0;
    if(failure.pause||rates>=2){await db.from("library_ai_control").update({paused:true,reason:failure.code,rate_limits:rates}).eq("name","text");await db.from("library_ai_jobs").update({claimed_at:null,lease_token:null}).eq("lease_token",token).eq("status","pending");break;}
    if(failure.code==="rate_limited"){await db.from("library_ai_control").update({rate_limits:rates}).eq("name","text");await db.from("library_ai_jobs").update({claimed_at:null,lease_token:null}).eq("lease_token",token).eq("status","pending");break;}
   }
  }
 }finally{const released=await db.rpc("library_ai_release",{p_token:token});if(released.error)throw new Error("AI lease release failed");}
 return {ok:true,processed};
}