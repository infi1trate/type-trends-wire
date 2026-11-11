import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { typeIndexQuery, type CrawlData } from "@/lib/data";
import { compare, median, percent, spreadText, type IndexFilter } from "@/lib/crawl";
import { useIsMobile } from "@/hooks/use-mobile";
import { CrawlControls, CrawlState, Toggle } from "./CrawlControls";
import { CompareBlock, Scatter, comparisonRows, indexClass, shownIndexes } from "./CrawlCharts";
import { PanelHeader } from "./primitives";

export function CrawlPanel({panel}:{panel:"color"|"layout"|"composition"|"lexicon"}) {
  const [index,setIndex]=useState<IndexFilter>("BOTH");
  return <section className="crawler flex min-h-0 flex-1 flex-col" aria-label={panel}>
    <PanelHeader title={{color:"F3 COLOR",layout:"F4 LAYOUT",composition:"F5 COMPOSITION",lexicon:"F6 LEXICON"}[panel]}/>
    <CrawlControls index={index} onIndex={setIndex}/>
    <div className="min-h-0 flex-1 md:overflow-y-auto"><CrawlState>{data=>panel==="color"?<Color data={data} index={index}/>:panel==="layout"?<Layout data={data} index={index}/>:panel==="composition"?<Composition data={data} index={index}/>:<Lexicon data={data} index={index}/>}</CrawlState></div>
  </section>;
}
function Color({data,index}:{data:CrawlData;index:IndexFilter}) {
  const mobile=useIsMobile();
  const sites=data.sites.filter(s=>shownIndexes(index).includes(s.index_name)).sort((a,b)=>(b.color.mean_luminance??0)-(a.color.mean_luminance??0)).slice(0,mobile?120:300);
  return <div className="flex min-h-full flex-col">
    <div className="grid border-b border-rule md:grid-cols-2">{shownIndexes(index).map(i=>{const row=data.colors.find(r=>r.index_name===i);return <div key={i} className="border-r border-rule p-3"><h3 className={`label mb-2 ${indexClass(i)}`}>{i}</h3><dl className="grid grid-cols-3 gap-2">{[["DARK THEME",percent(row?.dark_share)],["AVG WHITESPACE",percent(row?.avg_whitespace)],["BODY CONTRAST",row?.median_body_contrast==null?"—":`${row.median_body_contrast.toFixed(1)}:1`]].map(([k,v])=><div key={k}><dt className="label text-compare-muted">{k}</dt><dd className="text-hero">{v}</dd></div>)}</dl></div>;})}</div>
    <div className="grid min-h-0 flex-1 xl:grid-cols-12">
      <section className="border-r border-rule p-3 xl:col-span-7"><h3 className="label mb-4 text-compare-muted">ACCENTS</h3>{shownIndexes(index).map(i=>{const raw=data.colors.find(r=>r.index_name===i)?.accent_top;const accents=Array.isArray(raw)?raw.filter((r):r is {hex:string;count:number}=>!!r&&typeof r==="object"&&!Array.isArray(r)&&typeof r["hex"]==="string"&&typeof r["count"]==="number"):[];return <div key={i} className="mb-6"><h4 className={`label mb-3 ${indexClass(i)}`}>{i}</h4><div className="grid grid-cols-6 gap-x-2 gap-y-4 2xl:grid-cols-12">{accents.map(a=><div key={a.hex} className="min-w-0"><div className="h-10 w-10 border border-rule" style={{backgroundColor:a.hex}}/><div className="label mt-1 text-compare-muted">{a.hex}</div><div className="label text-compare-muted">{a.count}</div></div>)}</div></div>;})}</section>
      <section className="min-w-0 p-3 xl:col-span-5"><h3 className="label mb-3 text-compare-muted">PALETTE WALL · {sites.length} SITES</h3><div className="flex flex-col gap-[2px]">{sites.map(s=>{const palette=(s.color.palette??[]).slice(0,5),sum=palette.reduce((n,p)=>n+p.share,0)||1;return <a key={s.domain} href={`https://${s.domain}`} target="_blank" rel="noopener noreferrer" className="crawl-tip relative flex h-[10px] shrink-0" aria-label={`Open ${s.domain}`}>
        {palette.map((p,n)=><span key={n} style={{backgroundColor:p.hex,width:`${p.share/sum*100}%`}}/>)}<span className="crawl-tooltip">{s.domain} · {s.index_name} · {s.color.theme} · {s.color.accent??"NO ACCENT"}</span>
      </a>;})}</div><table className="sr-only"><caption>Site palettes</caption><tbody>{sites.map(s=><tr key={s.domain}><th>{s.domain}</th><td>{s.index_name}</td><td>{s.color.theme}</td><td>{s.color.palette?.slice(0,5).map(p=>`${p.hex}: ${percent(p.share)}`).join(", ")}</td></tr>)}</tbody></table></section>
    </div>
  </div>;
}
const DIMENSIONS=[ ["h1_align","≡"],["hero_media","▣ ▷"],["cta_shape","[ ] ( )"],["grid_cols","▥"],["h1_size","Aa"],["h1_tracking","A A"],["h1_case","a A"] ] as const;
function Layout({data,index}:{data:CrawlData;index:IndexFilter}) {
  return <div className="grid xl:grid-cols-2">{DIMENSIONS.map(([dimension,glyph])=><CompareBlock key={dimension} title={(dimension??"").toUpperCase()} glyph={glyph} index={index} rows={comparisonRows(data.layout.filter(r=>r.dimension===dimension))}/>)}<CompareBlock title="TECH STACK" glyph="</>" index={index} rows={comparisonRows(data.tech).slice(0,10)}/></div>;
}
function Composition({data,index}:{data:CrawlData;index:IndexFilter}) {
  const sites=data.sites.filter(s=>shownIndexes(index).includes(s.index_name));
  return <div className="grid xl:grid-cols-12"><div className="border-r border-rule xl:col-span-8"><Scatter sites={sites}/></div><div className="xl:col-span-4">
    <section className="border-b border-rule p-3"><h3 className="label mb-3 text-compare-muted">MEDIA COVERAGE</h3><div className="grid grid-cols-2">{shownIndexes(index).map(i=>{const rows=sites.filter(s=>s.index_name===i),avg=rows.length?rows.reduce((n,s)=>n+(s.composition.media_coverage??0),0)/rows.length:null;return <div key={i}><div className={`label ${indexClass(i)}`}>{i}</div><div className="text-mega mt-2">{avg==null?"—":`${Math.round(avg*100)}%`}</div></div>;})}</div></section>
    <CompareBlock title="H1 SIZE" rows={comparisonRows(data.layout.filter(r=>r.dimension==="h1_size"))} index={index}/>
    <section className="p-3"><h3 className="label mb-3 text-compare-muted">PAGE LENGTH</h3>{shownIndexes(index).map(i=>{const value=median(sites.filter(s=>s.index_name===i).map(s=>s.layout.page_height_vh??0));return <div key={i} className="mb-4"><div className={`label ${indexClass(i)}`}>{i}</div><div className="text-hero">{value?.toFixed(1)??"—"} SCREENS</div></div>;})}</section>
  </div></div>;
}
function Lexicon({data,index}:{data:CrawlData;index:IndexFilter}) {
  const mobile=useIsMobile(),[mobileIndex,setMobileIndex]=useState("VANGUARD");
  const indexes=mobile&&index==="BOTH"?[mobileIndex.toLowerCase()]:shownIndexes(index);
  const gaps=compare(data.ctas.map(r=>({index_name:r.index_name??"",share:r.share??0,phrase:r.phrase??""})),r=>r.phrase).sort((a,b)=>(b.v-b.m)-(a.v-a.m)).slice(0,3);
  return <><div className="p-3 md:hidden">{index==="BOTH"&&<Toggle label="INDEX" options={["VANGUARD","MAINSTREAM"]} value={mobileIndex} onChange={setMobileIndex}/>}</div><div className={`grid ${indexes.length===2?"md:grid-cols-2":""}`}>{indexes.map(i=>{const words=data.words.filter(r=>r.index_name===i).slice(0,40),max=words[0]?.sites||1;return <section key={i} className="min-w-0 border-r border-rule p-3"><h3 className={`label mb-4 ${indexClass(i)}`}>{i}</h3><h4 className="label mb-2 text-compare-muted">CTA PHRASES</h4><ol>{data.ctas.filter(r=>r.index_name===i).slice(0,20).map((r,n)=><li key={r.phrase} className="relative border-b border-rule py-2"><div className="flex gap-3"><span className="label w-[2ch] text-compare-muted">{n+1}</span><span className="min-w-0 flex-1 break-words">"{r.phrase}"</span><span className={indexClass(i)}>{percent(r.share)}</span></div><div className={`absolute bottom-0 h-px ${i==="vanguard"?"bg-signal":"bg-ink/60"}`} style={{width:percent(r.share)}}/></li>)}</ol><h4 className="label mb-3 mt-6 text-compare-muted">HEADLINE WORDS</h4><div className="leading-8">{words.map((r,n)=><span key={r.word}><span tabIndex={0} className={`crawl-tip relative ${["text-label","text-body","text-word","text-hero"][Math.min(3,Math.floor((r.sites??0)/max*4))]}`} aria-label={`${r.word}, ${r.sites} sites`}>{r.word}<span className="crawl-tooltip">{r.sites} SITES</span></span>{n<words.length-1&&<span className="text-compare-muted"> · </span>}</span>)}</div></section>;})}</div><div className="label flex flex-wrap gap-3 border-t border-rule p-3 text-compare-muted">{gaps.map(r=><span key={r.label}>«"{r.label}" <span className="text-signal">{spreadText((r.v-r.m)*100)}</span> VANGUARD»</span>)}</div></>;
}
function WildFamily({family,google}:{family:string;google:boolean}) {
  useEffect(()=>{if(!google)return;const id=`wild-${family.replace(/\W/g,"-")}`;if(document.getElementById(id))return;const link=document.createElement("link");link.id=id;link.rel="stylesheet";link.href=`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g,"+")}&display=swap`;document.head.appendChild(link);},[family,google]);
  return <span style={google?{fontFamily:`"${family}", var(--font-mono)`}:undefined}>{family}</span>;
}
export function InTheWild() {
  const [role,setRole]=useState("HEADLINE"),[index,setIndex]=useState<IndexFilter>("BOTH");
  const {data:gf}=useQuery(typeIndexQuery());
  const ranks=new Map(gf?.rows.map(r=>[r.family.toLowerCase(),r.popularity_rank]));
  return <section className="crawler flex min-h-0 flex-1 flex-col" aria-label="In the wild"><PanelHeader title="F2 TYPE · IN THE WILD"/><CrawlControls index={index} onIndex={setIndex}/><div className="border-b border-rule p-3"><Toggle label="ROLE" options={["HEADLINE","BODY"]} value={role} onChange={setRole}/></div><div className="min-h-0 flex-1 md:overflow-y-auto"><CrawlState>{data=><><div className={`grid ${index==="BOTH"?"md:grid-cols-2":""}`}>{shownIndexes(index).map(i=><section key={i} className="min-w-0 border-r border-rule"><h3 className={`label p-3 ${indexClass(i)}`}>{i}</h3><table className="w-full table-fixed text-body"><thead className="label text-compare-muted"><tr><th className="w-[4ch] p-2">RANK</th><th className="text-left p-2">FAMILY</th><th className="w-[6ch] p-2">SITES</th><th className="w-[7ch] p-2">SHARE</th><th className="w-[7ch] p-2">GF RANK</th></tr></thead><tbody>{data.fonts.filter(r=>r.index_name===i&&r.role===(role==="HEADLINE"?"h1":"body")).map((r,n)=>{const rank=ranks.get((r.family??"").toLowerCase());return <tr key={r.family} className="border-b border-rule"><td className="num p-2 text-compare-muted">{n+1}</td><td className="break-words p-2"><WildFamily family={r.family??""} google={rank!==undefined}/></td><td className="num p-2">{r.sites}</td><td className={`num p-2 ${indexClass(i)}`}>{percent(r.share)}</td><td className="num p-2 text-compare-muted">{rank??""}</td></tr>;})}</tbody></table></section>)}</div><p className="label p-3 text-compare-muted">Rendered fonts measured in Chromium. 'System UI' = the site asks for the operating system's font.</p></>}</CrawlState></div></section>;
}