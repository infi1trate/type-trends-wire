import { pagedRows } from "./paged";
import type { BrandTag } from "./brand-page";
import { forecastSiteTraits, type SiteRow } from "./forecast-signals";
import { classOf } from "./categories";
import { plainFace, type Face } from "./brand-page";
import { COLLECTIONS } from "./collections/registry";
import { STRUCTURE_BY_KEY, type RecordRow } from "./structure";
import type { KitRecord } from "./designer-kit";
import { label, basis } from "./labels";
import { reliableVision } from "./ai-vision";
import { allStories } from "./read.server";
const obj = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const str = (v: unknown) => typeof v === "string" ? v : null;
const num = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? v : null;
type History = SiteRow & { now: boolean; captured_at: string | null; snapshot_id: number | null; body_family: string | null; accent: string | null };
export async function refreshDesignerKit(): Promise<{ ok: boolean; brands: number; code?: string }> {
  const [{ supabaseAdmin: db }, { supabaseAnon }, { historyRows }] = await Promise.all([import("@/integrations/supabase/client.server"), import("./mcp/supabase"), import("./history.server")]);
  const anon = supabaseAnon(), start = Date.now();
  const [history, sites, changes] = await Promise.all([historyRows<History>(anon, "*"), pagedRows((f, t) => anon.from("library_sites").select("domain,name,sector,category,subcategory,active,last_change_at").order("domain").range(f, t)), allStories()]);
  if (sites.error) return { ok: false, brands: 0, code: "kit_sites_failed" };
  const structure: RecordRow[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const r = await anon.from("library_structure_records").select("domain,viewport,quarter,captured_at,source,record,flags,snapshot_id,structure_read").order("domain").order("quarter").order("viewport").range(from, from + 999);
    if (r.error) return { ok: false, brands: 0, code: "kit_structure_failed" };
    structure.push(...r.data as unknown as RecordRow[]);
    if (r.data.length < 1000) break;
  }
  const current = new Map(history.filter(h => h.now).map(h => [h.domain,h]));
  const traitsFor = (h: History) => { const ai=obj(h.ai_tags); return forecastSiteTraits(reliableVision({confidence:num(ai["confidence"])??0,blocked_reason:str(ai["blocked_reason"]),low_confidence:ai["low_confidence"]===true})?h:{...h,ai_tags:null}); };
  const first = new Map<string, Record<string,string>>();
  const note = (domain: string, key: string, at: string) => { let dates=first.get(domain); if (!dates) { dates={}; first.set(domain,dates); } if (!dates[key] || at < dates[key]) dates[key]=at; };
  for (const h of history) if (h.captured_at) for (const key of traitsFor(h)) note(h.domain,key,h.captured_at);
  for (const r of structure) for (const [key,yes] of Object.entries(r.flags)) if (yes && STRUCTURE_BY_KEY.has(key)) note(r.domain,key,r.captured_at);
  const latest = new Map<string,RecordRow>();
  for (const r of structure) { const k=`${r.domain}|${r.viewport}`, old=latest.get(k); if (!old || r.captured_at > old.captured_at) latest.set(k,r); }
  const ids = history.filter(h => h.now && h.snapshot_id != null).map(h => h.snapshot_id).filter((i): i is number => i != null);
  const snaps = new Map<number,{ type: unknown; color: unknown }>();
  for (let i=0;i<ids.length;i+=50) {
    if (Date.now()-start>22000) return {ok:false,brands:0,code:"kit_budget"};
    const r=await anon.from("library_snapshots").select("id,type:signals->type,color:signals->color").in("id",ids.slice(i,i+50));
    if(r.error) return {ok:false,brands:0,code:"kit_identity_failed"};
    for(const s of r.data ?? []) snaps.set(s.id,s);
  }
  const families=[...new Set(history.flatMap(h=>[h.h1_family,h.body_family]).filter((f):f is string=>!!f))];
  const g=await anon.from("font_catalog").select("family").eq("source","google").in("family",families);
  if(g.error) return {ok:false,brands:0,code:"kit_fonts_failed"};
  const google=new Set((g.data??[]).map(r=>r.family));
  const records:KitRecord[]=(sites.data??[]).filter(s=>s.active).flatMap(s=>{
    const h=current.get(s.domain); if(!h?.captured_at) return [];
    const snap=h.snapshot_id != null ? snaps.get(h.snapshot_id) : null, t=obj(snap?.type), color=obj(snap?.color), rendered=obj(t["rendered"]), declared=obj(t["declared"]);
    const face=(role:string,family:string|null,size:number|null):Face|null=>{const f=str(obj(rendered[role])["family"])??family;return f?{family:plainFace(f),google:google.has(f),size:num(obj(declared[role])["size_px"])??size,css:null}:null;};
    const palette=Array.isArray(color["palette"])?color["palette"].flatMap(p=>{const v=obj(p), hex=str(v["hex"]);return hex&&/^#[0-9a-f]{3,8}$/i.test(hex)?[{hex,name:hex,share:num(v["share"])}]:[];}):[];
    const desktop=latest.get(`${s.domain}|desktop`), phone=latest.get(`${s.domain}|mobile`);
    const traits=[...new Set([...traitsFor(h), ...[desktop,phone].flatMap(r=>r?Object.entries(r.flags).filter(([k,v])=>v===true&&STRUCTURE_BY_KEY.get(k)?.viewports.includes(r.viewport)).map(([k])=>k):[])])];
    const h1=face("h1",h.h1_family??null,h.h1_size_px??null), body=face("body",h.body_family,null);
    const tags = traits.flatMap(key => { const kind = key.split(":")[0]; return kind === "aesthetic" || kind === "imagery" || kind === "tone" || kind === "theme" ? [{ key, name: label(key).name, basis: basis(key), kind: kind as BrandTag["kind"] }] : []; });
    const last=changes.stories.filter(c=>c.domains.includes(s.domain)).sort((a,b)=>b.at.localeCompare(a.at))[0];
    return [{name:s.name??s.domain,domain:s.domain,sector:s.sector,...classOf(s),headline:h1?.family??null,body:body?.family??null,theme:h.theme??null,accent:h.accent,ask:desktop?.record.primary_ask??null,captured:h.captured_at,identity:{h1,body,theme:h.theme??null,accent:h.accent?{hex:h.accent,name:h.accent}:null,palette,tags,layout:[],receipt:`/brands/${s.domain}?view=data`},traits,firstSeen:first.get(s.domain)??{},structure:desktop?.record??null,phone:phone?.record??null,lastChange:last?{at:last.at,text:last.headline}:s.last_change_at?{at:s.last_change_at,text:"Latest recorded change"}:null,collections:COLLECTIONS.filter(c=>(!c.filter.sectors.length||c.filter.sectors.includes(s.sector))&&(!c.filter.pattern||history.some(x=>x.domain===s.domain&&traitsFor(x).includes(c.filter.pattern??"")))&&(!c.filter.changed||!!s.last_change_at&&Date.parse(s.last_change_at)>=Date.now()-c.filter.changed*864e5)).map(c=>c.slug)}];
  });
  const at=new Date().toISOString();
  const w=await db.from("brand_kit_records").upsert(records.map(r=>({domain:r.domain,payload:r as never,computed_at:at})));
  if(w.error) return {ok:false,brands:0,code:"kit_write_failed"};
  const removed=await db.from("brand_kit_records").delete().lt("computed_at",at);
  return {ok:!removed.error,brands:records.length};
}