import {defineTool} from "@lovable.dev/mcp-js";
import {critiqueInput} from "../../taste/schema";
import {READ,surfaced} from "./shared";
export default defineTool({name:"critique",title:"Critique",description:"Evaluate a library URL, public declared CSS or transient image against design evidence; unknown URLs queue rendering.",inputSchema:critiqueInput.shape,annotations:{...READ,readOnlyHint:false,destructiveHint:false},handler:async input=>{const {critique}=await import("../../taste/tools.server");return surfaced(()=>critique(input));}});