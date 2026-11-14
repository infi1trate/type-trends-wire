import {defineTool} from '@lovable.dev/mcp-js';
import {z} from 'zod';
import * as store from '../store.server';
import {decodeEntities} from '../../entities';
import {json,READ} from './shared';
export default defineTool({name:'wire',title:'Design news wire',description:'Recent design news (RSS, Hacker News, Bluesky, Product Hunt) and DSGN/TERMINAL trend alerts. Filter by keyword, tag, source or source_kind.',
  inputSchema:{query:z.string().max(300).optional().describe('Words to match in title or excerpt'),tag:z.enum(['type','color','brand','ui','web','motion','ai']).optional(),source:z.string().max(100).optional().describe("e.g. 'Dezeen', 'Hacker News'"),source_kind:z.enum(['rss','hn','bluesky','arena','producthunt','alert']).optional().describe("'alert' = weekly breakout/crossover/saturation/sentiment/discourse alerts with numbers in the excerpt"),since_hours:z.number().int().min(1).max(720).default(72),limit:z.number().int().min(1).max(50).default(20)},annotations:READ,
  handler:async({query,tag,source,source_kind,since_hours,limit})=>{const sinceIso=new Date(Date.now()-since_hours*3600000).toISOString();const items=await store.wire({query,tag,source,source_kind,sinceIso,limit});
    return json({count:items.length,items:items.map(i=>({title:decodeEntities(i.title),source:i.source,source_kind:i.source_kind,published_at:i.published_at,link:i.link,tags:i.tags,url:i.url,excerpt:i.excerpt?decodeEntities(i.excerpt):null})),receipts:{sources:'Design RSS feeds, Hacker News (Algolia), sampled Bluesky posts, Product Hunt, DSGN/TERMINAL alerts',since:sinceIso,note:'Headlines and links only; read the source for full text.'}});}
});
