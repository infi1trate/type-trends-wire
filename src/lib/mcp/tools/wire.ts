import {defineTool} from '@lovable.dev/mcp-js';
import {z} from 'zod';
import * as store from '../store.server';
import {decodeEntities} from '../../entities';
import {json,READ} from './shared';
export default defineTool({name:'wire',title:'Design news wire',description:'Recent design news from design publications (RSS) and Hacker News. Filter by keyword, tag or source.',
  inputSchema:{query:z.string().max(300).optional().describe('Words to match in title or excerpt'),tag:z.enum(['type','color','brand','ui','web','motion','ai']).optional(),source:z.string().max(100).optional().describe("e.g. 'Dezeen', 'Hacker News'"),since_hours:z.number().int().min(1).max(720).default(72),limit:z.number().int().min(1).max(50).default(20)},annotations:READ,
  handler:async({query,tag,source,since_hours,limit})=>{const sinceIso=new Date(Date.now()-since_hours*3600000).toISOString();const items=await store.wire({query,tag,source,sinceIso,limit});
    return json({count:items.length,items:items.map(i=>({title:decodeEntities(i.title),source:i.source,published_at:i.published_at,tags:i.tags,url:i.url,excerpt:i.excerpt?decodeEntities(i.excerpt):null})),receipts:{sources:'Design RSS feeds + Hacker News (Algolia)',since:sinceIso,note:'Headlines and links only; read the source for full text.'}});}
});
