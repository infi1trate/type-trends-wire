import {createServerFn} from "@tanstack/react-start";
import {getRequestHeader,setResponseStatus} from "@tanstack/react-start/server";
import {z} from "zod";
import {createRateLimiter} from "./mcp/rate-limit";
const allowed=createRateLimiter();
export const runTasteCommand=createServerFn({method:"POST"}).inputValidator(z.object({command:z.string().min(1).max(4096)}).strict()).handler(async({data})=>{
 const ip=getRequestHeader('cf-connecting-ip')??getRequestHeader('x-forwarded-for')?.split(',')[0]??'unknown';if(!allowed(ip)){setResponseStatus(429);return {ok:false as const,error:"Rate limited; try in one minute"};}
 try{const {executeCommand}=await import("./taste/tools.server");const result=await executeCommand(data.command);return {ok:true as const,result:JSON.stringify(result)};}catch(e){const status=e&&typeof e==='object'&&'status'in e&&e.status===429?429:400;setResponseStatus(status);return {ok:false as const,error:e instanceof Error?e.message:"Taste analysis unavailable"};}
});