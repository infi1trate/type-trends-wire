import {defineTool} from "@lovable.dev/mcp-js";
import {typeInput} from "../../taste/schema";
import {json,READ} from "./shared";
export default defineTool({name:"recommend_type",title:"Recommend type",description:"Rank real fonts and pairings with consensus bias, measured adoption and receipts.",inputSchema:typeInput.shape,annotations:READ,handler:async input=>{const {recommendType}=await import("../../taste/tools.server");return json(await recommendType(input));}});