import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { librarySector } from "@/lib/library-payload";
import { aiTrends } from "@/lib/ai-public-store.server";
import { json, READ } from "./shared";
export default defineTool({name:"library_trends",title:"AI-derived Library trends",description:"Read public design tag shares and pricing, changelog or product-theme statistics, overall or by sector; no private page text or images.",inputSchema:{dimension:z.enum(["imagery","aesthetic","components","hero_layout","ai_positioning","tone","color_mood","pricing","changelog","features"]).optional(),sector:librarySector.optional()},annotations:READ,handler:async input=>{
 const data=await aiTrends({dimension:input.dimension,sector:input.sector??"all"});
 const rows=input.dimension==="pricing"?data.pricing:input.dimension==="changelog"?data.changelog:input.dimension==="features"?data.features:data.tags;
 return json({derived:"AI",dimension:input.dimension??"tags",sector:input.sector??"all",rows,receipts:{source:"DSGN Library AI extraction",method:"trend://methodology"}});
}});