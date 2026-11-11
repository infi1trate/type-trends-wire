import { createContext, useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { crawlQuery, type CrawlData } from "@/lib/data";
import { readScope, saveScope, type IndexFilter, type Scope } from "@/lib/crawl";
import { Button } from "@/components/ui/button";
import { Loading } from "./primitives";

const ScopeContext = createContext<{scope:Scope;setScope:(scope:Scope)=>void}>({scope:"en",setScope:()=>{}});
export function CrawlScopeProvider({children}:{children:React.ReactNode}) {
  const [scope,setScopeState] = useState<Scope>("en");
  useEffect(()=>{setScopeState(readScope(localStorage));},[]);
  const setScope = (value:Scope)=>{setScopeState(value);saveScope(localStorage,value);};
  return <ScopeContext.Provider value={{scope,setScope}}>{children}</ScopeContext.Provider>;
}
export const useCrawl = () => {
  const context = useContext(ScopeContext);
  return {...context,...useQuery(crawlQuery(context.scope))};
};
export function Toggle<T extends string>({label,options,value,onChange}:{label:string;options:readonly T[];value:T;onChange:(value:T)=>void}) {
  return <div role="group" aria-label={label} className="flex min-w-0 flex-wrap items-center">
    <span className="label mr-2 text-compare-muted">{label}</span>
    {options.map(o=><Button key={o} variant="ghost" aria-pressed={value===o} onClick={()=>onChange(o)} className={`label h-10 border border-rule px-2 md:h-8 ${value===o?"bg-ink text-void":"text-compare-muted"}`}>{o}</Button>)}
  </div>;
}
export function CrawlControls({index,onIndex}:{index?:IndexFilter;onIndex?:(index:IndexFilter)=>void}) {
  const {scope,setScope,data} = useCrawl();
  const stats = data?.run.stats;
  const errors = stats && typeof stats === "object" && !Array.isArray(stats) ? stats["errors"] : null;
  const errorText = errors ? JSON.stringify(errors,null,2) : "No crawl errors";
  return <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-rule p-3">
    <Toggle label="SCOPE" options={["EN","ALL"]} value={scope.toUpperCase()} onChange={v=>setScope(v==="EN"?"en":"all")} />
    {index && onIndex && <Toggle label="INDEX" options={["BOTH","VANGUARD","MAINSTREAM"]} value={index} onChange={onIndex}/>}
    {data && <div tabIndex={0} className="crawl-tip label relative ml-auto text-compare-muted">
      SOURCE DSGN-CRAWLER · RUN {data.run.id} · {data.run.finished_at?.slice(0,10)} · V {data.sites.filter(s=>s.index_name==="vanguard").length} / M {data.sites.filter(s=>s.index_name==="mainstream").length} SITES · LANG {scope.toUpperCase()}
      <pre className="crawl-tooltip whitespace-pre-wrap">{errorText}</pre>
    </div>}
  </div>;
}
export function CrawlState({children}:{children:(data:CrawlData)=>React.ReactNode}) {
  const {data,error,isLoading}=useCrawl();
  if(isLoading) return <div className="p-3"><Loading/></div>;
  if(error) return <div className="p-3 text-signal">ERR · {String((error as Error).message)}</div>;
  if(!data) return <div className="label p-3 text-compare-muted">NO CRAWL YET · NEXT RUN SUN 03:23 UTC</div>;
  return children(data);
}