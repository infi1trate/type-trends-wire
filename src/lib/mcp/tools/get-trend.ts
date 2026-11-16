import { defineTool } from '@lovable.dev/mcp-js';
import { z } from 'zod';
import { analyzeFamily } from '../analysis';
import * as store from '../store.server';
import {json,daysBefore,READ,receipt} from './shared';
export default defineTool({ name:'get_trend',title:"Get a typeface's trend",description:'Usage rank, trending rank, 7- and 28-day rank changes, band and daily history for one Google Fonts family. Each trait or signal keeps its stable key and adds a plain-English label, a dimension (FONT, COLOR, LAYOUT or VIBE), basis (measured or ai), tier (headline, supporting or archive), momentum_index (0–100 percentile of the stored next-wave score among headline + supporting signals), confidence (High, Medium or Low, with confidence_reason) and, where staged, stage_label (Emerging, Rising, Peaking, Fading or Steady).',
  inputSchema:{family:z.string().min(2).max(200).describe("Family name, e.g. 'Inter', 'Instrument Serif'")},annotations:READ,
  handler:async({family})=>{ const latest=await store.latestFontDate(); if(!latest) return json({error:'No snapshots yet.',receipts:receipt});
    const history=await store.fontHistory(family,daysBefore(latest,90)), r=analyzeFamily(history);
    if(!r) return json({error:`No family matching "${family}".`,did_you_mean:await store.familySuggestions(family,5),receipts:{...receipt,snapshot:latest}});
    return json({...r,receipts:{...receipt,snapshot:r.as_of,snapshots_used:history.length}}); }
});
