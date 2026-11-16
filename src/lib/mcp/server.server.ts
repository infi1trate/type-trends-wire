import {createMcpProtocolHandler} from '@lovable.dev/mcp-js/protocols/mcp';
import definition from './index';
import {METHODOLOGY} from './analysis';
import {createRateLimiter} from './rate-limit';
import {createKeyedLimiter,usageTool} from './keys';
import {createKeyResolver,type Caller} from './keys.server';
import {primeSignalIndex} from './signal-index';
export const TOOL_NAMES=['get_trend','search_trends','wire','library_site','library_events','library_sector','crawl_spread','library_trends','library_history','site_history','forecast','next_wave','trendsetters','weekly_brief','recommend_type','recommend_palette','differentiate','critique','rebrands','vibe_map','audit_sites','watchlist_changes','forecast_ledger'];
const KNOWN=new Set(TOOL_NAMES);
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, DELETE, OPTIONS','Access-Control-Allow-Headers':'authorization, content-type, mcp-session-id, mcp-protocol-version, accept','Access-Control-Expose-Headers':'mcp-session-id'};
const protocol=createMcpProtocolHandler(definition,{resourcePath:'/api/public/mcp'});
const rpcError=(message:string,code:number,status:number)=>Response.json({jsonrpc:'2.0',error:{code,message},id:null},{status,headers:{...CORS,...(status===429?{'Retry-After':'60'}:{})}});
export type McpDeps={resolve:(header:string|null)=>Promise<Caller>;count:(id:string,tool:string)=>Promise<void>;anon:(ip:string)=>boolean;keyed:(id:string,limit:number)=>boolean;prime?:()=>Promise<void>};
const prod=():McpDeps=>{const store=async()=>(await import('./keys.server')).adminKeyStore();return{resolve:createKeyResolver(store),count:async(id,tool)=>(await store()).count(id,tool),anon:createRateLimiter(),keyed:createKeyedLimiter()};};
let defaults:McpDeps|undefined;
/** Anonymous callers keep the per-IP limit; a valid `Authorization: Bearer dsgn_…` key gets its own per-key limit and aggregate usage counts; unknown or revoked keys get 401 (no detail). Keys are never logged. */
export async function handleMcp(req:Request,deps?:McpDeps):Promise<Response>{
  const d=deps??(defaults??=prod());
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
  let caller:Caller;try{caller=await d.resolve(req.headers.get('authorization'));}catch{return rpcError('Internal error',-32603,500);}
  if(caller.kind==='denied')return rpcError('Unauthorized',-32001,401);
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if(caller.kind==='key'?!d.keyed(caller.id,caller.rate):!d.anon(ip))return rpcError('Rate limited',-32000,429);
  let method:unknown,toolName:unknown;
  const counted=caller.kind==='key'?caller.id:null;
  const count=async()=>{if(counted)await d.count(counted,usageTool(method,toolName,KNOWN,req.method)).catch(()=>{console.error('MCP usage count failed');});};
  try{
     if(req.method==='GET'&&!(req.headers.get('accept')??'').includes('text/event-stream')){await count();return Response.json({name:definition.name,version:definition.version,transport:'streamable-http',tools:TOOL_NAMES,resources:['trend://methodology'],keys:'optional: Authorization: Bearer dsgn_… raises the rate limit'},{headers:CORS});}
    // The SDK supports tools/app resources, but not arbitrary read-only resources.
    // This compatibility layer adds only the requested methodology resource.
    if(req.method==='POST'){
      const bytes=Number(req.headers.get('content-length')??0);if(bytes>2200000)return rpcError('Request too large',-32600,413);
      const body=await req.clone().text();if(body.length>2200000)return rpcError('Request too large',-32600,413);
      let data:unknown;try{data=JSON.parse(body);}catch{return rpcError('Parse error',-32700,400);}
      if(data && typeof data==='object' && !Array.isArray(data)){
        const msg=data as {jsonrpc?:unknown;method?:unknown;id?:unknown;params?:{uri?:unknown;name?:unknown}};method=msg.method;toolName=msg.params?.name;
        if(msg.jsonrpc==='2.0'&&(typeof msg.id==='string'||typeof msg.id==='number'||msg.id===null)){
          if(method==='resources/list'){await count();return Response.json({jsonrpc:'2.0',id:msg.id,result:{resources:[{uri:'trend://methodology',name:'methodology',title:'How DSGN/TERMINAL scores trends',mimeType:'text/plain'}]}},{headers:CORS});}
          if(method==='resources/read'){await count();return msg.params?.uri==='trend://methodology'?Response.json({jsonrpc:'2.0',id:msg.id,result:{contents:[{uri:'trend://methodology',mimeType:'text/plain',text:METHODOLOGY}]}},{headers:CORS}):Response.json({jsonrpc:'2.0',id:msg.id,error:{code:-32002,message:'Resource not found'}},{headers:CORS});}
        }
      }
    }
    await count();
    // Tool answers carry tier / momentum_index / confidence from the latest stored forecast (cached; failures leave the fields out).
    if(method==='tools/call')await (d.prime??primeSignalIndex)();
    const res=await protocol(req);const headers=new Headers(res.headers);for(const[k,v]of Object.entries(CORS))headers.set(k,v);
    if(req.method==='POST'&&res.ok&&res.body){
      const text=await res.text();
      const payload=(res.headers.get('content-type')??'').includes('text/event-stream') ? text.split('\n').find(line=>line.startsWith('data:'))?.slice(5).trim() : text;
      if(payload){const data=JSON.parse(payload);if(method==='initialize'&&data.result?.capabilities)data.result.capabilities.resources={};headers.set('Content-Type','application/json');return Response.json(data,{status:res.status,headers});}
      return new Response(null,{status:res.status,headers});
    }
    return new Response(res.body,{status:res.status,headers});
  }catch(error){console.error('MCP request failed',error instanceof Error?error.name:'error');return rpcError('Internal error',-32603,500);}
}
