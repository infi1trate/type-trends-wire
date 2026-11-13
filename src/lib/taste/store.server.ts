import { supabaseAnon } from "../mcp/supabase";
import { obj, fingerprint, str, hex } from "../library";
import { siteTraits } from "../forecast-signals";
import { normalizeFont } from "../library-diff";
import { colorTicker, contrast } from "./color";
import {cached} from "./cache.server";
export async function pages<T>(f:(from:number)=>PromiseLike<{data:T[]|null;error:unknown}>){const rows:T[]=[];for(let n=0;;n+=1000){const r=await f(n);if(r.error)throw r.error;rows.push(...r.data??[]);if(!r.data||r.data.length<1000)break;}return rows;}
export type TasteSite={domain:string;sector:string;captured_at:string;mode:"library"|"crawl"|"lite"|"image";h1:string|null;body:string|null;traits:string[];bg:string|null;fg:string|null;accent:string|null;palette:string[];theme:string|null;tags:Record<string,unknown>;note?:string};
export function siteFromSignals(domain:string,sector:string,captured_at:string,signals:unknown,tags:unknown={},mode:TasteSite["mode"]="library"):TasteSite{
  const fp=fingerprint(signals), s=obj(signals), t=obj(tags), valid=t['low_confidence']!==true&&!t['blocked_reason']&&Number(t['confidence']??1)>=.4?t:{};
  const h1=fp.h1_family??str(obj(obj(obj(s['type'])['declared'])['h1'])['family']),body=fp.body_family??str(obj(obj(obj(s['type'])['declared'])['body'])['family']);
  const traits=siteTraits({domain,sector,quarter:"",theme:fp.theme,h1_family:h1,webfont:fp.body_webfont,h1_tracking:fp.h1_tracking,hero_media:fp.hero,css_features:fp.css_features,frameworks:s['tech'],ai_tags:valid});
  if(h1)traits.push(`h1_font:${normalizeFont(h1)}`);if(body)traits.push(`body_font:${normalizeFont(body)}`);
  if(fp.theme==="light")traits.push("theme:light");if(fp.accent)traits.push(`accent:${colorTicker(fp.accent)}`);
  for(const word of new Set((fp.h1??"").toLowerCase().match(/[a-z]{3,}/g)??[]))if(!["the","and","for","with","your","you","our"].includes(word))traits.push(`h1_word:${word}`);
  const colors=obj(s['color']);return {domain,sector,captured_at,mode,h1,body,traits:[...new Set(traits)],bg:fp.page_bg,fg:hex(colors['page_fg']??colors['foreground']??colors['text_color']),accent:fp.accent,palette:fp.palette.map(p=>p.hex).filter((x):x is string=>x!==null),theme:fp.theme,tags:valid};
}
export async function loadTasteSites(){
  const db=supabaseAnon();const [sites,snaps,tags,latest,extractions]=await Promise.all([
    pages(f=>db.from("library_sites").select("domain,sector").eq("active",true).order("domain").range(f,f+999)),
    pages(f=>db.from("library_snapshots").select("id,domain,captured_at,signals").eq("source","live").eq("page_type","home").eq("viewport","desktop").order("captured_at",{ascending:false}).order("id",{ascending:false}).range(f,f+999)),
    pages(f=>db.from("library_tags").select("snapshot_id,tags").order("snapshot_id").range(f,f+999)),
    db.from("crawl_latest").select("id").limit(1),
    pages(f=>db.from("library_ai_extraction_history").select("domain,kind,data,captured_at").eq("kind","pricing").order("captured_at",{ascending:false}).order("domain").range(f,f+999))]);
  if(latest.error)throw latest.error;
  const sectors=new Map(sites.map(s=>[s.domain,s.sector])),tagMap=new Map(tags.map(t=>[t.snapshot_id,t.tags])),map=new Map<string,TasteSite>();
  for(const s of snaps)if(sectors.has(s.domain)&&!map.has(s.domain))map.set(s.domain,siteFromSignals(s.domain,sectors.get(s.domain)??"unknown",s.captured_at,s.signals,tagMap.get(s.id)));
  const seen=new Set<string>();for(const e of extractions)if(e.domain&&!seen.has(e.domain)){seen.add(e.domain);const site=map.get(e.domain);if(site)for(const flag of ['has_free_tier','has_trial','has_usage_based','has_ai_addon','ai_credits_model'])if(obj(e.data)[flag]===true)site.traits.push(`pricing:${flag}`);}
  const id=latest.data?.[0]?.id;
  if(id){const crawl=await pages(f=>db.from("crawl_sites").select("domain,type,color,layout,tech,lexicon,crawled_at,index_name").eq("run_id",id).eq("ok",true).order("domain").order("index_name").range(f,f+999));for(const s of crawl)if(!map.has(s.domain))map.set(s.domain,siteFromSignals(s.domain,sectors.get(s.domain)??"unknown",s.crawled_at,{type:s.type,color:s.color,layout:s.layout,tech:s.tech,lexicon:s.lexicon},{},"crawl"));}
  return [...map.values()];
}
async function loadTasteData(){const db=supabaseAnon();const [sites,catalog,usage,pairs,colors,history,forecasts,setters,card]=await Promise.all([
  loadTasteSites(),pages(f=>db.from("font_catalog").select("*").order("key").range(f,f+999)),pages(f=>db.from("font_usage").select("*").order("key").order("scope").order("role").range(f,f+999)),pages(f=>db.from("font_pairs").select("*").order("key").range(f,f+999)),pages(f=>db.from("color_tickers").select("*").order("key").order("scope").range(f,f+999)),cached("era-history",new Date().toISOString().slice(0,10),()=>pages(f=>db.from("library_history_share").select("quarter,dimension,value,share,coverage,denom").eq("sector","all").in("dimension",['theme','headline','font','tracking','hero_media','css','framework','imagery','aesthetic','components','hero_layout','ai_positioning','tone','color_mood']).order("quarter").order("dimension").order("value").range(f,f+999))),pages(f=>db.from("forecast_latest").select("dimension,value,scope,stage,current_share,momentum,components,next_wave_score").order("scope").order("dimension").order("value").range(f,f+999)),db.from("trendsetters_latest").select("domain,rank").order("rank").limit(30),db.from("forecast_model_card").select("model_card,data_cutoff_quarter").maybeSingle()]);
  if(setters.error||card.error)throw setters.error??card.error;const top=setters.data?.map(s=>s.domain)??[];return {sites,catalog,usage,pairs,colors,history,forecasts,setters:top,receipts:{sources:["DSGN Library + weekly crawl","Google Fonts catalog","quarterly live + Internet Archive","latest forecast run"],sample_sizes:{sites:sites.length,library:sites.filter(s=>s.mode==="library").length,trendsetters:top.length},data_through:sites.map(s=>s.captured_at).sort().at(-1)??null,model_card:card.data?.model_card??null,method:"trend://methodology#TASTE_TOOLS"}};
}
export async function tasteData(){const data=await cached('taste-data',new Date().toISOString().slice(0,10),loadTasteData);return {...data,top:new Set(data.setters)};}
export function measuredPalette(s:TasteSite){if(!s.bg||!s.accent)return null;const candidates=s.palette.filter(c=>c!==s.bg&&c!==s.accent).sort((a,b)=>contrast(s.bg??"#000000",b)-contrast(s.bg??"#000000",a));const fg=s.fg??candidates[0];if(!fg)return null;return {bg:s.bg,fg,accent:s.accent,support:s.palette.filter(c=>![s.bg,fg,s.accent].includes(c)).slice(0,2),fg_measured:Boolean(s.fg),contrast_bg_fg:contrast(s.bg,fg),tickers:[...new Set([s.accent,...s.palette].map(colorTicker))]};}