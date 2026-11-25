import { supabaseAnon } from "./mcp/supabase";
import { memo } from "./memo";
import { LAST_GOOD_MS, within } from "./deadline";
import { historyInput } from "./library-history";
import type { z } from "zod";
async function pages<T>(fetchPage:(from:number)=>PromiseLike<{data:T[]|null;error:unknown}>) {
 const rows:T[]=[];for(let from=0;;from+=1000){const {data,error}=await fetchPage(from);if(error)throw error;rows.push(...(data??[]));if(!data||data.length<1000)break;}return rows;
}
/** Terminal fix (23 Nov) · a long list read in pages of 1000: the row count first, then up to six pages at a time (in order), instead of
 *  ~31 pages one after another (4.3 s for the 30,360-row share history, past the reader time limit). Same rows, same order. */
async function pagesCounted<T>(count:()=>PromiseLike<{count:number|null;error:unknown}>,fetchPage:(from:number)=>PromiseLike<{data:T[]|null;error:unknown}>,size=1000,concurrency=6){
 const c=await count();if(c.error)throw c.error;const n=c.count??0;if(!n)return [] as T[];
 const starts=Array.from({length:Math.ceil(n/size)},(_,i)=>i*size),out:T[][]=new Array(starts.length);
 for(let i=0;i<starts.length;i+=concurrency)await Promise.all(starts.slice(i,i+concurrency).map(async(from,k)=>{const {data,error}=await fetchPage(from);if(error)throw error;out[i+k]=data??[];}));
 const rows=out.flat();
 // Rows added after the count are read the old way, so nothing is cut off.
 if(out.at(-1)?.length===size)rows.push(...await pages(from=>fetchPage(starts.length*size+from)));
 return rows;
}
export async function libraryHistory(input:z.infer<typeof historyInput>={}) {
 const db=supabaseAnon();
 const base=(head:boolean)=>{let q=db.from("library_history_share").select("*",head?{count:"exact",head:true}:{});if(input.dimension)q=q.eq("dimension",input.dimension);if(input.value)q=q.eq("value",input.value);if(input.sector)q=q.eq("sector",input.sector);return q;};
 return pagesCounted(()=>base(true),from=>base(false).order("quarter").order("sector").order("dimension").order("value").range(from,from+999));
}
export async function siteHistory(domain:string) {return pages(from=>supabaseAnon().from("library_site_history_rows").select("*").eq("domain",domain).order("quarter").range(from,from+999));}
async function computeDashboard(){const db=supabaseAnon();const [series,fonts,redesigns,captures]=await Promise.all([libraryHistory(),pages(from=>db.from("library_history_fonts").select("*").order("year").order("role").order("rank").range(from,from+999)),panelRedesigns(),db.from("library_snapshots").select("id",{count:"exact",head:true}).eq("source","wayback").eq("page_type","home").eq("viewport","desktop")]);if(captures.error)throw captures.error;return {series,fonts,redesigns,captures:captures.count??0};}

/** The history dashboard changes only when the history job runs: built at most every ten minutes per instance, and a read still
 *  running after LAST_GOOD_MS is answered with the last copy this instance built (Terminal fix, 23 Nov). */
const dashboard = memo(10 * 60_000, computeDashboard);
let lastDashboard: Awaited<ReturnType<typeof computeDashboard>> | null = null;
export async function historyDashboard() {
  const p = dashboard().then(v => { lastDashboard = v; return v; }), had = lastDashboard;
  if (!had) return p;
  return within(p, LAST_GOOD_MS, "library history", () => had).catch(() => had);
}

/** R2a-2 · redesigns per year, sector and source from library_events of panel brands only (library_redesigns joins every row of
 *  library_sites, active or not). Bounded: type = redesign, paged. Same shape and order as the view. */
export async function panelRedesigns(){
 const db=supabaseAnon();
 const [events,{panelDomains}]=await Promise.all([pages(from=>db.from("library_events").select("id,domain,source,detected_at,effective_at").eq("type","redesign").order("id").range(from,from+999)),import("./active-sites.server")]);
 const panel=await panelDomains();
 const sector=new Map<string,string>();
 for(let f=0;;f+=1000){const {data,error}=await db.from("library_sites").select("domain,sector").eq("active",true).order("domain").range(f,f+999);if(error)throw error;for(const r of data??[])sector.set(r.domain,r.sector);if(!data||data.length<1000)break;}
 const {redesignsByYear}=await import("./panel-feed");
 return redesignsByYear(events as never,panel,sector);
}
