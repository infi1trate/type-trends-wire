import { defineTool } from "@lovable.dev/mcp-js";
import { historyInput } from "@/lib/library-history";
import { libraryHistory } from "@/lib/library-history.server";
import { json, READ } from "./shared";
export default defineTool({name:"library_history",title:"Library quarterly history",description:"Read quarterly public design shares with capture denominators and coverage.",inputSchema:historyInput.shape,annotations:READ,handler:async input=>json({rows:await libraryHistory(input),receipts:{source:"DSGN Library live + Internet Archive",method:"trend://methodology"}})});
