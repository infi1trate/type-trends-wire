import {defineTool} from '@lovable.dev/mcp-js';
import {z} from 'zod';
import * as store from '../store.server';
import {decodeEntities} from '../../entities';
import {json,READ} from './shared';
import {alertDisplayTitle} from '../../labels';
import { BRAND_NAME } from "../../brand";
import { sourceName } from "@/lib/brand";
export default defineTool({name:'wire',title:'Design news wire',description:`Recent design news (RSS, Hacker News, Bluesky, Product Hunt) and ${BRAND_NAME} trend-signal alerts. Alerts name each signal in plain words with its dimension (FONT, COLOR, LAYOUT, VIBE) and keep the stable trait key. Filter by keyword, tag, source or source_kind. Each trait or signal keeps its stable key and adds a plain-English label, a dimension (FONT, COLOR, LAYOUT or VIBE), basis (measured or ai), tier (headline, supporting or archive), momentum_index (0–100 percentile of the stored next-wave score among headline + supporting signals), confidence (High, Medium or Low, with confidence_reason) and, where staged, stage_label (Emerging, Rising, Peaking, Fading or Steady).`,
  inputSchema:{query:z.string().max(300).optional().describe('Words to match in title or excerpt'),tag:z.enum(['type','color','brand','ui','web','motion','ai']).optional(),source:z.string().max(100).optional().describe("e.g. 'Dezeen', 'Hacker News'"),source_kind:z.enum(['rss','hn','bluesky','arena','producthunt','alert']).optional().describe("'alert' = weekly breakout/crossover/saturation/sentiment/discourse alerts with numbers in the excerpt"),since_hours:z.number().int().min(1).max(720).default(72),limit:z.number().int().min(1).max(50).default(20)},annotations:READ,
  handler:async({query,tag,source,source_kind,since_hours,limit})=>{const sinceIso=new Date(Date.now()-since_hours*3600000).toISOString();const items=await store.wire({query,tag,source,source_kind,sinceIso,limit});
    return json({count:items.length,items:items.map(i=>({title:alertDisplayTitle(decodeEntities(i.title),i.ref),...(i.ref?{trait:i.ref}:{}),source:sourceName(i.source),source_kind:i.source_kind,published_at:i.published_at,link:i.link,tags:i.tags,url:i.url,excerpt:i.excerpt?decodeEntities(i.excerpt):null})),receipts:{sources:`Design RSS feeds, Hacker News (Algolia), sampled Bluesky posts, Product Hunt, ${BRAND_NAME} alerts`,since:sinceIso,note:'Headlines and links only; read the source for full text.'}});}
});
