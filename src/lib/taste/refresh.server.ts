import { panelHistoryRows as historyRows } from "../history.server";
import {supabaseAnon} from "../mcp/supabase";
import {loadTasteSites,pages,measuredPalette,WIDE_PAGE} from "./store.server";
import {buildFontCatalog,isNonType} from "./fonts";
import {invalidateTasteCache} from "./cache.server";
import {normalizeFont as normalizeFontRaw} from "../library-diff";
import {forecastSeries,type SeriesPoint} from "../forecast";
import {SECTORS,obj} from "../library";
import {colorTicker as colorTickerRaw,oklch as oklchRaw} from "./color";
// Pure per-string conversions are memoized: the scope × key × snapshot loops below call them hundreds of millions of times otherwise.
const memo=<T,>(f:(s:string)=>T)=>{const m=new Map<string,T>();return (s:string):T=>{if(m.has(s))return m.get(s) as T;const v=f(s);m.set(s,v);return v;};};
const normalizeFont=memo(normalizeFontRaw),colorTicker=memo(colorTickerRaw),oklch=memo(oklchRaw);
import type {Json} from "@/integrations/supabase/types";
function jsonValue(value:unknown):Json {if(value===null||typeof value==='string'||typeof value==='boolean')return value;if(typeof value==='number')return Number.isFinite(value)?value:null;if(Array.isArray(value))return value.map(jsonValue);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).map(([k,v])=>[k,jsonValue(v)]));return null;}
export async function refreshTaste(){
 const read=supabaseAnon(),{supabaseAdmin:db}=await import("@/integrations/supabase/client.server");
 // Sites first: running this read alongside the full snapshot scan hits the read statement timeout under load.
 const rawSites=await loadTasteSites();
 const [history,historySignals,latest,oldCatalog,setters]=await Promise.all([historyRows<{domain:string;quarter:string;sector:string|null;h1_family:string|null}>(read,"domain,quarter,sector,h1_family").then(rows=>rows.sort((a,b)=>a.quarter.localeCompare(b.quarter)||a.domain.localeCompare(b.domain))),pages((f,t)=>read.from("library_snapshots").select("domain,captured_at,source,type:signals->type,color:signals->color").eq("page_type","home").eq("viewport","desktop").order("captured_at").order("id").range(f,t),WIDE_PAGE).then(rows=>rows.map(({type,color,...r})=>({...r,signals:{type,color}}))),read.from("gfont_snapshots").select("captured_on").order("captured_on",{ascending:false}).limit(1),pages(f=>read.from("font_catalog").select("key,category").order("key").range(f,f+999)),read.from("trendsetters_latest").select("domain").order("rank").limit(30)]);
 if(latest.error||setters.error)throw latest.error??setters.error;
 // Emoji/icon/symbol fonts are never faces: treat them as unmeasured so they leave usage, pairs and denominators.
 const nonType=new Set<string>(),face=(v:string|null)=>{if(v&&isNonType(v)){nonType.add(normalizeFont(v));return null;}return v;};
 const sites=rawSites.map(s=>({...s,h1:face(s.h1),body:face(s.body)}));const day=latest.data?.[0]?.captured_on;
 const google=day?await pages(f=>read.from("gfont_snapshots").select("family,category").eq("captured_on",day).order("family").range(f,f+999)):[];
 const allNames=[...sites.flatMap(s=>[s.h1,s.body]),...history.map(s=>s.h1_family),...historySignals.flatMap(s=>{const t=obj(obj(s.signals)['type']);return ['h1','body'].flatMap(r=>[obj(obj(t['rendered'])[r])['family'],obj(obj(t['declared'])[r])['family']]);})].filter((v):v is string=>typeof v==="string");
 const top=new Set(setters.data?.map(s=>s.domain)??[]),topSites=sites.filter(s=>top.has(s.domain));
 const crawlLatest=await read.from('crawl_latest').select('id').limit(1);if(crawlLatest.error)throw crawlLatest.error;
 const crawlFonts=crawlLatest.data?.[0]?.id?await pages(f=>read.from('crawl_sites').select('domain,index_name,type').eq('run_id',crawlLatest.data?.[0]?.id??'').eq('ok',true).order('domain').order('index_name').range(f,f+999)):[];
 // Every domain seen using each family across library, crawl and history (drives brand-token and single-site proprietary rules).
 const fontDomains=new Map<string,Set<string>>(),seenOn=(family:unknown,domain:string|null)=>{if(typeof family!=="string"||!domain)return;if(isNonType(family)){nonType.add(normalizeFont(family));return;}const key=normalizeFont(family);if(!key)return;const set=fontDomains.get(key)??new Set<string>();set.add(domain.replace(/^www\./,""));fontDomains.set(key,set);};
 for(const s of sites){seenOn(s.h1,s.domain);seenOn(s.body,s.domain);}for(const h of history)seenOn(h.h1_family,h.domain);
 for(const snap of historySignals){const t=obj(obj(snap.signals)['type']);for(const r of ['h1','body']){seenOn(obj(obj(t['rendered'])[r])['family'],snap.domain);seenOn(obj(obj(t['declared'])[r])['family'],snap.domain);}}
 for(const c of crawlFonts){const t=obj(c.type);for(const r of ['h1','body']){seenOn(obj(obj(t['rendered'])[r])['family'],c.domain);seenOn(obj(obj(t['declared'])[r])['family'],c.domain);}}
 const catalog=buildFontCatalog(allNames,google,fontDomains);for(const c of catalog){const old=oldCatalog.find(o=>o.key===c.key);if(c.category==="unknown"&&old&&old.category!=="unknown")c.category=old.category as typeof c.category;}
 const crawlShare=(index:string,key:string,role:string)=>{const list=crawlFonts.filter(s=>s.index_name===index&&typeof obj(obj(obj(s.type)['rendered'])[role])['family']==='string');return list.length?list.filter(s=>normalizeFont(String(obj(obj(obj(s.type)['rendered'])[role])['family']))===key).length/list.length:null;};
 const quarter=(date:string)=>`${date.slice(0,4)}Q${Math.floor((Number(date.slice(5,7))-1)/3)+1}`;
 // Latest sample per domain/quarter; prefer live, matching history facade semantics.
 const hs=new Map<string,typeof historySignals[number]>();for(const s of historySignals){const k=`${s.domain}|${quarter(s.captured_at)}`,p=hs.get(k);if(!p||p.source!=="live"||s.source==="live")hs.set(k,s);}
 const sectorOf=new Map(sites.map(s=>[s.domain,s.sector]));
 // Per-sample facts computed once: quarter, measured family per role (undefined = not counted), color tickers (null = no valid hex).
 const samples=[...hs.values()].map(snap=>{const t=obj(obj(snap.signals)['type']),fam=(role:string)=>{const f=obj(obj(t['rendered'])[role])['family'];return typeof f==="string"&&!isNonType(f)?normalizeFont(f):undefined;};const c=obj(obj(snap.signals)['color']),palette=Array.isArray(c['palette'])?c['palette'].map(p=>obj(p)['hex']):[],hexes=[c['accent'],...palette].filter((v):v is string=>typeof v==="string"&&/^#[\da-f]{6}$/i.test(v));
  return {domain:snap.domain,q:quarter(snap.captured_at),h1:fam('h1'),body:fam('body'),colorKeys:hexes.length?new Set(hexes.map(colorTicker)):null};});
 const usage: {key:string;scope:string;role:string;data:Record<string,unknown>}[]=[],colors:{key:string;scope:string;data:Record<string,unknown>}[]=[];
 for(const scope of ['all',...SECTORS]){const subset=sites.filter(s=>scope==="all"||s.sector===scope);
  for(const role of ['h1','body'] as const){const measured=subset.filter(s=>s[role]),keys=new Set(measured.map(s=>normalizeFont(s[role]??"")));for(const key of keys){const uses=measured.filter(s=>normalizeFont(s[role]??"")===key),all=sites.filter(s=>s[role]),allUses=all.filter(s=>normalizeFont(s[role]??"")===key),quarters=new Map<string,{n:number;used:number}>();
   for(const snap of samples){if(scope!=="all"&&sectorOf.get(snap.domain)!==scope)continue;const family=snap[role];if(family===undefined)continue;const q=snap.q,v=quarters.get(q)??{n:0,used:0};v.n++;if(family===key)v.used++;quarters.set(q,v);}
   const series:SeriesPoint[]=[...quarters].map(([q,v])=>({quarter:q,share:v.used/v.n,denom:v.n,coverage:v.n/Math.max(1,subset.length)})).sort((a,b)=>a.quarter.localeCompare(b.quarter)),fit=forecastSeries(series,scope);
   const trendsetterSites=topSites.filter(s=>normalizeFont(s[role]??"")===key).length,vanguard=crawlShare('vanguard',key,role),mainstream=crawlShare('mainstream',key,role);
   usage.push({key,scope,role,data:{sites:uses.length,denom:measured.length,share:uses.length/Math.max(1,measured.length),share_all:allUses.length/Math.max(1,all.length),stage:fit.status==="ok"?fit.stage:null,momentum:fit.status==="ok"?fit.momentum:null,series,trendsetter_sites:trendsetterSites,trendsetter_n:topSites.length,trendsetter_share:topSites.length?trendsetterSites/topSites.length:null,vanguard_spread:vanguard!==null&&mainstream!==null?(vanguard-mainstream)*100:null,used_by:uses.slice(0,5).map(s=>s.domain)}});}}
  const measured=subset.filter(s=>s.accent||s.palette.length),keys=new Set(measured.flatMap(s=>[s.accent,...s.palette].filter((c):c is string=>!!c).map(colorTicker)));
  for(const key of keys){const has=(s:typeof sites[number])=>[s.accent,...s.palette].some(c=>c&&colorTicker(c)===key),uses=measured.filter(has),quarters=new Map<string,{n:number;used:number}>();
   for(const snap of samples){if(scope!=="all"&&sectorOf.get(snap.domain)!==scope)continue;if(!snap.colorKeys)continue;const q=snap.q,v=quarters.get(q)??{n:0,used:0};v.n++;if(snap.colorKeys.has(key))v.used++;quarters.set(q,v);}
   const series=[...quarters].map(([q,v])=>({quarter:q,share:v.used/v.n,denom:v.n,coverage:v.n/Math.max(1,subset.length)})).sort((a,b)=>a.quarter.localeCompare(b.quarter)),fit=forecastSeries(series,scope),hexes=[...new Set(uses.flatMap(s=>[s.accent,...s.palette].filter((c):c is string=>!!c&&colorTicker(c)===key)))];
   const distance=(a:string,b:string)=>{const x=oklch(a),y=oklch(b);return Math.hypot(x.L-y.L,x.C-y.C,Math.min(Math.abs(x.h-y.h),360-Math.abs(x.h-y.h))/360);};const medoid=hexes.sort((a,b)=>hexes.reduce((n,x)=>n+distance(a,x)-distance(b,x),0))[0]??null;
   colors.push({key,scope,data:{share:uses.length/Math.max(1,measured.length),sites:uses.length,denom:measured.length,series,stage:fit.status==="ok"?fit.stage:null,momentum:fit.status==="ok"?fit.momentum:null,example_hex:medoid,example_domains:uses.slice(0,5).map(s=>s.domain)}});}
 }
 const pairMap=new Map<string,typeof sites>();for(const s of sites)if(s.h1&&s.body){const key=`${normalizeFont(s.h1)}|${normalizeFont(s.body)}`;pairMap.set(key,[...pairMap.get(key)??[],s]);}
 const pairs=[...pairMap].map(([key,list])=>({key,data:{h1_key:normalizeFont(list[0]?.h1??""),body_key:normalizeFont(list[0]?.body??""),count:list.length,denom:sites.filter(s=>s.h1&&s.body).length,sectors:[...new Set(list.map(s=>s.sector))],domains:list.slice(0,5).map(s=>s.domain),sector_counts:Object.fromEntries(SECTORS.map(scope=>[scope,list.filter(s=>s.sector===scope).length]))}}));
 const palettes=sites.flatMap(s=>{const p=measuredPalette(s);return p?[{domain:s.domain,data:{...p,sector:s.sector,theme:s.theme,mode:s.mode,tags:s.tags,captured_at:s.captured_at}}]:[];});
 const result=await db.rpc("replace_taste_data",{p_catalog:jsonValue(catalog),p_usage:jsonValue(usage),p_pairs:jsonValue(pairs),p_colors:jsonValue(colors),p_palettes:jsonValue(palettes)});if(result.error)throw result.error;
 // The summary RPC upserts the catalog; remove emoji/icon/symbol rows left from earlier refreshes so they are never faces.
 const stale=oldCatalog.filter(o=>isNonType(o.key)||nonType.has(o.key)).map(o=>o.key);if(stale.length){const removed=await db.from("font_catalog").delete().in("key",stale);if(removed.error)throw removed.error;}
 // New summaries: cached recommendations, critiques and the shared daily taste data must not outlive them.
 const cacheCleared=await invalidateTasteCache();
 return {cache_cleared:cacheCleared,stale_non_type_removed:stale.length,proprietary:catalog.filter(c=>c.license_hint==="proprietary").map(c=>`${c.family} (${c.license_reason})`),system:catalog.filter(c=>c.license_hint==="system").length,non_type_dropped:[...nonType].filter(Boolean).sort(),catalog:catalog.length,usage:usage.length,pairs:pairs.length,colors:colors.length,palettes:palettes.length,unknown:catalog.filter(c=>c.category==="unknown").length};
}