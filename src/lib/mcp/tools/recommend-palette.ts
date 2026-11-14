import {defineTool} from "@lovable.dev/mcp-js";
import {paletteInput} from "../../taste/schema";
import {READ,surfaced} from "./shared";
export default defineTool({name:"recommend_palette",title:"Recommend palette",description:"Rank measured site palettes with contrast guarantees and consensus bias.",inputSchema:paletteInput.shape,annotations:READ,handler:async input=>{const {recommendPalette}=await import("../../taste/tools.server");return surfaced(()=>recommendPalette(input));}});