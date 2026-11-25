import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { referenceKitQuery } from "@/lib/data";
import { compareDomains, sameValues, type KitRecord } from "@/lib/designer-kit";
import { typeText, sectionText, asksText, citation } from "@/lib/take-away";
import { categoryLabel } from "@/lib/categories";
import { sectorName, BASIS_WORD } from "@/lib/labels";
import { PHONE_NAV_NAME } from "@/lib/structure";
import { SITE_URL } from "@/lib/site";
import { DigestShell } from "@/components/digest/Editorial";
import { DataShell } from "@/components/dataview/DataShell";
import { BrandMark } from "./BrandMark";
import { CropFigure } from "./Evidence";
import { boardCrop } from "@/lib/designer-kit";
import { PageStrip } from "./Structure";
import { CopyText } from "./TakeAway";
import { ReadFooter } from "./Bits";
import { Button } from "@/components/ui/button";
const classLine=(r:KitRecord)=>[sectorName(r.sector),r.category?categoryLabel(r.category):null,r.subcategory?categoryLabel(r.subcategory):null].filter(Boolean).join(" · ");
export const compareRows=(rows:KitRecord[])=>[
  {name:"Sector · category · sub-category",values:rows.map(classLine)},
  {name:"Headline and body type",values:rows.map(typeText)},
  {name:"Palette · share of first screen",values:rows.map(r=>r.identity.palette.map(p=>`${p.hex}${p.share!=null?` ${Math.round(p.share*100)}%`:""}`).join(" · "))},
  {name:"Theme",values:rows.map(r=>r.theme??"Not measured")},
  {name:"Voice and style",values:rows.map(r=>r.identity.tags.map(t=>`${t.name} · ${BASIS_WORD[t.basis]}`).join(" · ")||"Not read")},
  {name:"Primary ask",values:rows.map(r=>r.structure?.asks?.find(a=>a.p)?.l??r.ask??"Not read")},
  {name:"First-screen asks",values:rows.map(r=>asksText(r.structure))},
  {name:"Navigation words",values:rows.map(r=>r.structure?.nav_labels?.join(" · ")??"Not read")},
  {name:"Section order",values:rows.map(r=>sectionText(r.structure))},
  {name:"Phone navigation",values:rows.map(r=>r.phone?.mobile?.nav?PHONE_NAV_NAME[r.phone.mobile.nav]??r.phone.mobile.nav:"Not read")},
  {name:"Last change",values:rows.map(r=>r.lastChange?`${r.lastChange.text} · ${r.lastChange.at.slice(0,10)}`:"No change recorded")},
];
export function CompareBrandSearch({ brands, exclude=[], onChoose }: { brands: Pick<KitRecord,"domain"|"name">[]; exclude?:string[]; onChoose:(domain:string)=>void }) {
  const [q,setQ]=useState("");
  const rows=brands.filter(r=>!exclude.includes(r.domain)&&`${r.name} ${r.domain}`.toLowerCase().includes(q.toLowerCase())).slice(0,8);
  return <div className="min-w-0"><label className="ed-kicker">Compare with…<input type="search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Name or domain, e.g. linear" className="ed-data form-field mt-2 min-h-11 w-full bg-transparent px-3" autoComplete="off"/></label>
    {q&&<ul className="border border-rule">{rows.map(r=><li key={r.domain}><Button variant="ghost" className="ed-data min-h-11 w-full justify-start rounded-none" onClick={()=>onChoose(r.domain)}>{r.name} · {r.domain}</Button></li>)}{!rows.length&&<li className="ed-caption p-3">No brand matches.</li>}</ul>}
  </div>;
}
export function CompareView({search}:{search:Record<string,unknown>}) {
  const {data}=useSuspenseQuery(referenceKitQuery()), navigate=useNavigate();
  const domains=compareDomains(search), rows=domains.flatMap(d=>{const r=data.rows.find(r=>r.domain===d);return r?[r]:[];}), table=compareRows(rows);
  const url=new URL(`${SITE_URL}/compare`);["a","b","c"].forEach((k,i)=>{const d=domains[i];if(d)url.searchParams.set(k,d);});
  const tsv=[["Reading",...rows.map(r=>r.name)],...table.map(r=>[r.name,...r.values])].map(r=>r.map(s=>s.replace(/[\t\r\n]/g," ")).join("\t")).join("\n");
  const choose=(domain:string)=>{const [a,b,c]=[...domains,domain].slice(0,3);void navigate({to:"/compare",search:{...(a?{a}:{}),...(b?{b}:{}),...(c?{c}:{})}});};
  const content=<div className="ed-wrap py-8"><h1 className="ed-cover">Compare</h1><div className="mt-5 max-w-lg">{rows.length<3&&<CompareBrandSearch brands={data.rows} exclude={domains} onChoose={choose}/>}</div>
    {rows.length<2?<p className="ed-small mt-6">Choose two or three brands.</p>:<><div className="mt-5 flex flex-wrap gap-2" data-compare-take-away=""><CopyText label="Copy as table" value={tsv}/><CopyText label="Copy link" value={url.href}/><CopyText label="Citation" value={rows.map(citation).join("\n")}/></div>
      <div className="mt-6 overflow-x-auto"><table className="ed-data w-full table-fixed min-w-[620px]" data-compare-table=""><thead><tr><th className="w-28 text-left">Reading</th>{rows.map(r=><th className="p-3 align-top text-left" key={r.domain}><Link to="/brands/$domain" params={{domain:r.domain}} className="ed-h3 flex items-center gap-3"><BrandMark icon={data.icons[r.domain]} name={r.name} size={48}/>{r.name}</Link><p className="ed-caption mt-2">{r.captured?.slice(0,10)}</p><Link to="/compare" search={{a:rows.filter(x=>x.domain!==r.domain)[0]?.domain,b:rows.filter(x=>x.domain!==r.domain)[1]?.domain}} className="ed-tap ed-caption">Remove</Link></th>)}</tr></thead>
      <tbody><tr className="ed-hair"><th className="p-2 align-top text-left">Hero</th>{rows.map(r=>{const crop=boardCrop(data.crops,r,"hero_media:image");return <td className="p-3 align-top" key={r.domain}>{crop?<CropFigure crop={crop}/>:<div className="flex aspect-[8/5] items-center justify-center"><BrandMark icon={data.icons[r.domain]} name={r.name} size={72}/></div>}</td>;})}</tr>
      {table.map(t=><tr key={t.name} className="ed-hair" data-compare-row={t.name}><th className="p-2 align-top text-left"><span className="ed-kicker">{t.name}</span><span className="ed-caption mt-1 block">{sameValues(t.values)?"Same":"· Different"}</span></th>{t.values.map((v,i)=><td className="break-words p-3 align-top" key={rows[i]?.domain??i}>{t.name==="Section order"&&rows[i]?.structure?<><PageStrip r={rows[i].structure} label={rows[i].name}/><p className="ed-caption mt-2">{v}</p></>:t.name.startsWith("Palette")?<div className="space-y-2">{rows[i]?.identity.palette.map(p=><p key={p.hex} className="flex items-center gap-2"><span className="ed-swatch h-5 w-5 border" style={{background:p.hex}}/><span className="ed-code">{p.hex}</span><span>{p.share!=null?`${Math.round(p.share*100)}%`:"—"}</span></p>)}</div>:v}</td>)}</tr>)}
      </tbody></table></div>
    </>}
  </div>;
  return search["view"]==="data"?<DataShell object={{type:"brand",id:"compare"}} name="Compare">{content}</DataShell>:<DigestShell section="brands" label="Compare" lens={false}>{content}<ReadFooter terminal={`${url.pathname}${url.search}&view=data`}/></DigestShell>;
}