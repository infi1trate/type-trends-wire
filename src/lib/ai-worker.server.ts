import { z } from "zod";
import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { inferAI, AiFailure } from "./ai-inference.server";
import { storeAiResult } from "./ai-store.server";
import { extractionSchemas, normalizeExtraction } from "./ai-schema";
import { AI_LIMITS } from "./ai-models";
export const WORKER_TIME = {claimMs:50000, inferenceMs:57000, runMs:60000} as const;
export function workerCanClaim(start:number,now:number,claimed:number,cap:number){return now-start<WORKER_TIME.claimMs && claimed<cap;}
export function textRetryable(code:string,attempts:number){return ['unknown_outcome','usage_unknown','run_deadline'].includes(code)&&attempts<3;}
const jobSchema=z.object({id:z.number(),snapshot_id:z.number(),kind:z.enum(['pricing','changelog','product']),attempts:z.number(),validation_failures:z.number(),validation_error:z.string().nullable()});
export async function runAiWorker() {
 const start=Date.now(),token=crypto.randomUUID();
 const claim=await db.rpc('library_ai_worker_acquire',{p_token:token});if(claim.error)throw new Error('AI lease acquisition failed');
 const acquired=z.object({ok:z.boolean(),cap:z.number().int().min(0).max(25)}).parse(claim.data);
 if(!acquired.ok)return {ok:true,processed:0,paused_or_busy:true};
 let processed=0,claimed=0,stopped=false;
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),WORKER_TIME.inferenceMs-Math.min(Date.now()-start,WORKER_TIME.inferenceMs));
 const check=async(result:{error:unknown})=>{if(result.error)throw new Error('AI progress write failed');};
 async function lane(){
  while(!stopped&&workerCanClaim(start,Date.now(),claimed,acquired.cap)){
   // Increment synchronously before awaiting so three lanes cannot exceed the cap.
   claimed++;
   const next=await db.rpc('library_ai_worker_next',{p_token:token});if(next.error)throw new Error('AI job claim failed');if(!next.data)return;
   const job=jobSchema.parse(next.data);
   try{
    const {data:s,error}=await db.from('library_snapshots').select('id,domain,page_type,viewport,captured_at,content_hash').eq('id',job.snapshot_id).single();if(error)throw new Error('Snapshot lookup failed');
    const {data:text,error:te}=await db.from('library_snapshot_text').select('raw_text').eq('snapshot_id',s.id).maybeSingle();if(te)throw new Error('Text lookup failed');
    if(!text?.raw_text){await check(await db.from('library_ai_jobs').update({status:'skipped',done_at:new Date().toISOString(),error:'no_text'}).eq('id',job.id).eq('lease_token',token));continue;}
    const {data:existing,error:ee}=await db.from('library_extractions').select('model,data').eq('snapshot_id',s.id).maybeSingle();if(ee)throw new Error('Extraction lookup failed');
    let reused: {model:string;data:unknown}|null=existing&&extractionSchemas[job.kind].safeParse(existing.data).success?existing:null;
    if(!reused&&s.content_hash){const {data:prev}=await db.from('library_snapshots').select('id,content_hash').eq('domain',s.domain).eq('page_type',s.page_type).eq('viewport',s.viewport).eq('source','live').lt('captured_at',s.captured_at).order('captured_at',{ascending:false}).limit(1).maybeSingle();if(prev?.content_hash===s.content_hash){const {data:e}=await db.from('library_extractions').select('model,data').eq('snapshot_id',prev.id).maybeSingle();if(e&&extractionSchemas[job.kind].safeParse(e.data).success)reused=e;}}
    let failures=job.validation_failures,validationError=job.validation_error;
    const extract=async()=>{
     for(;;){
      if(controller.signal.aborted)throw new AiFailure('run_deadline');
      try{return await inferAI({snapshot_id:s.id,kind:job.kind,context:text.raw_text.slice(0,AI_LIMITS.textChars),captured_at:s.captured_at,signal:controller.signal,...(validationError?{validationError}:{})});}
      catch(error){if(!(error instanceof AiFailure)||error.code!=='invalid_structured_output')throw error;
       failures++;validationError=error.validation??'Missing emit_result or invalid schema';
       await check(await db.from('library_ai_jobs').update({validation_failures:failures,validation_error:validationError}).eq('id',job.id).eq('lease_token',token));
       if(failures>=2)throw error;
      }
     }
    };
    const result=reused?{model:reused.model,data:normalizeExtraction(job.kind,reused.data,s.captured_at)}:await extract();
    await storeAiResult(s,job.kind,result.model,result.data);
    const done=await db.rpc('library_ai_complete',{p_job:job.id,p_token:token,p_snapshot:s.id,p_domain:s.domain,p_kind:job.kind,p_model:result.model,p_data:result.data});if(done.error||!done.data)throw new Error('Job completion failed');processed++;
    await check(await db.from('library_ai_control').update({rate_limits:0}).eq('name','text').eq('lease_token',token));
   }catch(error){
    const failure=error instanceof AiFailure?error:new AiFailure('job_failed');
    if(['unknown_outcome','usage_unknown','run_deadline'].includes(failure.code)){
     const retry=await db.rpc('library_ai_worker_retry',{p_job:job.id,p_token:token,p_code:failure.code});if(retry.error||!retry.data)throw new Error('Retry settlement failed');stopped=true;continue;
    }
    if(['budget_exhausted','already_claimed'].includes(failure.code)){await check(await db.from('library_ai_jobs').update({claimed_at:null,lease_token:null,error:failure.code}).eq('id',job.id).eq('lease_token',token));stopped=true;continue;}
    await check(await db.from('library_ai_jobs').update({status:'error',done_at:new Date().toISOString(),error:failure.code}).eq('id',job.id).eq('lease_token',token));
    if(failure.pause||failure.code==='rate_limited'){stopped=true;await check(await db.from('library_ai_control').update({paused:true,reason:failure.code}).eq('name','text').eq('lease_token',token));}
   }
  }
 }
 try{const results=await Promise.allSettled(Array.from({length:AI_LIMITS.concurrency},()=>lane()));const failed=results.find(r=>r.status==='rejected');if(failed?.status==='rejected')throw failed.reason;}
 finally{clearTimeout(timer);const released=await db.rpc('library_ai_release',{p_token:token});if(released.error)throw new Error('AI lease release failed');}
 return {ok:true,processed,claimed,elapsed_ms:Date.now()-start};
}
