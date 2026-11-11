import { percent, spreadText } from "@/lib/crawl";
import { CrawlControls, CrawlState, useCrawl } from "./CrawlControls";
import { PanelHeader } from "./primitives";

export function Spread() {
  const {scope}=useCrawl();
  return <section className="crawler flex min-h-0 flex-1 flex-col" aria-label="Spread">
    <PanelHeader title={`SPREAD · VANGUARD − MAINSTREAM · LANG ${scope.toUpperCase()}`}/>
    <CrawlControls/>
    <div className="min-h-0 flex-1 md:overflow-y-auto"><CrawlState>{data=><>
      <table className="w-full table-fixed text-label"><thead className="text-compare-muted"><tr><th className="p-2 text-left">SIGNAL</th><th className="w-[5ch] text-right">V%</th><th className="w-[5ch] text-right">M%</th><th className="w-[8ch] p-2 text-right">SPREAD</th><th className="w-[5ch] text-right">ΔWK</th></tr></thead><tbody>{data.spread.map(r=><tr key={r.signal} className="border-b border-rule"><th className="crawl-tip relative p-2 text-left font-normal"><span tabIndex={0} className="block truncate">{r.label}</span><span className="crawl-tooltip">{r.label}</span><div className="relative mt-1 h-[3px] bg-g800" aria-hidden><span className="absolute left-1/2 h-full w-px bg-rule"/><span className={`absolute h-full ${(r.spread_pts??0)>=0?"bg-signal":"bg-compare-muted"}`} style={{left:`${(r.spread_pts??0)>=0?50:50-Math.min(60,Math.abs(r.spread_pts??0))/60*50}%`,width:`${Math.min(60,Math.abs(r.spread_pts??0))/60*50}%`}}/></div></th><td className="num text-signal">{Math.round((r.vanguard_share??0)*100)}</td><td className="num text-compare-muted">{Math.round((r.mainstream_share??0)*100)}</td><td className={`num p-2 ${(r.spread_pts??0)>0?"text-signal":"text-compare-muted"}`}>{spreadText(r.spread_pts)}</td><td className="num text-compare-muted">{r.prev_spread_pts==null?"—":spreadText((r.spread_pts??0)-r.prev_spread_pts)}</td></tr>)}</tbody></table>
      <p className="text-label p-3 text-compare-muted">Vanguard leads, mainstream follows. Positive = more common on design-forward sites.</p>
    </>}</CrawlState></div>
  </section>;
}
export function SpreadTicker() {
  const {data}=useCrawl();
  return <>{data?.spread.slice(0,4).map(r=><span key={r.signal} className="mr-8 inline-flex gap-2"><span className="text-ink">${r.signal?.replace(/_/g,"-").toUpperCase()}</span><span className="text-compare-muted">V{Math.round((r.vanguard_share??0)*100)} M{Math.round((r.mainstream_share??0)*100)}</span><span className={(r.spread_pts??0)>0?"text-signal":"text-compare-muted"}>{spreadText(r.spread_pts).replace(" PTS","PTS")}</span></span>)}</>;
}