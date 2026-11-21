import { supabaseAnon } from "./mcp/supabase";
import { historyInput } from "./library-history";
import type { z } from "zod";
async function pages<T>(fetchPage:(from:number)=>PromiseLike<{data:T[]|null;error:unknown}>) {
 const rows:T[]=[];for(let from=0;;from+=1000){const {data,error}=await fetchPage(from);if(error)throw error;rows.push(...(data??[]));if(!data||data.length<1000)break;}return rows;
}
export async function libraryHistory(input:z.infer<typeof historyInput>={}) {
 const db=supabaseAnon();
 return pages(from=>{let q=db.from("library_history_share").select("*").order("quarter").order("sector").order("dimension").order("value");if(input.dimension)q=q.eq("dimension",input.dimension);if(input.value)q=q.eq("value",input.value);if(input.sector)q=q.eq("sector",input.sector);return q.range(from,from+999);});
}
export async function siteHistory(domain:string) {return pages(from=>supabaseAnon().from("library_site_history_rows").select("*").eq("domain",domain).order("quarter").range(from,from+999));}
export async function historyDashboard(){const db=supabaseAnon();const [series,fonts,redesigns,captures]=await Promise.all([libraryHistory(),pages(from=>db.from("library_history_fonts").select("*").order("year").order("role").order("rank").range(from,from+999)),pages(from=>db.from("library_redesigns").select("*").order("year").order("sector").order("source").range(from,from+999)),db.from("library_snapshots").select("id",{count:"exact",head:true}).eq("source","wayback").eq("page_type","home").eq("viewport","desktop")]);if(captures.error)throw captures.error;return {series,fonts,redesigns,captures:captures.count??0};}
