import {supabaseAnon} from "../mcp/supabase";
import {loadTasteSites,pages,measuredPalette} from "./store.server";
import {buildFontCatalog} from "./fonts";
import {normalizeFont} from "../library-diff";
import {forecastSeries,type SeriesPoint} from "../forecast";
import {SECTORS,obj} from "../library";
import {colorTicker,oklch} from "./color";
import type {Json} from "@/integrations/supabase/types";
function jsonValue(value:unknown):Json {if(value===null||typeof value==='string'||typeof value==='boolean')return value;if(typeof value==='number')return Number.isFinite(value)?value:null;if(Array.isArray(value))return value.map(jsonValue);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).map(([k,v])=>[k,jsonValue(v)]));return null;}
export async function refreshTaste(){
 const read=supabaseAnon(),{supabaseAdmin:db}=await import("@/integrations/supabase/client.server");
 const [sites,history,historySignals,latest,oldCatalog,setters]=await Promise.all([loadTasteSites(),pages(f=>read.from("library_site_history").select("domain,quarter,sector,h1_family").order("quarter").order("domain").range(f,f+999)),pages(f=>read.from("library_snapshots").select("domain,captured_at,signals,source").eq("page_type","home").eq("viewport","desktop").order("captured_at").order("id").range(f,f+999)),read.from("gfont_snapshots").select("captured_on").order("captured_on",{ascending:false}).limit(1),pages(f=>read.from("font_catalog").select("key,category").order("key").range(f,f+999)),read.from("trendsetters_latest").select("domain").order("rank").limit(30)]);
 if(latest.error||setters.error)throw latest.error??setters.error;const day=latest.data?.[0]?.captured_on;
 const google=day?await pages(f=>read.from("gfont_snapshots").select("family,category").eq("captured_on",day).order("family").range(f,f+999)):[];
 const allNames=[...sites.flatMap(s=>[s.h1,s.body]),...history.map(s=>s.h1_family),...historySignals.flatMap(s=>{const t=obj(obj(s.signals)['type']);return ['h1','body'].flatMap(r=>[obj(obj(t['rendered'])[r])['family'],obj(obj(t['declared'])[r])['family']]);})].filter((v):v is string=>typeof v==="string");
 const catalog=buildFontCatalog(allNames,google);for(const c of catalog){const old=oldCatalog.find(o=>o.key===c.key);if(c.category==="unknown"&&old&&old.category!=="unknown")c.category=old.category as typeof c.category;}
 const top=new Set(setters.data?.map(s=>s.domain)??[]),topSites=sites.filter(s=>top.has(s.domain));
 const crawlLatest=await read.from('crawl_latest').select('id').limit(1);if(crawlLatest.error)throw crawlLatest.error;
 const crawlFonts=crawlLatest.data?.[0]?.id?await pages(f=>read.from('crawl_sites').select('domain,index_name,type').eq('run_id',crawlLatest.data?.[0]?.id??'').eq('ok',true).order('domain').order('index_name').range(f,f+999)):[];
 const crawlShare=(index:string,key:string,role:string)=>{const list=crawlFonts.filter(s=>s.index_name===index&&typeof obj(obj(obj(s.type)['rendered'])[role])['family']==='string');return list.length?list.filter(s=>normalizeFont(String(obj(obj(obj(s.type)['rendered'])[role])['family']))===key).length/list.length:null;};
 const quarter=(date:string)=>`${date.slice(0,4)}Q${Math.floor((Number(date.slice(5,7))-1)/3)+1}`;
 // Latest sample per domain/quarter; prefer live, matching history facade semantics.
 const hs=new Map<string,typeof historySignals[number]>();for(const s of historySignals){const k=`${s.domain}|${quarter(s.captured_at)}`,p=hs.get(k);if(!p||p.source!=="live"||s.source==="live")hs.set(k,s);}
 const sectorOf=new Map(sites.map(s=>[s.domain,s.sector]));
 const usage: {key:string;scope:string;role:string;data:Record<string,unknown>}[]=[],colors:{key:string;scope:string;data:Record<string,unknown>}[]=[];
 for(const scope of ['all',...SECTORS]){const subset=sites.filter(s=>scope==="all"||s.sector===scope);
  for(const role of ['h1','body'] as const){const measured=subset.filter(s=>s[role]),keys=new Set(measured.map(s=>normalizeFont(s[role]??"")));for(const key of keys){const uses=measured.filter(s=>normalizeFont(s[role]??"")===key),all=sites.filter(s=>s[role]),allUses=all.filter(s=>normalizeFont(s[role]??"")===key),quarters=new Map<string,{n:number;used:number}>();
   for(const snap of hs.values()){if(scope!=="all"&&sectorOf.get(snap.domain)!==scope)continue;const family=obj(obj(obj(obj(snap.signals)['type'])['rendered'])[role])['family'];if(typeof family!=="string")continue;const q=quarter(snap.captured_at),v=quarters.get(q)??{n:0,used:0};v.n++;if(normalizeFont(family)===key)v.used++;quarters.set(q,v);}
   const series:SeriesPoint[]=[...quarters].map(([q,v])=>({quarter:q,share:v.used/v.n,denom:v.n,coverage:v.n/Math.max(1,subset.length)})).sort((a,b)=>a.quarter.localeCompare(b.quarter)),fit=forecastSeries(series,scope);
   const trendsetterSites=topSites.filter(s=>normalizeFont(s[role]??"")===key).length,vanguard=crawlShare('vanguard',key,role),mainstream=crawlShare('mainstream',key,role);
   usage.push({key,scope,role,data:{sites:uses.length,denom:measured.length,share:uses.length/Math.max(1,measured.length),share_all:allUses.length/Math.max(1,all.length),stage:fit.status==="ok"?fit.stage:null,momentum:fit.status==="ok"?fit.momentum:null,series,trendsetter_sites:trendsetterSites,trendsetter_n:topSites.length,trendsetter_share:topSites.length?trendsetterSites/topSites.length:null,vanguard_spread:vanguard!==null&&mainstream!==null?(vanguard-mainstream)*100:null,used_by:uses.slice(0,5).map(s=>s.domain)}});}}
  const measured=subset.filter(s=>s.accent||s.palette.length),keys=new Set(measured.flatMap(s=>[s.accent,...s.palette].filter((c):c is string=>!!c).map(colorTicker)));
  for(const key of keys){const has=(s:typeof sites[number])=>[s.accent,...s.palette].some(c=>c&&colorTicker(c)===key),uses=measured.filter(has),quarters=new Map<string,{n:number;used:number}>();
   for(const snap of hs.values()){if(scope!=="all"&&sectorOf.get(snap.domain)!==scope)continue;const c=obj(obj(snap.signals)['color']),palette=Array.isArray(c['palette'])?c['palette'].map(p=>obj(p)['hex']):[],hexes=[c['accent'],...palette].filter((v):v is string=>typeof v==="string"&&/^#[\da-f]{6}$/i.test(v));if(!hexes.length)continue;const q=quarter(snap.captured_at),v=quarters.get(q)??{n:0,used:0};v.n++;if(hexes.some(h=>colorTicker(h)===key))v.used++;quarters.set(q,v);}
   const series=[...quarters].map(([q,v])=>({quarter:q,share:v.used/v.n,denom:v.n,coverage:v.n/Math.max(1,subset.length)})).sort((a,b)=>a.quarter.localeCompare(b.quarter)),fit=forecastSeries(series,scope),hexes=[...new Set(uses.flatMap(s=>[s.accent,...s.palette].filter((c):c is string=>!!c&&colorTicker(c)===key)))];
   const distance=(a:string,b:string)=>{const x=oklch(a),y=oklch(b);return Math.hypot(x.L-y.L,x.C-y.C,Math.min(Math.abs(x.h-y.h),360-Math.abs(x.h-y.h))/360);};const medoid=hexes.sort((a,b)=>hexes.reduce((n,x)=>n+distance(a,x)-distance(b,x),0))[0]??null;
   colors.push({key,scope,data:{share:uses.length/Math.max(1,measured.length),sites:uses.length,denom:measured.length,series,stage:fit.status==="ok"?fit.stage:null,momentum:fit.status==="ok"?fit.momentum:null,example_hex:medoid,example_domains:uses.slice(0,5).map(s=>s.domain)}});}
 }
 const pairMap=new Map<string,typeof sites>();for(const s of sites)if(s.h1&&s.body){const key=`${normalizeFont(s.h1)}|${normalizeFont(s.body)}`;pairMap.set(key,[...pairMap.get(key)??[],s]);}
 const pairs=[...pairMap].map(([key,list])=>({key,data:{h1_key:normalizeFont(list[0]?.h1??""),body_key:normalizeFont(list[0]?.body??""),count:list.length,denom:sites.filter(s=>s.h1&&s.body).length,sectors:[...new Set(list.map(s=>s.sector))],domains:list.slice(0,5).map(s=>s.domain),sector_counts:Object.fromEntries(SECTORS.map(scope=>[scope,list.filter(s=>s.sector===scope).length]))}}));
 const palettes=sites.flatMap(s=>{const p=measuredPalette(s);return p?[{domain:s.domain,data:{...p,sector:s.sector,theme:s.theme,mode:s.mode,tags:s.tags,captured_at:s.captured_at}}]:[];});
 const result=await db.rpc("replace_taste_data",{p_catalog:jsonValue(catalog),p_usage:jsonValue(usage),p_pairs:jsonValue(pairs),p_colors:jsonValue(colors),p_palettes:jsonValue(palettes)});if(result.error)throw result.error;return {catalog:catalog.length,usage:usage.length,pairs:pairs.length,colors:colors.length,palettes:palettes.length,unknown:catalog.filter(c=>c.category==="unknown").length};
}