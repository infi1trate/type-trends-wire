import { spreadText } from "@/lib/crawl";
import { CrawlControls, CrawlState, useCrawl } from "./CrawlControls";
import { PanelHeader } from "./primitives";
import { Info } from "./Info";
import { label } from "@/lib/labels";
import { useSuspenseQuery } from "@tanstack/react-query";
import { signalsQuery } from "@/lib/data";
import { tierFor } from "@/lib/tiers";
import { BasisChip } from "./SignalBits";
import { CsvScope } from "@/components/dataview/CopyCsv";
/** Default view: spread rows for headline signals only; the rest stay in All signals and in each headline's drawer. */
function useHeadlineSpread() { const { data } = useSuspenseQuery(signalsQuery()); return (signal: string | null) => !!signal && (!data || tierFor(data.tiers, `spread:${signal}`) === "headline"); }
const signalName = (signal: string | null, fallback: string | null) => (signal ? label(`spread:${signal}`).name : fallback ?? "Signal");

const share = (v: number | null | undefined) => (v == null ? "—" : String(Math.round(v * 100)));
function Bar({ value }: { value: number | null | undefined }) {
  const v = value ?? 0, w = Math.min(60, Math.abs(v)) / 60 * 50;
  return <div className="relative mt-1 h-[3px] bg-g800" aria-hidden><span className="absolute left-1/2 h-full w-px bg-rule"/><span className={`absolute h-full ${v >= 0 ? "bg-highlight" : "bg-compare-muted"}`} style={{ left: `${v >= 0 ? 50 : 50 - w}%`, width: `${w}%` }}/></div>;
}

export function Spread() {
  const { scope } = useCrawl();
  const shown = useHeadlineSpread();
  return <section className="crawler flex min-h-0 flex-1 flex-col" aria-label="Spread">
    <PanelHeader g="p-spread" title={`SPREAD · VANGUARD / CURATED − MAINSTREAM · LANG ${scope.toUpperCase()}`}/>
    <CrawlControls/>
    <div className="min-h-0 flex-1 md:overflow-y-auto"><CrawlState>{data => {
      const curated = data.sites.filter(s => s.index_name === "curated"), mix: Record<string, number> = {};
      for (const s of curated) for (const g of new Set(s.galleries ?? [])) mix[g] = (mix[g] ?? 0) + 1;
      const mixText = Object.entries(mix).sort((a, b) => b[1] - a[1]).map(([g, n]) => `${g.toUpperCase()} ${n}`).join(" · ");
      return <>
        <CsvScope><table className="w-full table-fixed text-label">
          <caption className="sr-only">Share of sites per index for each signal; spread = vanguard − mainstream, lead = curated − mainstream, in percentage points.</caption>
          <thead className="text-compare-muted"><tr>
            <th className="p-2 text-left">SIGNAL<Info g="signal" /></th><th className="w-[6ch] text-right">V%<Info g="v-share" /></th><th className="w-[6ch] text-right">M%<Info g="m-share" /></th><th className="w-[6ch] text-right">C%<Info g="c-share" /></th>
            <th className="w-[9ch] p-2 text-right sm:w-[10ch]">SPREAD<Info g="spread" /></th><th className="w-[8ch] pr-2 text-right sm:w-[9ch]">LEAD<Info g="lead" /></th><th className="hidden w-[7ch] pr-2 text-right sm:table-cell">ΔWK<Info g="delta-week" /></th>
          </tr></thead>
          <tbody>{data.spread.filter(r => shown(r.signal)).map(r => <tr key={r.signal} className="border-b border-rule">
            <th className="crawl-tip relative p-2 text-left font-normal"><span tabIndex={0} className="flex min-w-0 flex-col items-start gap-0.5"><span className="max-w-full truncate">{signalName(r.signal, r.label)}</span>{r.signal && <BasisChip k={`spread:${r.signal}`} />}</span><span className="crawl-tooltip">{signalName(r.signal, r.label)}{r.prev_curation_lead_pts != null ? ` · LEAD PREV ${spreadText(r.prev_curation_lead_pts)}` : ""}</span><Bar value={r.spread_pts}/></th>
            <td className="num text-highlight">{share(r.vanguard_share)}</td><td className="num text-compare-muted">{share(r.mainstream_share)}</td><td className="num text-ink">{share(r.curated_share)}</td>
            <td className={`num p-2 ${(r.spread_pts ?? 0) > 0 ? "text-highlight" : "text-compare-muted"}`}>{spreadText(r.spread_pts)}</td>
            <td className={`num pr-2 ${(r.curation_lead_pts ?? 0) > 0 ? "text-highlight" : "text-compare-muted"}`}>{spreadText(r.curation_lead_pts)}</td>
            <td className="num hidden pr-2 text-compare-muted sm:table-cell">{r.prev_spread_pts == null ? <span title="First crawl for this signal; the weekly change appears after the next crawl.">new</span> : spreadText((r.spread_pts ?? 0) - r.prev_spread_pts)}</td>
          </tr>)}</tbody>
        </table></CsvScope>
        {data.spread.some(r => !shown(r.signal)) && <p className="text-label border-b border-rule p-3 text-compare-muted">HEADLINE SIGNALS ONLY · {data.spread.filter(r => !shown(r.signal)).length} SUPPORTING OR ARCHIVE READINGS HIDDEN ({data.spread.filter(r => !shown(r.signal)).map(r => signalName(r.signal, r.label)).join(", ")}). Each appears as evidence in its headline's drawer and in All signals.</p>}
        <p className="text-label p-3 text-compare-muted">Vanguard leads, mainstream follows. Positive = more common on design-forward sites. LEAD = curated galleries − mainstream.{curated.length ? ` CURATED ${curated.length} SITES · ${mixText || "NO GALLERY TAGS"}. Gallery picks are a biased sample.` : " No curated sites in this crawl yet; the C% column and curation lead fill in after the next weekly crawl that includes gallery picks."}</p>
      </>;
    }}</CrawlState></div>
  </section>;
}
export function SpreadTicker() {
  const { data } = useCrawl();
  const shown = useHeadlineSpread();
  return <>{data?.spread.filter(r => shown(r.signal)).slice(0, 4).map(r => <span key={r.signal} className="mr-8 inline-flex gap-2"><span className="normal-case text-ink">{signalName(r.signal, r.label)}</span><span className="text-g500">[{r.signal ? label(`spread:${r.signal}`).dimension : "LAYOUT"}]</span><span className="text-compare-muted">V{share(r.vanguard_share)} M{share(r.mainstream_share)}{r.curated_share != null ? ` C${share(r.curated_share)}` : ""}</span><span className={(r.spread_pts ?? 0) > 0 ? "text-highlight" : "text-compare-muted"}>{spreadText(r.spread_pts).replace(" PTS", "PTS")}</span></span>)}</>;
}
