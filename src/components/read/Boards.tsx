import { Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { referenceKitQuery } from "@/lib/data";
import { boardIndex, boardMembers, boardName, boardCrop, commonKit, type BoardFilters } from "@/lib/designer-kit";
import { brandCsv } from "@/lib/take-away";
import { categoryLabel } from "@/lib/categories";
import { sectorName } from "@/lib/labels";
import { SITE_URL } from "@/lib/site";
import { DigestShell } from "@/components/digest/Editorial";
import { DataShell } from "@/components/dataview/DataShell";
import { Button } from "@/components/ui/button";
import { BrandMark } from "./BrandMark";
import { CropFigure } from "./Evidence";
import { CopyText } from "./TakeAway";
import { CompareSelection } from "./CompareSelect";
import { ReadFooter } from "./Bits";
export function BoardIndexView({ view }: { view?: string | undefined }) {
  const { data } = useSuspenseQuery(referenceKitQuery());
  const rows = boardIndex(data.rows);
  const content = <div className="ed-wrap py-8"><h1 className="ed-cover">Reference boards</h1>
    <div className="mt-4"><CopyText label="Copy link" value={`${SITE_URL}/boards`} /></div>
    {!data.rows.length && <p className="ed-small mt-4">The library’s next weekly pass fills these boards.</p>}
    {["Type", "Color", "Layout", "Voice", "Vibe", "Structure"].map(dim => <section key={dim} className="mt-10"><h2 className="ed-h3">{dim}</h2><ul className="mt-3">{rows.filter(r => r.dimension === dim).map(r => <li key={r.key} className="ed-hair flex min-h-14 flex-wrap items-center justify-between gap-3 py-2">
      <Link to="/boards/$key" params={{ key: r.key }} search={view === "data" ? { view } : {}} className="ed-tap ed-small">{r.name} · {r.count}</Link><span className="flex gap-2">{r.recent.map(b => <BrandMark key={b.domain} icon={data.icons[b.domain]} name={b.name} size={32} />)}</span>
    </li>)}</ul></section>)}
  </div>;
  return view === "data" ? <DataShell object={{ type: "pattern", id: "boards" }} name="Reference boards">{content}</DataShell> : <DigestShell section="patterns" label="Reference boards" lens={false}>{content}<ReadFooter terminal="/boards?view=data" /></DigestShell>;
}
export function BoardView({ signal, filters }: { signal: string; filters: BoardFilters }) {
  const { data } = useSuspenseQuery(referenceKitQuery()), navigate = useNavigate();
  const all = boardMembers(data.rows, signal), rows = boardMembers(data.rows, signal, filters), name = boardName(signal), common = commonKit(rows);
  const set = (patch: Partial<BoardFilters>) => navigate({ to: "/boards/$key", params: { key: signal }, search: { ...filters, ...patch }, resetScroll: false });
  const url = new URL(`${SITE_URL}/boards/${encodeURIComponent(signal)}`); for (const [k,v] of Object.entries(filters)) if(v) url.searchParams.set(k,v);
  const chips = (label: string, key: "sector" | "category" | "sub", options: (string | null)[]) => <div className="mt-3 flex flex-wrap items-center gap-2"><span className="ed-kicker">{label}</span><Button variant="ghost" className="cat-chip min-h-11 rounded-none" aria-pressed={!filters[key]} onClick={() => void set({ [key]: undefined, ...(key === "sector" ? { category: undefined, sub: undefined } : key === "category" ? { sub: undefined } : {}) })}>All</Button>{[...new Set(options.filter((s):s is string=>!!s&&s!=="all"))].sort().map(s => <Button key={s} variant="ghost" className="cat-chip min-h-11 rounded-none" aria-pressed={filters[key]===s} onClick={() => void set({ [key]:s, ...(key === "sector" ? { category: undefined, sub: undefined } : key === "category" ? { sub: undefined } : {}) })}>{key === "sector" ? sectorName(s) : categoryLabel(s)}</Button>)}</div>;
  const ordered = [...rows].sort((a,b) => {const key=filters.sort??"first";const x=key==="first"?a.firstSeen[signal]??"":key==="brand"?a.name:key==="sector"?a.sector??"":key==="category"?a.category??"":a.subcategory??"";const y=key==="first"?b.firstSeen[signal]??"":key==="brand"?b.name:key==="sector"?b.sector??"":key==="category"?b.category??"":b.subcategory??"";return x.localeCompare(y)*(filters.dir==="asc"?1:-1);});
  const content = <div className="ed-wrap py-8"><p className="ed-kicker"><Link to="/boards">Reference boards</Link></p><h1 className="ed-cover mt-3">{name}</h1>
    {chips("Sector","sector",all.map(r=>r.sector))}{filters.sector && chips("Category","category",all.filter(r=>r.sector===filters.sector).map(r=>r.category))}{filters.category && chips("Sub-category","sub",all.filter(r=>r.category===filters.category&&(!filters.sector||r.sector===filters.sector)).map(r=>r.subcategory))}
    <label className="ed-data mt-4 flex flex-wrap items-center gap-3">First seen since<input type="date" className="form-field min-h-11 bg-transparent px-2" value={filters.since??""} onChange={e=>void set({since:e.target.value||undefined})} /></label>
    <p className="ed-data mt-4" aria-live="polite">{rows.length} of the {data.rows.length} homepages slug reads</p>
    <div className="mt-4" data-board-take-away=""><h2 className="ed-kicker">Take it with you</h2><div className="flex flex-wrap gap-2"><CopyText label="Copy as CSV" value={brandCsv(rows)} /><CopyText label="Copy link" value={url.href} /></div>
      <details className="mt-2"><summary className="ed-tap ed-caption cursor-pointer">Common colours and type</summary><table className="ed-data mt-2 w-full"><thead><tr><th className="text-left">Value</th><th className="text-right">Brands</th></tr></thead><tbody>{[...common.colors,...common.fonts].map(([v,n])=><tr className="ed-hair" key={v}><td className="py-2">{v}</td><td className="text-right tabular-nums">{n}</td></tr>)}</tbody></table></details>
    </div>
    <p className="ed-caption mt-3">First seen means the earliest stored reading, not the day the brand changed it.</p>
    {filters.view === "data" ? <div className="mt-6 overflow-auto"><table className="ed-data w-full min-w-[640px]"><thead><tr>{["brand","sector","category","sub","first"].map(k=><th key={k} className="text-left"><Button variant="ghost" onClick={()=>void set({sort:k,dir:filters.sort===k&&filters.dir==="asc"?"desc":"asc"})}>{({brand:"Brand",sector:"Sector",category:"Category",sub:"Sub-category",first:"First seen"} as Record<string,string>)[k]} ↕</Button></th>)}<th>Value</th></tr></thead><tbody>{ordered.map(r=><tr key={r.domain} className="ed-hair"><td className="py-3"><Link to="/brands/$domain" params={{domain:r.domain}}>{r.name}</Link></td><td>{sectorName(r.sector)}</td><td>{categoryLabel(r.category??"")}</td><td>{categoryLabel(r.subcategory??"")}</td><td>{r.firstSeen[signal]?.slice(0,10)??"Not recorded"}</td><td>{signal.startsWith("ask:")?r.ask:signal.startsWith("nav:")?r.structure?.nav_labels?.join(" · "):"Yes"}</td></tr>)}</tbody></table></div> : <CompareSelection>{control=><ul className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">{rows.map(r=>{const crop=boardCrop(data.crops,r,signal);return <li key={r.domain} className="min-w-0 border border-rule p-4" data-board-card={r.domain}>
      <h2 className="ed-h3"><Link to="/brands/$domain" params={{domain:r.domain}} className="flex items-center gap-3"><BrandMark icon={data.icons[r.domain]} name={r.name} size={48}/>{r.name}</Link></h2><p className="ed-kicker mt-2 break-words">{[sectorName(r.sector),r.category?categoryLabel(r.category):null,r.subcategory?categoryLabel(r.subcategory):null].filter(Boolean).join(" · ")}</p>
      <div className="mt-3 min-h-48">{crop?<CropFigure crop={crop}/>:<div className="flex aspect-[8/5] items-center justify-center"><BrandMark icon={data.icons[r.domain]} name={r.name} size={72}/></div>}</div>
      <p className="ed-caption mt-3">First seen {r.firstSeen[signal]?.slice(0,10)??"not recorded"}</p><div className="flex flex-wrap items-center justify-between"><a href={`https://${r.domain}`} className="ed-tap ed-data" target="_blank" rel="noopener">Live site ↗</a>{control(r.domain,r.name)}</div>
    </li>;})}</ul>}</CompareSelection>}
    {!rows.length&&<p className="ed-small mt-6">No brand matches these filters.</p>}
  </div>;
  return filters.view === "data" ? <DataShell object={{type:"pattern",id:signal}} name={name} kicker="Reference board">{content}</DataShell> : <DigestShell section="patterns" label={name} lens={false}>{content}<ReadFooter terminal={`${url.pathname}?view=data`}/></DigestShell>;
}