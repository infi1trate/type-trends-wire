import { useState } from "react";
import { Button } from "@/components/ui/button";
export function BrandSearchInput({id, label, value, onChange}: {id?: string;label: string;value: string;onChange:(value:string)=>void}) {
  return <label className="ed-kicker block" htmlFor={id}>{label}<input id={id} name="q" type="search" value={value} onChange={e=>onChange(e.target.value)} placeholder="Name or domain, e.g. linear" className="ed-data form-field mt-2 min-h-11 w-full bg-transparent px-3" autoComplete="off" /></label>;
}
export function CompareBrandSearch({ brands, exclude=[], onChoose }: { brands: readonly {domain:string;name:string|null}[]; exclude?:string[]; onChoose:(domain:string)=>void }) {
  const [q,setQ]=useState("");
  const rows=brands.filter(r=>!exclude.includes(r.domain)&&`${r.name??""} ${r.domain}`.toLowerCase().includes(q.toLowerCase())).slice(0,8);
  return <div className="min-w-0"><BrandSearchInput label="Compare with…" value={q} onChange={setQ}/>
    {q&&<ul className="border border-rule">{rows.map(r=><li key={r.domain}><Button variant="ghost" className="ed-data min-h-11 w-full justify-start rounded-none" onClick={()=>onChoose(r.domain)}>{r.name??r.domain} · {r.domain}</Button></li>)}{!rows.length&&<li className="ed-caption p-3">No brand matches.</li>}</ul>}
  </div>;
}