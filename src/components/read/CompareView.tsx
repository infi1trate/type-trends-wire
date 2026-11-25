import { Fragment } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { referenceKitQuery } from "@/lib/data";
import { compareDomains, sameValues } from "@/lib/designer-kit";
import { compareRows, compareTsv } from "@/lib/compare";
import { citation } from "@/lib/take-away";
import { CompareBrandSearch } from "./BrandSearch";
import { SITE_URL } from "@/lib/site";
import { DigestShell } from "@/components/digest/Editorial";
import { DataShell } from "@/components/dataview/DataShell";
import { BrandMark } from "./BrandMark";
import { CropFigure } from "./Evidence";
import { boardCrop } from "@/lib/designer-kit";
import { PageStrip } from "./Structure";
import { CopyText } from "./TakeAway";
import { ReadFooter } from "./Bits";
export function CompareView({search}:{search:Record<string,unknown>}) {
  const {data}=useSuspenseQuery(referenceKitQuery()), navigate=useNavigate();
  const domains=compareDomains(search), rows=domains.flatMap(d=>{const r=data.rows.find(r=>r.domain===d);return r?[r]:[];}), table=compareRows(rows);
  const url=new URL(`${SITE_URL}/compare`);["a","b","c"].forEach((k,i)=>{const d=domains[i];if(d)url.searchParams.set(k,d);});
  const tsv=compareTsv(rows);
  const choose=(domain:string)=>{const [a,b,c]=[...domains,domain].slice(0,3);void navigate({to:"/compare",search:{...(a?{a}:{}),...(b?{b}:{}),...(c?{c}:{})}});};
  const content=<div className="ed-wrap py-8"><h1 className="ed-cover">Compare</h1><div className="mt-5 max-w-lg">{rows.length<3&&<CompareBrandSearch brands={data.rows} exclude={domains} onChoose={choose}/>}</div>
    {rows.length<2?<p className="ed-small mt-6">Choose two or three brands.</p>:<><div className="mt-5 flex flex-wrap gap-2" data-compare-take-away=""><CopyText label="Copy as table" value={tsv}/><CopyText label="Copy link" value={url.href}/><CopyText label="Citation" value={rows.map(citation).join("\n")}/></div>
      <div className="mt-6 overflow-x-auto"><table className="ed-data w-full table-fixed max-sm:[&_td]:p-1 max-sm:[&_th]:p-1" data-compare-table=""><thead><tr><th className="w-44 text-left max-md:hidden">Reading</th>{rows.map(r=><th className="p-3 align-top text-left" key={r.domain}><Link to="/brands/$domain" params={{domain:r.domain}} className="ed-h3 flex flex-wrap items-center gap-2 break-words"><BrandMark icon={data.icons[r.domain]} name={r.name} size={48} mobileSize={32}/>{r.name}</Link><p className="ed-caption mt-2">{r.captured?.slice(0,10)}</p><Link to="/compare" search={{a:rows.filter(x=>x.domain!==r.domain)[0]?.domain,b:rows.filter(x=>x.domain!==r.domain)[1]?.domain}} className="ed-tap ed-caption">Remove</Link></th>)}</tr></thead>
      <tbody><><tr className="ed-hair md:hidden"><th colSpan={rows.length} className="p-2 pb-0 text-left"><span className="ed-kicker hyphens-none break-normal [overflow-wrap:normal]">Hero</span></th></tr><tr className="ed-hair max-md:border-t-0"><th className="p-2 align-top text-left max-md:hidden"><span className="ed-kicker hyphens-none break-normal [overflow-wrap:normal]">Hero</span></th>{rows.map(r=>{const crop=boardCrop(data.crops,r,"hero_media:image");return <td className="p-3 align-top" key={r.domain}>{crop?<CropFigure crop={crop}/>:<div className="flex aspect-[8/5] items-center justify-center"><BrandMark icon={data.icons[r.domain]} name={r.name} size={72}/></div>}</td>;})}</tr></>
      {table.map(t=><Fragment key={t.name}><tr className="ed-hair md:hidden"><th colSpan={rows.length} className="p-2 pb-0 text-left"><span className="flex items-baseline justify-between gap-3"><span className="ed-kicker hyphens-none break-normal [overflow-wrap:normal]">{t.name}</span><span className="ed-caption shrink-0">{sameValues(t.values)?"Same":"· Different"}</span></span></th></tr><tr className="ed-hair max-md:border-t-0" data-compare-row={t.name}><th className="p-2 align-top text-left max-md:hidden"><span className="ed-kicker hyphens-none break-normal [overflow-wrap:normal]">{t.name}</span><span className="ed-caption mt-1 block">{sameValues(t.values)?"Same":"· Different"}</span></th>{t.values.map((v,i)=><td className="break-words p-3 align-top" key={rows[i]?.domain??i}>{t.name==="Section order"&&rows[i]?.structure?<><div className="overflow-auto"><PageStrip r={rows[i].structure} label={rows[i].name}/></div><p className="ed-caption mt-2">{v}</p></>:t.name.startsWith("Palette")?<div className="space-y-2">{rows[i]?.identity.palette.map(p=><p key={p.hex} className="flex flex-wrap items-center gap-1"><span className="ed-swatch h-5 w-5 border" style={{background:p.hex}}/><span className="ed-code">{p.hex}</span><span>{p.share!=null?`${Math.round(p.share*100)}%`:"—"}</span></p>)}</div>:v}</td>)}</tr></Fragment>)}
      </tbody></table></div>
    </>}
  </div>;
  return search["view"]==="data"?<DataShell object={{type:"brand",id:"compare"}} name="Compare">{content}</DataShell>:<DigestShell section="brands" label="Compare" lens={false}>{content}<ReadFooter terminal={`${url.pathname}${url.search}&view=data`}/></DigestShell>;
}