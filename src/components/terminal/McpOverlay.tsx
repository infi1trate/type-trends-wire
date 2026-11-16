import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Overlay } from './primitives';
import { BRAND_NAME } from "@/lib/brand";
import { SITE_URL } from "@/lib/site";
const ENDPOINT=`${SITE_URL}/api/public/mcp`;
const COMMAND=`claude mcp add --transport http ${BRAND_NAME} ${ENDPOINT}`;
function CopyLine({label,value}:{label:string;value:string}){
  const [status,setStatus]=useState<'idle'|'copied'|'failed'>('idle');
  return <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 border-b border-rule py-3">
    <div className="min-w-0"><div className="label text-g500">{label}</div><div className="break-all text-ink">{value}</div>{status==='failed'&&<span role="status" className="label text-signal">COPY FAILED</span>}</div>
    <Button variant="ghost" size="icon" className="shrink-0 text-ink" aria-label={`Copy ${label.toLowerCase()}`} title={status==='copied'?'Copied':`Copy ${label.toLowerCase()}`} onClick={async()=>{try{await navigator.clipboard.writeText(value);setStatus('copied');setTimeout(()=>setStatus('idle'),2000);}catch{setStatus('failed');}}}>{status==='copied'?<Check/>:<Copy/>}</Button>
  </div>;
}
export function McpOverlay({onClose}:{onClose:()=>void}){
  return <Overlay title="MCP SERVER · PUBLIC · READ-ONLY" onClose={onClose}>
    <CopyLine label="ENDPOINT" value={ENDPOINT}/>
    <p className="border-b border-rule py-3 text-ink"><span className="label text-g500">CLAUDE</span><br/>Settings → Connectors → Add custom connector → paste the endpoint</p>
    <CopyLine label="CLAUDE CODE" value={COMMAND}/>
    <CopyLine label="CURSOR · MCP CONFIG" value={JSON.stringify({mcpServers:{[BRAND_NAME]:{url:ENDPOINT}}},null,2)}/>
    <div className="space-y-2 border-b border-rule py-3">{[['recommend_type',{sector:'fintech',role:'headline'}],['recommend_palette',{sector:'ai',theme:'dark'}],['differentiate',{sector:'dev-tools'}],['critique',{url:'https://linear.app'}]].map(([name,input])=><p key={String(name)} className="break-all"><span className="label text-g500">{String(name)}</span><br/>{JSON.stringify(input)}</p>)}</div>
    <section aria-labelledby="mcp-keys" className="space-y-2 border-b border-rule py-3 text-ink">
      <h3 id="mcp-keys" className="label text-g500">USING A KEY</h3>
      <p className="t-say">No key needed: the endpoint is open at 60 requests a minute per connection. A key raises that to its own limit (600 a minute by default) and is counted per key, not per connection.</p>
      <CopyLine label="HEADER" value="Authorization: Bearer dsgn_…"/>
      <p className="t-say text-g500">An unknown or revoked key gets 401. Keys are issued by the owner; ask the owner for one. Only a fingerprint of each key is stored, so a lost key can't be shown again; it gets replaced.</p>
    </section>
    <p className="py-3 text-ink"><span className="label text-g500">TOOLS</span><br/>get_trend · search_trends · wire · library_site · library_events · library_sector · crawl_spread · library_trends · library_history · site_history · forecast · next_wave · trendsetters · weekly_brief · recommend_type · recommend_palette · differentiate · critique · rebrands · vibe_map · audit_sites · watchlist_changes · forecast_ledger<br/><span className="label text-g500">RESOURCE</span><br/>trend://methodology</p>
  </Overlay>;
}
