import {defineTool} from "@lovable.dev/mcp-js";
import {diffInput} from "../../taste/schema";
import {READ,surfaced} from "./shared";
export default defineTool({name:"differentiate",title:"Differentiate",description:"Find convergence and leader-led open territory in a sector or up to five URLs; unknown URLs queue rendering.",inputSchema:diffInput.shape,annotations:{...READ,readOnlyHint:false,destructiveHint:false},handler:async input=>{const {differentiate}=await import("../../taste/tools.server");return surfaced(()=>differentiate(input));}});