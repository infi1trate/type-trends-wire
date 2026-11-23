import { structuredAttempts } from './ai-retries';
import { z } from "zod";
import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { inferAI, AiFailure } from "./ai-inference.server";
import { storeAiResult } from "./ai-store.server";
import { extractionSchemas, normalizeExtraction } from "./ai-schema";
import { AI_LIMITS } from "./ai-models";
import { probeStep, type ProbeControl, type ProbeDeps, type ProbeOutcome, type ProbeResult } from "./ai-probe";
export const WORKER_TIME = {claimMs:50000, inferenceMs:57000, runMs:60000} as const;
export function workerCanClaim(start:number,now:number,claimed:number,cap:number){return now-start<WORKER_TIME.claimMs && claimed<cap;}
export function textRetryable(code:string,attempts:number){return ['unknown_outcome','usage_unknown','run_deadline'].includes(code)&&attempts<3;}
const jobSchema=z.object({id:z.number(),snapshot_id:z.number(),kind:z.enum(['pricing','changelog','product']),attempts:z.number(),validation_failures:z.number(),validation_error:z.string().nullable()});
const check=async(result:{error:unknown})=>{if(result.error)throw new Error('AI progress write failed');};
/** A probe claims at most this many jobs looking for one that needs the model (jobs without text or with a reusable extraction need none). */
const PROBE_MAX_JOBS=10;

/**
 * One scheduled call. While the worker is paused for credits or a rate limit, it first tries one probe job at most once an hour
 * (ai-probe.ts); a probe that reaches the model clears the pause and the same call carries on with the queue.
 */
export async function runAiWorker() {
 const start=Date.now();
 const probe=await probeStep(probeDeps(start),start,crypto.randomUUID()).catch(():ProbeResult=>({state:"busy"}));
 if(probe.state==="waiting"||probe.state==="busy"||(probe.state==="probed"&&!probe.ok))return {ok:true,processed:0,paused_or_busy:true,probe};
 const result=await runQueue(start);
 return probe.state==="probed"?{...result,probe}:result;
}

function probeDeps(start:number):ProbeDeps{
 return {
  control:async()=>{const {data,error}=await db.from('library_ai_control').select('paused,reason,paused_at,probed_at').eq('name','text').maybeSingle();if(error)throw new Error('AI control read failed');return (data as ProbeControl|null)??null;},
  acquire:async token=>{const {data,error}=await db.rpc('library_ai_probe_acquire',{p_token:token});if(error)throw new Error('AI probe lease failed');return (data as {ok?:boolean}|null)?.ok===true;},
  runOne:token=>probeOne(start,token),
  settle:async(token,ok,reason)=>{const {error}=await db.rpc('library_ai_probe_settle',{p_token:token,p_ok:ok,p_reason:reason as string});if(error)throw new Error('AI probe settle failed');},
 };
}

type Job=z.infer<typeof jobSchema>;
type JobOutcome={done:boolean;called:boolean;failure:AiFailure|null};
/** Process one claimed job. In probe mode the model is called at most once and the control row is never touched (the probe settles it). */
async function processJob(job:Job,token:string,signal:AbortSignal,probe:boolean):Promise<JobOutcome>{
 let called=false;
 try{
  const {data:s,error}=await db.from('library_snapshots').select('id,domain,page_type,viewport,captured_at,content_hash').eq('id',job.snapshot_id).single();if(error)throw new Error('Snapshot lookup failed');
  const {data:text,error:te}=await db.from('library_snapshot_text').select('raw_text').eq('snapshot_id',s.id).maybeSingle();if(te)throw new Error('Text lookup failed');
  if(!text?.raw_text){await check(await db.from('library_ai_jobs').update({status:'skipped',done_at:new Date().toISOString(),error:'no_text'}).eq('id',job.id).eq('lease_token',token));return {done:false,called,failure:null};}
  const {data:existing,error:ee}=await db.from('library_extractions').select('model,data').eq('snapshot_id',s.id).maybeSingle();if(ee)throw new Error('Extraction lookup failed');
  let reused: {model:string;data:unknown}|null=existing&&extractionSchemas[job.kind].safeParse(existing.data).success?existing:null;
  if(!reused&&s.content_hash){const {data:prev}=await db.from('library_snapshots').select('id,content_hash').eq('domain',s.domain).eq('page_type',s.page_type).eq('viewport',s.viewport).eq('source','live').lt('captured_at',s.captured_at).order('captured_at',{ascending:false}).limit(1).maybeSingle();if(prev?.content_hash===s.content_hash){const {data:e}=await db.from('library_extractions').select('model,data').eq('snapshot_id',prev.id).maybeSingle();if(e&&extractionSchemas[job.kind].safeParse(e.data).success)reused=e;}}
  let failures=job.validation_failures,validationError=job.validation_error;
  const extract=async()=>{
   for(;;){
    if(signal.aborted)throw new AiFailure('run_deadline');
    try{called=true;return await inferAI({snapshot_id:s.id,kind:job.kind,context:text.raw_text.slice(0,AI_LIMITS.textChars),captured_at:s.captured_at,signal,...(validationError?{validationError}:{})});}
    catch(error){if(!(error instanceof AiFailure)||error.code!=='invalid_structured_output')throw error;
     failures++;validationError=error.validation??'Missing emit_result or invalid schema';
     await check(await db.from('library_ai_jobs').update({validation_failures:failures,validation_error:validationError}).eq('id',job.id).eq('lease_token',token));
     // A probe makes one call: the model answered, so the job goes back to the queue for its correction retry.
     if(probe&&failures<structuredAttempts(job.kind)){await check(await db.from('library_ai_jobs').update({claimed_at:null,lease_token:null}).eq('id',job.id).eq('lease_token',token));return null;}
     if(failures>=structuredAttempts(job.kind))throw error;
    }
   }
  };
  const result=reused?{model:reused.model,data:normalizeExtraction(job.kind,reused.data,s.captured_at)}:await extract();
  if(!result)return {done:false,called,failure:null};
  await storeAiResult(s,job.kind,result.model,result.data);
  const done=await db.rpc('library_ai_complete',{p_job:job.id,p_token:token,p_snapshot:s.id,p_domain:s.domain,p_kind:job.kind,p_model:result.model,p_data:result.data});if(done.error||!done.data)throw new Error('Job completion failed');
  if(!probe)await check(await db.from('library_ai_control').update({rate_limits:0}).eq('name','text').eq('lease_token',token));
  return {done:true,called,failure:null};
 }catch(error){
  const failure=error instanceof AiFailure?error:new AiFailure('job_failed');
  if(['unknown_outcome','usage_unknown','run_deadline'].includes(failure.code)){
   const retry=await db.rpc('library_ai_worker_retry',{p_job:job.id,p_token:token,p_code:failure.code});if(retry.error||!retry.data)throw new Error('Retry settlement failed');return {done:false,called,failure};
  }
  if(['budget_exhausted','already_claimed'].includes(failure.code)){await check(await db.from('library_ai_jobs').update({claimed_at:null,lease_token:null,error:failure.code}).eq('id',job.id).eq('lease_token',token));return {done:false,called,failure};}
  await check(await db.from('library_ai_jobs').update({status:'error',done_at:new Date().toISOString(),error:failure.code}).eq('id',job.id).eq('lease_token',token));
  if(!probe&&(failure.pause||failure.code==='rate_limited'))await check(await db.from('library_ai_control').update({paused:true,reason:failure.code,paused_at:new Date().toISOString()}).eq('name','text').eq('lease_token',token));
  return {done:false,called,failure};
 }
}

/** The probe: claim jobs one at a time until one needs the model, then make that single call. */
async function probeOne(start:number,token:string):Promise<ProbeOutcome>{
 const signal=AbortSignal.timeout(Math.max(1000,WORKER_TIME.inferenceMs-(Date.now()-start)));
 for(let claimed=0;workerCanClaim(start,Date.now(),claimed,PROBE_MAX_JOBS);claimed++){
  const next=await db.rpc('library_ai_worker_next',{p_token:token});if(next.error)throw new Error('AI job claim failed');if(!next.data)return {called:false,ok:false,code:'no_job'};
  const r=await processJob(jobSchema.parse(next.data),token,signal,true);
  if(r.called)return {called:true,ok:!r.failure,code:r.failure?.code??null};
  if(r.failure)return {called:false,ok:false,code:r.failure.code};
 }
 return {called:false,ok:false,code:'no_model_job'};
}

async function runQueue(start:number) {
 const token=crypto.randomUUID();
 const claim=await db.rpc('library_ai_worker_acquire',{p_token:token});if(claim.error)throw new Error('AI lease acquisition failed');
 const acquired=z.object({ok:z.boolean(),cap:z.number().int().min(0).max(25)}).parse(claim.data);
 if(!acquired.ok)return {ok:true,processed:0,paused_or_busy:true};
 let processed=0,claimed=0,stopped=false;
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),WORKER_TIME.inferenceMs-Math.min(Date.now()-start,WORKER_TIME.inferenceMs));
 async function lane(){
  while(!stopped&&workerCanClaim(start,Date.now(),claimed,acquired.cap)){
   // Increment synchronously before awaiting so three lanes cannot exceed the cap.
   claimed++;
   const next=await db.rpc('library_ai_worker_next',{p_token:token});if(next.error)throw new Error('AI job claim failed');if(!next.data)return;
   const r=await processJob(jobSchema.parse(next.data),token,controller.signal,false);
   if(r.done)processed++;
   const f=r.failure;
   if(f&&(['unknown_outcome','usage_unknown','run_deadline','budget_exhausted','already_claimed'].includes(f.code)||f.pause||f.code==='rate_limited'))stopped=true;
  }
 }
 try{const results=await Promise.allSettled(Array.from({length:AI_LIMITS.concurrency},()=>lane()));const failed=results.find(r=>r.status==='rejected');if(failed?.status==='rejected')throw failed.reason;}
 finally{clearTimeout(timer);const released=await db.rpc('library_ai_release',{p_token:token});if(released.error)throw new Error('AI lease release failed');}
 return {ok:true,processed,claimed,elapsed_ms:Date.now()-start};
}
