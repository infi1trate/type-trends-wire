import {defineTool} from '@lovable.dev/mcp-js';
import {z} from 'zod';
import {movers} from '../analysis';
import * as store from '../store.server';
import {json,daysBefore,READ,GF,receipt} from './shared';
export default defineTool({name:'search_trends',title:'Find typefaces that are moving',description:"Ranks Google Fonts families by usage-rank change over a window, or Google's current trending order. Filter by category.",
  inputSchema:{direction:z.enum(['rising','falling','trending']).default('rising'),category:z.enum(['serif','sans-serif','display','handwriting','monospace']).optional(),window_days:z.number().int().min(1).max(90).default(28),limit:z.number().int().min(1).max(50).default(15)},annotations:READ,
  handler:async({direction,category,window_days,limit})=>{
    const latestDate=await store.latestFontDate(); if(!latestDate)return json({error:'No snapshots yet.',receipts:receipt});
    const [now,then]=await Promise.all([store.fontSnapshot(latestDate),store.fontSnapshot(daysBefore(latestDate,window_days))]);
    if(!now)return json({error:'Latest snapshot missing.',receipts:receipt});
    if(direction!=='trending'&&(!then||then.date===now.date))return json({error:`Need a snapshot from ${window_days}+ days ago; history is shorter. Try direction "trending" or a shorter window.`,receipts:{...receipt,snapshots:[now.date]}});
    const dates=direction==='trending'?[now.date]:then?[then.date,now.date]:[now.date];
    return json({direction,category:category??'all',window:direction==='trending'?'current':`${then?.date} → ${now.date}`,results:movers(now.rows,then?.rows??[],{direction,category,limit}),receipts:{source:GF,snapshots:dates,families_compared:now.rows.length,method:'trend://methodology'}});
  }
});
