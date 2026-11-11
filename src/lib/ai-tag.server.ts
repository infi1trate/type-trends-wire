import { authenticateCrawler } from "./crawl-ingest.server";
import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { tagRequestSchema, reusableTags, cleanTags } from "./ai-schema";
import { inferAI, AiFailure } from "./ai-inference.server";
import { storeAiResult } from "./ai-store.server";
import { AI_LIMITS } from "./ai-models";
import { fingerprint } from "./library";
import { jpegDimensions } from './ai-vision';
export async function readAiBody(request: Request): Promise<string | null> {
 if(Number(request.headers.get("content-length") ?? 0)>AI_LIMITS.body) return null;
 const reader=request.body?.getReader();if(!reader)return "";
 const chunks: Uint8Array[]=[];let size=0;
 try { for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>AI_LIMITS.body){await reader.cancel();return null;}chunks.push(value);} } finally {reader.releaseLock();}
 const all=new Uint8Array(size);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.length;}return new TextDecoder().decode(all);
}
export async function handleLibraryTag(request: Request) {
 try {
  if(!await authenticateCrawler(request))return Response.json({ok:false,code:"unauthorized"},{status:401});
  const body=await readAiBody(request);if(body===null)return Response.json({ok:false,code:"body_too_large"},{status:413});
  let raw:unknown;try{raw=JSON.parse(body);}catch{return Response.json({ok:false,code:"invalid_json"},{status:400});}
  const parsed=tagRequestSchema.safeParse(raw);if(!parsed.success)return Response.json({ok:false,code:"invalid_input"},{status:400});
  const input=parsed.data;
  for(const image of [input.images.fold,...(input.images.page?[input.images.page]:[])]) {
   const size=jpegDimensions(image);if(!size)return Response.json({ok:false,code:'invalid_input'},{status:400});
   if(size.width<200||size.height<200)return Response.json({ok:false,code:'image_too_small'},{status:400});
  }
  const {data:snapshot,error}=await db.from("library_snapshots").select("id,domain,page_type,viewport,captured_at,signals,signals_hash").eq("domain",input.domain).eq("page_type","home").eq("viewport","desktop").eq("source","live").eq("captured_at",input.captured_at).maybeSingle();
  if(error)throw new Error("Snapshot lookup failed");if(!snapshot)return Response.json({ok:false,code:"snapshot_not_found"},{status:404});
  if(snapshot.signals_hash!==input.signals_hash)return Response.json({ok:false,code:"signals_hash_mismatch"},{status:409});
  const {data:previous,error:reuseError}=await db.from("library_tags").select("domain,signals_hash,created_at,tags,model").eq("domain",input.domain).eq("signals_hash",input.signals_hash).gte("created_at",new Date(Date.now()-60*86400000).toISOString()).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(reuseError)throw new Error("Tag reuse lookup failed");
  if(previous&&reusableTags(previous,input.domain,input.signals_hash)) {const tags=cleanTags(previous.tags);await storeAiResult(snapshot,"vision",previous.model,tags);return Response.json({ok:true,reused:true,tags});}
  const f=fingerprint(snapshot.signals);const {data:site}=await db.from("library_sites").select("sector").eq("domain",input.domain).single();
  const result=await inferAI({snapshot_id:snapshot.id,kind:"vision",captured_at:input.captured_at,context:JSON.stringify({domain:input.domain,sector:site?.sector,headline:f.h1,h1_font:f.h1_family,body_font:f.body_family,theme:f.theme}),images:[input.images.fold,...(input.images.page?[input.images.page]:[])]});
  await storeAiResult(snapshot,"vision",result.model,result.data);
  return Response.json({ok:true,reused:false,tags:result.data});
 } catch(error) {return Response.json({ok:false,code:error instanceof AiFailure?error.code:"internal_error"},{status:error instanceof AiFailure?error.http:500});}
}