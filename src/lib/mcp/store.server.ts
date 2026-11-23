import { supabaseAnon } from './supabase';
import type { FontRow } from './analysis';
const FONT = 'captured_on,family,category,popularity_rank,trending_rank,is_variable';
const clean = (s: string) => s.replace(/[%_,()*]/g,'').trim();
export async function latestFontDate() {
  const { data,error } = await supabaseAnon().from('gfont_snapshots').select('captured_on').order('captured_on',{ascending:false}).limit(1);
  if (error) throw error; return data?.[0]?.captured_on ?? null;
}
export async function fontSnapshot(onOrBefore: string) {
  const db = supabaseAnon();
  const {data,error} = await db.from('gfont_snapshots').select('captured_on').lte('captured_on',onOrBefore).order('captured_on',{ascending:false}).limit(1);
  if (error) throw error; const date = data?.[0]?.captured_on; if (!date) return null;
  const rows: FontRow[] = [];
  for (let from=0;;from+=1000) { const {data:page,error} = await db.from('gfont_snapshots').select(FONT).eq('captured_on',date).order('popularity_rank').order('family').range(from,from+999);
    if (error) throw error; rows.push(...(page ?? [])); if (!page || page.length<1000) break; }
  return {date,rows};
}
export async function fontHistory(name: string, sinceDate: string) {
  const latest = await latestFontDate(), fragment = clean(name); if (!latest || !fragment) return [];
  const db = supabaseAnon(); let family: string | undefined;
  for (const pattern of [fragment,`${fragment}%`,`%${fragment}%`]) {
    const {data,error} = await db.from('gfont_snapshots').select('family').eq('captured_on',latest).ilike('family',pattern).order('popularity_rank').limit(1);
    if (error) throw error; family=data?.[0]?.family; if (family) break;
  }
  if (!family) return [];
  const {data,error} = await db.from('gfont_snapshots').select(FONT).eq('family',family).gte('captured_on',sinceDate).order('captured_on').limit(1000);
  if (error) throw error; return data ?? [];
}
export async function familySuggestions(fragment: string, limit: number) {
  const latest=await latestFontDate(), q=clean(fragment).slice(0,3); if (!latest || !q) return [];
  const {data,error}=await supabaseAnon().from('gfont_snapshots').select('family').eq('captured_on',latest).ilike('family',`%${q}%`).order('popularity_rank').limit(limit);
  if (error) throw error; return (data ?? []).map(r=>r.family);
}
export async function wire(opts: {query?:string | undefined;tag?:string | undefined;source?:string | undefined;source_kind?:string | undefined;sinceIso:string;limit:number}) {
  let q=supabaseAnon().from('wire_items').select('url,title,source,source_kind,published_at,excerpt,link,tags,ref,votes,topics').gte('published_at',opts.sinceIso);
  if (opts.source_kind) q=q.eq('source_kind',opts.source_kind);
  if (opts.tag) q=q.contains('tags',[opts.tag]);
  const source=clean(opts.source ?? ''), query=clean(opts.query ?? '');
  if (source) q=q.ilike('source',`%${source}%`);
  if (query) q=q.or(`title.ilike.%${query}%,excerpt.ilike.%${query}%`);
  const {data,error}=await q.order('published_at',{ascending:false}).limit(opts.limit); if(error) throw error;
  // PH1 · launches under the line stay stored wire items only.
  const { wireShown } = await import('../launches'); return (data ?? []).filter(wireShown).map(({votes:_v,topics:_t,...r})=>r);
}
