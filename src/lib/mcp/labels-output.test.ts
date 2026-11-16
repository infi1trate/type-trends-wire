// @vitest-environment node
import {describe,it,expect,vi} from 'vitest';
vi.mock('./store.server',()=>({latestFontDate:vi.fn(async()=> '2026-11-10'),fontHistory:vi.fn(async()=>[{captured_on:'2026-11-10',family:'Inter',category:'sans-serif',is_variable:true,popularity_rank:8,trending_rank:20}]),fontSnapshot:vi.fn(async()=>({date:'2026-11-10',rows:[]})),familySuggestions:vi.fn(async()=>[]),
  wire:vi.fn(async()=>[{url:'https://type-trends-wire.lovable.app/?panel=brief&trait=css%3Asubgrid',title:'BREAKOUT $SUBGRID +4.8 pts/q in all',source:'DSGN/TERMINAL',source_kind:'alert',published_at:'2026-11-15T15:33:00Z',excerpt:'Momentum +4.80 pts/q · 9 sites · share 12.0% · stage accelerating',link:null,tags:['alert','breakout'],ref:'css:subgrid'}])}));
import {handleMcp} from './server.server';
import {json} from './tools/shared';
import {setSignalIndex} from './signal-index';
const TICKER=/\$[A-Z][A-Z0-9-]+/;
const call=async(name:string,args:unknown)=>{const res=await handleMcp(new Request('http://localhost/api/public/mcp',{method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream','mcp-protocol-version':'2025-06-18','x-forwarded-for':'labels-test'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})}));return (await res.json()).result.content[0].text as string;};
describe('MCP output labels',()=>{
 it('wire alerts read as plain names with the stable trait key',async()=>{const text=await call('wire',{source_kind:'alert'});expect(text).not.toMatch(TICKER);const item=JSON.parse(text).items[0];expect(item.title).toBe('BREAKOUT · Subgrid layouts [LAYOUT] +4.8 pts/q · all sectors');expect(item).toMatchObject({trait:'css:subgrid',label:'Subgrid layouts',dimension:'LAYOUT'});});
 it('font trends carry a label and FONT dimension, never a $ ticker',async()=>{const text=await call('get_trend',{family:'Inter'});expect(text).not.toMatch(TICKER);expect(JSON.parse(text)).toMatchObject({family:'Inter',label:'Inter',dimension:'FONT',stage_label:null});});
 it('adds label next to keys without overwriting raw categories',()=>{setSignalIndex([],new Map());const out=JSON.parse(json({rows:[{dimension:'css',value:'subgrid',stage:'accelerating'},{trait:'components:bento_grid',stage:'flat'},{signal:'dark_theme',label:'Dark theme'}],note:'was $LOGO-WALL, costs $50',palette:{tickers:['amber·muted·dark']}}).content[0]!.text);
  expect(out.palette.color_labels).toEqual(['Muted dark amber']);
  expect(out.rows[0]).toEqual({dimension:'css',value:'subgrid',stage:'accelerating',label:'Subgrid layouts',explainer_url:'https://type-trends-wire.lovable.app/signals/css%3Asubgrid',label_dimension:'LAYOUT',stage_label:'Rising',basis:'measured',tier:'archive',momentum_index:null,confidence:null,confidence_reason:null});
  expect(out.rows[1]).toEqual({trait:'components:bento_grid',stage:'flat',label:'Bento grids',explainer_url:'https://type-trends-wire.lovable.app/signals/components%3Abento_grid',dimension:'LAYOUT',stage_label:'Steady',basis:'ai',tier:'supporting',momentum_index:null,confidence:null,confidence_reason:null});
  expect(out.rows[2]).toMatchObject({signal:'dark_theme',label:'Dark theme',dimension:'COLOR'});
  expect(out.note).toBe('was Logo walls [LAYOUT], costs $50');});
 it('MCP tool output carries explainer_url next to label for forecast traits only',async()=>{const item=JSON.parse(await call('wire',{source_kind:'alert'})).items[0];expect(item).toMatchObject({trait:'css:subgrid',label:'Subgrid layouts',explainer_url:'https://type-trends-wire.lovable.app/signals/css%3Asubgrid'});
  const out=JSON.parse(json({a:{trait:'family:Inter'},b:{signal:'pill_cta'}}).content[0]!.text);expect(out.a.explainer_url).toBeUndefined();expect(out.b.explainer_url).toBeUndefined();});
});
