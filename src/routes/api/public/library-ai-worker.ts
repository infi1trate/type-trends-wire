import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
export const Route=createFileRoute("/api/public/library-ai-worker")({server:{handlers:{POST:async({request})=>{
 const denied=await authenticateCronRequest(request);if(denied)return denied;
 if(await request.text()!=="{}")return Response.json({ok:false,code:"invalid_input"},{status:400});
 try{const {runAiWorker}=await import("@/lib/ai-worker.server");return Response.json(await runAiWorker());}catch{return Response.json({ok:false,code:"worker_failed"},{status:500});}
}}}});