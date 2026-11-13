import { defineTool } from "@lovable.dev/mcp-js";
import { historyInput } from "@/lib/library-history";
import { libraryHistory } from "@/lib/library-history.server";
import { json, READ } from "./shared";
export default defineTool({name:"library_history",title:"Library design history",description:"Read public half-year design, CSS, font and AI-tag series with coverage; never returns private text or images.",inputSchema:historyInput.shape,annotations:READ,handler:async input=>{
 const data=await libraryHistory(input);
 const metric=input.metric;
 const rows=metric?data.signals.map(r=>({bucket:r.bucket,sector:r.sector,metric,value:r[metric],sites:r.sites,coverage:r.coverage,low_coverage:r.low_coverage})):input.dimension==="css"?data.css:input.dimension==="fonts"?data.fonts:input.dimension?data.tags:data;
 return json({rows,receipts:{source:"DSGN Library live + Wayback",method:"trend://methodology"}});
}});