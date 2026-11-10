import {createMcpProtocolHandler} from '@lovable.dev/mcp-js/protocols/mcp';
import definition from './index';
import {METHODOLOGY} from './analysis';
import {createRateLimiter} from './rate-limit';
const allowed=createRateLimiter();
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, DELETE, OPTIONS','Access-Control-Allow-Headers':'authorization, content-type, mcp-session-id, mcp-protocol-version, accept','Access-Control-Expose-Headers':'mcp-session-id'};
const protocol=createMcpProtocolHandler(definition,{resourcePath:'/api/public/mcp'});
const rpcError=(message:string,code:number,status:number)=>Response.json({jsonrpc:'2.0',error:{code,message},id:null},{status,headers:{...CORS,...(status===429?{'Retry-After':'60'}:{})}});
export async function handleMcp(req:Request):Promise<Response>{
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if(!allowed(ip))return rpcError('Rate limited',-32000,429);
  try{
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
    if(req.method==='GET'&&!(req.headers.get('accept')??'').includes('text/event-stream'))return Response.json({name:definition.name,version:definition.version,transport:'streamable-http',tools:['get_trend','search_trends','wire'],resources:['trend://methodology']},{headers:CORS});
    // The SDK supports tools/app resources, but not arbitrary read-only resources.
    // This compatibility layer adds only the requested methodology resource.
    let method:unknown;
    if(req.method==='POST'){
      const bytes=Number(req.headers.get('content-length')??0);if(bytes>1048576)return rpcError('Request too large',-32600,413);
      const body=await req.clone().text();if(body.length>1048576)return rpcError('Request too large',-32600,413);
      let data:unknown;try{data=JSON.parse(body);}catch{return rpcError('Parse error',-32700,400);}
      if(data && typeof data==='object' && !Array.isArray(data)){
        const msg=data as {jsonrpc?:unknown;method?:unknown;id?:unknown;params?:{uri?:unknown}};method=msg.method;
        if(msg.jsonrpc==='2.0'&&(typeof msg.id==='string'||typeof msg.id==='number'||msg.id===null)){
          if(method==='resources/list')return Response.json({jsonrpc:'2.0',id:msg.id,result:{resources:[{uri:'trend://methodology',name:'methodology',title:'How DSGN/TERMINAL scores trends',mimeType:'text/plain'}]}},{headers:CORS});
          if(method==='resources/read')return msg.params?.uri==='trend://methodology'?Response.json({jsonrpc:'2.0',id:msg.id,result:{contents:[{uri:'trend://methodology',mimeType:'text/plain',text:METHODOLOGY}]}},{headers:CORS}):Response.json({jsonrpc:'2.0',id:msg.id,error:{code:-32002,message:'Resource not found'}},{headers:CORS});
        }
      }
    }
    const res=await protocol(req);const headers=new Headers(res.headers);for(const[k,v]of Object.entries(CORS))headers.set(k,v);
    if(req.method==='POST'&&res.ok&&res.body){
      const text=await res.text();
      const payload=(res.headers.get('content-type')??'').includes('text/event-stream') ? text.split('\n').find(line=>line.startsWith('data:'))?.slice(5).trim() : text;
      if(payload){const data=JSON.parse(payload);if(method==='initialize'&&data.result?.capabilities)data.result.capabilities.resources={};headers.set('Content-Type','application/json');return Response.json(data,{status:res.status,headers});}
      return new Response(null,{status:res.status,headers});
    }
    return new Response(res.body,{status:res.status,headers});
  }catch(error){console.error('MCP request failed',error);return rpcError('Internal error',-32603,500);}
}
