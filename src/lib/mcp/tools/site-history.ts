import { defineTool } from "@lovable.dev/mcp-js";
import { libraryDomain } from "@/lib/library-payload";
import { siteHistory } from "@/lib/library-history.server";
import { json, READ } from "./shared";
export default defineTool({name:"site_history",title:"Site quarterly history",description:"Read public quarterly site fingerprints and AI tags, without skeletons or private text. Each trait or signal keeps its stable key and adds a plain-English label, a dimension (FONT, COLOR, LAYOUT or VIBE) and, where staged, stage_label (Emerging, Rising, Peaking, Fading or Steady).",inputSchema:{domain:libraryDomain},annotations:READ,handler:async({domain})=>json({rows:await siteHistory(domain),receipts:{source:"DSGN Library + Internet Archive",method:"trend://methodology"}})});