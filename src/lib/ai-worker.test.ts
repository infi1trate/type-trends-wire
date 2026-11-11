// @vitest-environment node
import {it,expect,vi} from 'vitest';
const rpc=vi.hoisted(()=>vi.fn(async()=>({data:{ok:false,jobs:[]},error:null})));
vi.mock('@/integrations/supabase/client.server',()=>({supabaseAdmin:{rpc,from:vi.fn()}}));
vi.mock('./ai-inference.server',()=>({inferAI:vi.fn(),AiFailure:class extends Error{}}));
import {runAiWorker} from './ai-worker.server';
import {inferAI} from './ai-inference.server';
it('does not process or call inference when the persistent job lease is paused or busy',async()=>{expect(await runAiWorker()).toEqual({ok:true,processed:0,paused_or_busy:true});expect(rpc).toHaveBeenCalledWith('library_ai_claim',expect.objectContaining({p_token:expect.any(String)}));expect(inferAI).not.toHaveBeenCalled();});