import { supabaseAnon } from "./mcp/supabase";
import { historyInput } from "./library-history";
import type { z } from "zod";
async function pages<T>(fetchPage:(from:number)=>PromiseLike<{data:T[]|null;error:unknown}>) {
 const rows:T[]=[];for(let from=0;;from+=1000){const {data,error}=await fetchPage(from);if(error)throw error;rows.push(...(data??[]));if(!data||data.length<1000)break;}return rows;
}
export async function libraryHistory(input:z.infer<typeof historyInput>={}) {
 const db=supabaseAnon();
 const signals=()=>pages(from=>{let q=db.from("library_signal_history").select("*").order("bucket").order("sector");if(input.sector)q=q.eq("sector",input.sector);return q.range(from,from+999);});
 const css=()=>pages(from=>{let q=db.from("library_css_history").select("*").order("bucket").order("sector").order("feature");if(input.sector)q=q.eq("sector",input.sector);if(input.value)q=q.eq("feature",input.value);return q.range(from,from+999);});
 const fonts=()=>pages(from=>{let q=db.from("library_font_history").select("*").order("bucket").order("role").order("family");if(input.value)q=q.eq("family",input.value);return q.range(from,from+999);});
 const tags=()=>pages(from=>{let q=db.from("library_tag_history").select("*").order("bucket").order("sector").order("dimension").order("value");if(input.sector)q=q.eq("sector",input.sector);if(input.dimension)q=q.eq("dimension",input.dimension);if(input.value)q=q.eq("value",input.value);return q.range(from,from+999);});
 const [signalRows,cssRows,fontRows,tagRows]=await Promise.all([!input.dimension?signals():[],(!input.dimension||input.dimension==="css")&&!input.metric?css():[],(!input.dimension||input.dimension==="fonts")&&!input.metric?fonts():[],(!input.dimension||!["css","fonts"].includes(input.dimension))&&!input.metric?tags():[]]);
 return {signals:signalRows,css:cssRows,fonts:fontRows,tags:tagRows};
}
