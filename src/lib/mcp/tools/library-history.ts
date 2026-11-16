import { defineTool } from "@lovable.dev/mcp-js";
import { historyInput } from "@/lib/library-history";
import { libraryHistory } from "@/lib/library-history.server";
import { json, READ } from "./shared";
export default defineTool({name:"library_history",title:"Library quarterly history",description:"Read quarterly public design shares with capture denominators and coverage. Each trait or signal keeps its stable key and adds a plain-English label, a dimension (FONT, COLOR, LAYOUT or VIBE), basis (measured or ai), tier (headline, supporting or archive), momentum_index (0–100 percentile of the stored next-wave score among headline + supporting signals), confidence (High, Medium or Low, with confidence_reason) and, where staged, stage_label (Emerging, Rising, Peaking, Fading or Steady).",inputSchema:historyInput.shape,annotations:READ,handler:async input=>json({rows:await libraryHistory(input),receipts:{source:"DSGN Library live + Internet Archive",method:"trend://methodology"}})});
