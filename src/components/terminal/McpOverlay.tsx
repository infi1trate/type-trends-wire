import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Overlay } from './primitives';
const ENDPOINT='https://type-trends-wire.lovable.app/api/public/mcp';
const COMMAND=`claude mcp add --transport http dsgn ${ENDPOINT}`;
function CopyLine({label,value}:{label:string;value:string}){
  const [status,setStatus]=useState<'idle'|'copied'|'failed'>('idle');
  return <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 border-b border-rule py-3">
    <div className="min-w-0"><div className="label text-g500">{label}</div><div className="break-all text-ink">{value}</div>{status==='failed'&&<span role="status" className="label text-signal">COPY FAILED</span>}</div>
    <Button variant="ghost" size="icon" className="shrink-0 text-ink" aria-label={`Copy ${label.toLowerCase()}`} title={status==='copied'?'Copied':`Copy ${label.toLowerCase()}`} onClick={async()=>{try{await navigator.clipboard.writeText(value);setStatus('copied');setTimeout(()=>setStatus('idle'),2000);}catch{setStatus('failed');}}}>{status==='copied'?<Check/>:<Copy/>}</Button>
  </div>;
}
export function McpOverlay({onClose}:{onClose:()=>void}){
  return <Overlay title="DSGN-MCP · PUBLIC · READ-ONLY" onClose={onClose}>
    <CopyLine label="ENDPOINT" value={ENDPOINT}/>
    <p className="border-b border-rule py-3 text-ink"><span className="label text-g500">CLAUDE</span><br/>Settings → Connectors → Add custom connector → paste the endpoint</p>
    <CopyLine label="CLAUDE CODE" value={COMMAND}/>
    <p className="py-3 text-ink"><span className="label text-g500">TOOLS</span><br/>get_trend · search_trends · wire · library_site · library_events · library_sector · crawl_spread<br/><span className="label text-g500">RESOURCE</span><br/>trend://methodology</p>
  </Overlay>;
}
