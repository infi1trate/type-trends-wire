// @vitest-environment node
import {it,expect,vi,beforeEach} from 'vitest';
const state=vi.hoisted(()=>({rpc:vi.fn(async(name:string)=>({data:name==='ai_reserve'?{ok:true,id:1}:null,error:null})),generate:vi.fn()}));
vi.mock('@lovable.dev/ai-gateway',()=>({generateChatCompletion:state.generate,GatewayError:class extends Error{}}));
vi.mock('@/integrations/supabase/client.server',()=>({supabaseAdmin:{rpc:state.rpc,from:()=>({update:()=>({eq:async()=>({error:null})})})}}));
import {inferAI} from './ai-inference.server';
beforeEach(()=>vi.clearAllMocks());
it('delivers all five ordered labeled images to the Gateway and settles actual usage',async()=>{
 const images=['fold-jpeg','section-1-jpeg','section-2-jpeg','section-3-jpeg','section-4-jpeg'];
 const imageLabels=['fold','section 1, top to bottom','section 2, top to bottom','section 3, top to bottom','section 4, top to bottom'];
 state.generate.mockResolvedValueOnce({usage:{prompt_tokens:5000,completion_tokens:100},choices:[{message:{tool_calls:[{type:'function',function:{name:'emit_result',arguments:JSON.stringify({imagery:[],aesthetic:[],components:['logo_wall','bento_grid'],hero_layout:'text_only',ai_positioning:'none',tone:[],color_mood:'monochrome',confidence:.8,blocked_reason:null})}}]}}]});
 const result=await inferAI({snapshot_id:1,kind:'vision',context:'untrusted context',captured_at:'2026-11-11T01:00:00Z',images,imageLabels});
 const call=state.generate.mock.calls[0]?.[0];
 expect(call.messages[1].content).toEqual([{type:'text',text:'untrusted context'},...images.flatMap((url,i)=>[{type:'text',text:imageLabels[i]},{type:'image_url',image_url:{url}}])]);
 expect(state.rpc).toHaveBeenCalledWith('ai_reserve',expect.objectContaining({p_estimate:0.137288}));
 expect(state.rpc).toHaveBeenCalledWith('ai_settle',expect.objectContaining({p_input:5000,p_output:100,p_cost:.0028}));
 expect(result.data).toEqual(expect.objectContaining({components:['logo_wall','bento_grid'],confidence:.8,low_confidence:false}));
});
it('passes the deadline signal and sanitized validation feedback to text inference',async()=>{
 const signal=new AbortController().signal;
 state.generate.mockResolvedValueOnce({usage:{prompt_tokens:100,completion_tokens:100},choices:[{message:{tool_calls:[{type:'function',function:{name:'emit_result',arguments:JSON.stringify({features:[],primary_theme:'other',mentions_agents:false,mentions_mcp:false})}}]}}]});
 await inferAI({snapshot_id:2,kind:'product',context:'page text',captured_at:'2026-11-11T00:00:00Z',signal,validationError:'features: invalid_type'});
 const call=state.generate.mock.calls[0];expect(call?.[1]).toEqual({signal});expect(call?.[0].messages[1].content[1].text).toContain('features: invalid_type');
});