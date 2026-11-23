import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
export const Route=createFileRoute("/api/public/library-ai-worker")({server:{handlers:{POST:async({request})=>{
 const denied=await authenticateCronRequest(request);if(denied)return denied;
 if(await request.text()!=="{}")return Response.json({ok:false,code:"invalid_input"},{status:400});
 // D1 Part 4 · a slow database: stand down at once ("skipped: database slow").
 const gate=await import("@/lib/jobs/gate.server");const why=await gate.standDown("ai-worker");if(why)return gate.stoodDown(why);
 const start=Date.now();
 const jr=await (await import("@/lib/jobs/runs.server")).startRun("ai-worker");
 try{const {runAiWorker}=await import("@/lib/ai-worker.server");const result=await runAiWorker();
  // I3b: new section crops the intake had no time to measure (at most CROP_SWEEP_MS, only while the call is young); never fails the worker.
  const crops=Date.now()-start<40_000?await import("@/lib/crop-measure.server").then(m=>m.measurePendingCrops()).catch(()=>null):null;
  // W1b: icons and cards without a colour grid (perceptual comparison), same rule.
  const assets=Date.now()-start<44_000?await import("@/lib/asset-changes.server").then(m=>m.measurePendingAssets()).catch(()=>null):null;
  // The same five-minute call carries one queued follow-up step (the weekly forecast's brief, chart, ledger, story build) when it has time left.
  const {advanceFollowUps,forecastRunners}=await import("@/lib/jobs/steps.server");const follow_up=await advanceFollowUps(start,{forecast:forecastRunners});
  const processed=(result as {processed?:unknown}).processed;
  await jr.finish(true,`${typeof processed==="number"?`${processed} processed`:"ok"}${follow_up&&"step" in follow_up?` · step ${follow_up.step} ${follow_up.status}`:""}`);
  return Response.json({...result,crops,assets,follow_up});}catch{await jr.finish(false,"worker failed");return Response.json({ok:false,code:"worker_failed"},{status:500});}
}}}});