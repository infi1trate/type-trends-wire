import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { libraryHistoryQuery } from "@/lib/data";
import { HISTORY_METRICS, type HistoryPoint } from "@/lib/library-history";
import { SECTORS } from "@/lib/library";
import { Button } from "@/components/ui/button";
import { LibraryBand } from "./LibraryShared";
type Plot = {key:string;label:string;points:HistoryPoint[];pixels?:boolean};
export function HistorySpark({points,large=false,selected="all"}:{points:HistoryPoint[];large?:boolean;selected?:string}) {
 const valid=points.filter(p=>p.value!==null),dates=[...new Set(points.map(p=>p.bucket))].sort();
 const max=Math.max(1,...valid.map(p=>p.value??0));
 const x=(d:string)=>12+dates.indexOf(d)/Math.max(1,dates.length-1)*576;
 const y=(v:number)=>148-v/max*136;
 const sectors=[...new Set(points.map(p=>p.sector))];
 return <svg viewBox="0 0 600 164" className={`block w-full ${large?"h-64":"h-16"}`} role="img" aria-label={`History from ${dates[0]??2021} to ${dates.at(-1)??"now"}`}>
  <line x1="12" x2="588" y1="148" y2="148" stroke="var(--rule)"/>
  {sectors.map((sector,index)=>{const rows=points.filter(p=>p.sector===sector).sort((a,b)=>a.bucket.localeCompare(b.bucket));return <g key={sector} stroke={sector===selected?"var(--signal)":"var(--compare-muted)"} opacity={sector===selected?1:Math.max(.3,1-index*.06)} fill="none">{rows.map((p,i)=>{const before=rows[i-1];return before&&before.value!==null&&p.value!==null?<line key={p.bucket} x1={x(before.bucket)} y1={y(before.value)} x2={x(p.bucket)} y2={y(p.value)} strokeWidth={large?2:3} strokeDasharray={p.coverage<.3||before.coverage<.3?"6 5":undefined}><title>{sector} · {p.bucket} · {p.value.toFixed(3)} · coverage {(p.coverage*100).toFixed(0)}%</title></line>:null;})}{rows.filter(p=>p.value!==null).map(p=><circle key={p.bucket} cx={x(p.bucket)} cy={y(p.value??0)} r="3"><title>{sector} · {p.bucket} · {p.value} · coverage {(p.coverage*100).toFixed(0)}%</title></circle>)}</g>;})}
 </svg>;
}
export function LibraryHistory({sector}:{sector:string}) {
 const {data}=useSuspenseQuery(libraryHistoryQuery());const [selected,setSelected]=useState<string|null>(null);const [hidden,setHidden]=useState<string[]>([]);
 const plots:Plot[]=HISTORY_METRICS.map(metric=>({key:metric,label:metric.replaceAll("_"," ").toUpperCase(),pixels:metric==="median_h1_px",points:data.signals.map(r=>({bucket:r.bucket??"",sector:r.sector??"all",value:r[metric],coverage:r.coverage??0}))}));
 for(const feature of [...new Set(data.css.map(r=>r.feature))])if(feature)plots.push({key:`css:${feature}`,label:`CSS · ${feature.toUpperCase()}`,points:data.css.filter(r=>r.feature===feature).map(r=>({bucket:r.bucket??"",sector:r.sector??"all",value:r.share,coverage:r.coverage??0}))});
 const topTags=[...new Map(data.tags.filter(r=>r.sector==="all").sort((a,b)=>(b.share??0)-(a.share??0)).map(r=>[`${r.dimension}:${r.value}`,r])).values()].slice(0,12);
 for(const tag of topTags)plots.push({key:`tag:${tag.dimension}:${tag.value}`,label:`AI · ${tag.dimension} / ${tag.value}`,points:data.tags.filter(r=>r.dimension===tag.dimension&&r.value===tag.value).map(r=>({bucket:r.bucket??"",sector:r.sector??"all",value:r.share,coverage:r.coverage??0}))});
 const detail=plots.find(p=>p.key===selected);const lines=(sector==="all"?SECTORS:[sector,...SECTORS.filter(s=>s!==sector)]).slice(0,10);
 const current=(plot:Plot)=>{const rows=plot.points.filter(p=>p.sector===sector).sort((a,b)=>a.bucket.localeCompare(b.bucket));const last=rows.at(-1),first=rows.find(r=>r.bucket.startsWith("2021")&&r.value!==null);const delta=last?.value!=null&&first?.value!=null?(last.value-first.value)*(plot.pixels?1:100):null;return `${last?.value==null?"—":plot.pixels?`${last.value.toFixed(0)} PX`:`${(last.value*100).toFixed(1)}%`} · ${delta==null?"—":`${delta>=0?"+":""}${delta.toFixed(1)} ${plot.pixels?"PX":"PTS"}`}`;};
 const fonts=[...new Set(data.fonts.filter(r=>r.role==="h1").sort((a,b)=>(b.sites??0)-(a.sites??0)).map(r=>r.family))].filter((f):f is string=>!!f).slice(0,15);
 return <LibraryBand title={`HISTORY · 2021 → NOW · ${sector}`}>
  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">{plots.map(plot=><Button key={plot.key} variant="ghost" className="h-auto min-w-0 flex-col items-stretch border-b border-r border-rule p-3 text-left whitespace-normal [&_svg]:size-auto [&_svg]:h-16 [&_svg]:w-full" aria-label={`Open history chart ${plot.label}`} onClick={()=>{setSelected(plot.key);setHidden([]);}}><span className="label break-words text-compare-muted">{plot.label}</span><HistorySpark points={plot.points.filter(p=>p.sector===sector)} selected={sector}/><span className="label">{current(plot)}</span></Button>)}</div>
  {detail&&<section className="border-b border-rule p-3" aria-label="Expanded history chart"><div className="flex items-center justify-between gap-2"><h3 className="label">{detail.label}</h3><Button variant="ghost" size="icon" aria-label="Close history chart" onClick={()=>setSelected(null)}>×</Button></div><HistorySpark large selected={sector} points={detail.points.filter(p=>lines.includes(p.sector)&&!hidden.includes(p.sector))}/><div className="flex flex-wrap gap-2" role="group" aria-label="History chart sector legend">{lines.map(s=><Button variant="ghost" key={s} className={`label h-8 ${s===sector?"text-signal":"text-compare-muted"}`} aria-pressed={!hidden.includes(s)} onClick={()=>setHidden(old=>old.includes(s)?old.filter(v=>v!==s):[...old,s])}>{s}{hidden.includes(s)?" ○":" ●"}</Button>)}</div><div className="label flex justify-between text-compare-muted"><span>2021</span><span>NOW</span></div></section>}
  <h3 className="label border-b border-rule p-3">TYPE OVER TIME · H1 · ALL SECTORS</h3><table className="w-full table-fixed text-label"><thead><tr><th className="p-3 text-left">FAMILY</th><th className="p-3 text-left">2021 → NOW</th><th className="w-20 p-3 text-right">SHARE</th></tr></thead><tbody>{fonts.map(family=>{const rows=data.fonts.filter(r=>r.family===family&&r.role==="h1").sort((a,b)=>(a.bucket??"").localeCompare(b.bucket??""));return <tr key={family} className="border-t border-rule"><td className="break-words p-3">{family}</td><td><HistorySpark selected="none" points={rows.map(r=>({bucket:r.bucket??"",value:r.share,sector:"all",coverage:r.coverage??0}))}/></td><td className="p-3 text-right">{rows.at(-1)?.share==null?"—":`${((rows.at(-1)?.share??0)*100).toFixed(1)}%`}</td></tr>;})}</tbody></table>
 </LibraryBand>;
}