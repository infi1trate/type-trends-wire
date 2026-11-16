// @vitest-environment node
import {describe,it,expect,vi} from 'vitest';
vi.mock('./store.server',()=>({latestFontDate:vi.fn(async()=> '2026-11-10'),fontHistory:vi.fn(async()=>[{captured_on:'2026-11-10',family:'Inter',category:'sans-serif',is_variable:true,popularity_rank:8,trending_rank:20}]),fontSnapshot:vi.fn(async()=>({date:'2026-11-10',rows:[]})),familySuggestions:vi.fn(async()=>[]),wire:vi.fn(async()=>[])}));
import {handleMcp} from './server.server';
import {MCP_TOOL_COUNT} from '../site';
import {MCP_TOOL_NAMES} from './tool-names';
const request=(method:string,params:unknown={},ip='roundtrip')=>new Request('http://localhost/api/public/mcp',{method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream','mcp-protocol-version':'2025-06-18','x-forwarded-for':ip},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
describe('MCP HTTP roundtrip',()=>{
 it('initializes, lists fourteen tools, reads methodology and gets Inter with receipts',async()=>{
  const init=await handleMcp(request('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'test',version:'1'}}));expect(init.status).toBe(200);const initialized=await init.json();expect(initialized.result.capabilities.resources).toEqual({});
  const list=await(await handleMcp(request('tools/list'))).json();expect(list.result.tools.map((t:{name:string})=>t.name)).toEqual([...MCP_TOOL_NAMES]);expect(MCP_TOOL_NAMES).toHaveLength(26);expect(list.result.tools).toHaveLength(MCP_TOOL_COUNT);
  const resource=await(await handleMcp(request('resources/read',{uri:'trend://methodology'}))).json();expect(resource.result.contents[0].text).toContain('42');
  const trend=await(await handleMcp(request('tools/call',{name:'get_trend',arguments:{family:'Inter'}}))).json();const r=JSON.parse(trend.result.content[0].text);expect(r.family).toBe('Inter');expect(r.receipts.snapshot).toBe('2026-11-10');expect(r.band).toBe('BASELINE');
 });
 it('rejects request 61 with JSON-RPC Rate limited',async()=>{for(let i=0;i<60;i++)expect((await handleMcp(new Request('http://localhost/api/public/mcp',{headers:{'x-forwarded-for':'limit-test'}}))).status).toBe(200);const res=await handleMcp(request('tools/list',{},'limit-test'));expect(res.status).toBe(429);expect((await res.json()).error.message).toBe('Rate limited');});
});
