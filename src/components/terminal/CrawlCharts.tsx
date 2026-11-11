import { compare, median, percent, type IndexFilter } from "@/lib/crawl";
import type { CrawlSite } from "@/lib/data";

export const indexClass = (index:string) => index==="vanguard"?"text-signal":"text-compare-muted";
export const shownIndexes = (index:IndexFilter) => index==="BOTH"?["vanguard","mainstream"]:[index.toLowerCase()];
export function CompareBlock({title,glyph="",rows,index="BOTH"}:{title:string;glyph?:string;rows:{label:string;v:number;m:number}[];index?:IndexFilter}) {
  return <section className="min-w-0 border-b border-rule p-3">
    <h3 className="label mb-3 text-ink">{title} <span className="text-compare-muted">{glyph}</span></h3>
    <div className="flex flex-col gap-3" aria-hidden>{rows.map(r=><div key={r.label} className="grid grid-cols-[14ch_minmax(0,1fr)] items-center gap-2">
      <span className="text-compare-muted truncate" title={r.label}>{r.label}</span>
      <div className="flex flex-col gap-1">{shownIndexes(index).map(i=><div key={i} className="flex items-center gap-2"><div className="relative h-[6px] min-w-0 flex-1 bg-g800"><div className={`h-full ${i==="vanguard"?"bg-signal":"bg-ink/60"}`} style={{width:percent(i==="vanguard"?r.v:r.m)}}/></div><span className={`label w-[6ch] text-right ${indexClass(i)}`}>{percent(i==="vanguard"?r.v:r.m)}</span></div>)}</div>
    </div>)}</div>
    <table className="sr-only"><caption>{title}</caption><thead><tr><th>Value</th><th>Vanguard</th><th>Mainstream</th></tr></thead><tbody>{rows.map(r=><tr key={r.label}><th>{r.label}</th><td>{percent(r.v)}</td><td>{percent(r.m)}</td></tr>)}</tbody></table>
  </section>;
}
export function Scatter({sites}:{sites:CrawlSite[]}) {
  const densities = sites.map(s=>s.composition.text_density??0).sort((a,b)=>a-b);
  const ceiling = densities[Math.floor((densities.length-1)*.98)] || 1;
  const x=(v:number)=>48+Math.min(1,Math.max(0,v))*640;
  const y=(v:number)=>620-Math.min(1,Math.max(0,v)/ceiling)*560;
  return <section className="min-w-0 p-3">
    <h3 className="label text-compare-muted">WHITESPACE × TEXT DENSITY</h3>
    <svg viewBox="0 0 730 690" className="w-full md:max-h-[calc(100dvh-240px)]" role="img" aria-label="Whitespace and text density by site">
      {[0,.25,.5,.75,1].map(t=><g key={t}><path d={`M${x(t)} 60V620 M48 ${y(t*ceiling)}H688`} className="stroke-rule" fill="none"/><text x={x(t)} y={645} textAnchor="middle" className="fill-compare-muted" fontSize="11">{t*100}%</text><text x={40} y={y(t*ceiling)} textAnchor="end" className="fill-compare-muted" fontSize="11">{(t*ceiling).toFixed(1)}</text></g>)}
      <text x="48" y="32" className="fill-compare-muted" fontSize="11">CHARS / 10K PX²</text><text x="365" y="675" textAnchor="middle" className="fill-compare-muted" fontSize="11">WHITESPACE</text>
      {sites.map(s=><rect key={s.domain} tabIndex={0} aria-label={`${s.domain}: ${percent(s.composition.whitespace_ratio)} whitespace, ${s.composition.text_density} density, ${s.layout.hero_media} hero`} x={x(s.composition.whitespace_ratio??0)-2} y={y(s.composition.text_density??0)-2} width="4" height="4" className={s.index_name==="vanguard"?"fill-signal":"fill-ink/40"}><title>{s.domain} · {percent(s.composition.whitespace_ratio)} · {s.composition.text_density} · {s.layout.hero_media}</title></rect>)}
      {["vanguard","mainstream"].map((i,n)=>{const group=sites.filter(s=>s.index_name===i),mx=median(group.map(s=>s.composition.whitespace_ratio??0)),my=median(group.map(s=>s.composition.text_density??0));if(mx===null||my===null)return null;return <g key={i}><path d={`M${x(mx)} 60V620 M48 ${y(my)}H688`} fill="none" strokeDasharray="4 4" className={i==="vanguard"?"stroke-signal":"stroke-ink/60"}/><text x={x(mx)+5} y={45+n*14} fontSize="11" className={i==="vanguard"?"fill-signal":"fill-compare-muted"}>{n===0?"V":"M"} MEDIAN</text></g>;})}
    </svg>
    <table className="sr-only"><caption>Composition scatter data</caption><thead><tr><th>Domain</th><th>Index</th><th>Whitespace</th><th>Density</th><th>Hero media</th></tr></thead><tbody>{sites.map(s=><tr key={s.domain}><th>{s.domain}</th><td>{s.index_name}</td><td>{percent(s.composition.whitespace_ratio)}</td><td>{s.composition.text_density}</td><td>{s.layout.hero_media}</td></tr>)}</tbody></table>
  </section>;
}
export const comparisonRows = (rows:{index_name:string|null;share:number|null;value?:string|null;tech?:string|null}[]) => compare(rows.map(r=>({index_name:r.index_name??"",share:r.share??0,label:r.value??r.tech??""})),r=>r.label);