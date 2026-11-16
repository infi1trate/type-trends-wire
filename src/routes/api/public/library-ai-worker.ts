import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
export const Route=createFileRoute("/api/public/library-ai-worker")({server:{handlers:{POST:async({request})=>{
 const denied=await authenticateCronRequest(request);if(denied)return denied;
 if(await request.text()!=="{}")return Response.json({ok:false,code:"invalid_input"},{status:400});
 const start=Date.now();
 try{const {runAiWorker}=await import("@/lib/ai-worker.server");const result=await runAiWorker();
  // The same five-minute call carries one queued follow-up step (the weekly forecast's brief, chart, ledger, story build) when it has time left.
  const {advanceFollowUps,forecastRunners}=await import("@/lib/jobs/steps.server");const follow_up=await advanceFollowUps(start,{forecast:forecastRunners});
  return Response.json({...result,follow_up});}catch{return Response.json({ok:false,code:"worker_failed"},{status:500});}
}}}});