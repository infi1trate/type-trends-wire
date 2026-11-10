// Run once with the project's injected server environment; never on page load/deploy.
import { supabaseAdmin } from '../src/integrations/supabase/client.server';
import { decodeEntities } from '../src/lib/entities';
let changed=0,scanned=0;
for(let from=0;;from+=1000){
  const {data,error}=await supabaseAdmin.from('wire_items').select('id,title,excerpt').order('id').range(from,from+999);
  if(error)throw error;
  for(const row of data ?? []){
    scanned++;
    const title=decodeEntities(row.title),excerpt=row.excerpt===null?null:decodeEntities(row.excerpt);
    if(title===row.title && excerpt===row.excerpt)continue;
    const {error}=await supabaseAdmin.from('wire_items').update({title,excerpt}).eq('id',row.id).eq('title',row.title);
    if(error)throw error;changed++;
  }
  if(!data || data.length<1000)break;
}
console.log(JSON.stringify({scanned,changed}));
