import { supabaseAnon } from "./mcp/supabase";
import { byCrawl } from "./crawl-stamp.server";
// Every tag-share row, read once per instance until the next crawl or tag (`byCrawl`); filters apply in memory, same order and rows
// as the filtered query they replace.
const tagShare=byCrawl(async()=>{const db=supabaseAnon();const rows=[];for(let from=0;;from+=1000){const {data,error}=await db.from("library_tag_share").select("*").order("sector").order("dimension").order("value").range(from,from+999);if(error)throw error;rows.push(...(data??[]));if(!data||data.length<1000)break;}return rows;});
export async function aiTrends(options: { dimension?: string | undefined; sector?: string | undefined }={}) {
 const db=supabaseAnon(); const sector=options.sector ?? "all";
 const dim=options.dimension&&!['pricing','changelog','features'].includes(options.dimension)?options.dimension:null;
 const tags=(await tagShare()).filter(t=>(!options.sector||t.sector===sector)&&(!dim||t.dimension===dim));
 const [pricing,changelog,features,spend,status]=await Promise.all([db.from("library_pricing_stats").select("*").range(0,999),db.from("library_changelog_stats").select("*").range(0,999),db.from("library_feature_themes").select("*").order("sites",{ascending:false}).range(0,999),db.from("ai_spend_summary").select("*").single(),db.from("library_ai_status").select("*").range(0,999)]);
 for(const result of [pricing,changelog,features,spend,status])if(result.error)throw result.error;
 return {tags,pricing:(pricing.data??[]).filter(p=>!options.sector||p.sector===sector),changelog:(changelog.data??[]).filter(p=>!options.sector||p.sector===sector),features:(features.data??[]).filter(p=>!options.sector||p.sector===sector),spend:spend.data,status:status.data??[]};
}
export async function aiSite(domain:string) {
 const db=supabaseAnon();const [tags,extractions]=await Promise.all([db.from("library_ai_tag_history").select("snapshot_id,domain,model,tags,created_at,captured_at").eq("domain",domain).order("captured_at",{ascending:false}).range(0,0),db.from("library_ai_extraction_history").select("snapshot_id,domain,kind,model,data,created_at,captured_at").eq("domain",domain).order("captured_at",{ascending:false}).range(0,999)]);
 if(tags.error)throw tags.error;if(extractions.error)throw extractions.error;
 return {tag:tags.data?.[0]??null,extractions:[...new Map([...(extractions.data??[])].reverse().map(e=>[e.kind,e])).values()]};
}