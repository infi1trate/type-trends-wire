// /signals (Steady): one ranked Ledger grouped by tier — Headline, Supporting, then Archive folded behind one control. Each row: rank,
// name, stage, share now, an unfiltered sparkline of well-covered quarters, Momentum and the basis mark. The sector lens reorders by
// that sector's share and shows it against all sectors; sort, dimension filter and lens live in the URL.
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { signalSeriesQuery, signalsQuery } from "@/lib/data";
import { SIGNAL_TABS } from "@/lib/ia";
import { lensSignals } from "@/lib/sector-lens";
import { SIGNAL_SORTS, momentumText, signalsIndex, signalsSearch, type SignalsGroup, type SignalsRow, type SignalsView } from "@/lib/signals-index";
import { sectorName } from "@/lib/labels";
import { pct } from "@/lib/digest/copy";
import { BasisWord, DigestShell, StageWord, pr } from "@/components/digest/Editorial";
import { Ledger } from "@/components/brand/Ledger";
import { RuleBox } from "@/components/brand/Containers";
import { ReadFooter, Spark } from "./Bits";
import { ScrollRow } from "./ScrollRow";

const TIER_NOTE: Record<SignalsGroup["tier"], string> = { headline: "Shown by default everywhere: visible, decision-worthy, well measured and moving.", supporting: "Evidence: shown inside headline signals, audits and drawers.", archive: "Collected, never deleted, not shown by default." };
const signed = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)} pts`);

function rowsOf(g: SignalsGroup, scoped: boolean, sector: string, lensQ: string | undefined) {
  return g.rows.map((r: SignalsRow) => ({
    key: r.key, href: `/signals/${encodeURIComponent(r.key)}${lensQ ? `?sector=${lensQ}` : ""}`, number: r.rank, title: r.name,
    line: <span className="inline-flex flex-wrap items-center gap-2"><StageWord stage={r.stage} /><BasisWord b={r.basis} /><Spark points={r.points} label={`${r.name}, well-covered quarters, all sectors`} /></span>,
    facts: [
      <span key="s" className="tabular-nums">{scoped ? <>{pct(r.share, 1) ?? "—"} <span className="ledger-muted">{sectorName(sector)} · {pct(r.allShare, 1) ?? "—"} all</span></> : pct(r.share, 1) ?? "—"}</span>,
      momentumText(r), signed(r.change),
    ],
  }));
}

export function SignalsIndexView({ v }: { v: SignalsView }) {
  const { data } = useSuspenseQuery(signalsQuery());
  const { data: series } = useSuspenseQuery(signalSeriesQuery("all"));
  const idx = useMemo(() => {
    const lens = lensSignals(data.snap.rows, data.tiers, v.sector), all = v.sector === "all" ? lens.signals : lensSignals(data.snap.rows, data.tiers, "all").signals;
    return signalsIndex({ all, lens, series }, v);
  }, [data, series, v]);
  const lensQ = v.sector === "all" ? undefined : v.sector;
  return <DigestShell label="Signals" section="signals" lens note={idx.note}>
    <header className="ed-wrap pt-8 md:pt-12">
      <p className="ed-kicker">Signals · {sectorName(idx.scope)} · forecast run {data.snap.run_id ?? "—"}</p>
      <h1 className="ed-cover mt-3">What deserves your attention</h1>
      <p className="ed-standfirst mt-5 max-w-[62ch]">Every signal we measure, ranked within its tier{idx.scoped ? ` by ${sectorName(v.sector)}'s share, shown against all sectors` : ""}. Headline signals are visible to visitors, worth a brand decision, measured on enough sites and moving.</p>
    </header>
    <section aria-label="Sort and filter" className="ed-wrap mt-8">
      <RuleBox className="grid gap-3 p-4">
        <nav aria-label="Dimension"><ScrollRow className="ed-data gap-x-5"><span className="ed-kicker">Dimension</span>{SIGNAL_TABS.map(t => <Link key={t.id} to="/signals" search={signalsSearch({ ...v, tab: t.id })} resetScroll={false} aria-current={v.tab === t.id ? "page" : undefined} className={`ed-tap no-underline ${v.tab === t.id ? "font-semibold underline decoration-2 underline-offset-[6px]" : ""}`}>{t.label}</Link>)}</ScrollRow></nav>
        <nav aria-label="Sort"><ScrollRow className="ed-data gap-x-5"><span className="ed-kicker">Sort</span>{SIGNAL_SORTS.map(t => <Link key={t.id} to="/signals" search={signalsSearch({ ...v, sort: t.id })} resetScroll={false} aria-current={v.sort === t.id ? "true" : undefined} className={`ed-tap no-underline ${v.sort === t.id ? "font-semibold underline decoration-2 underline-offset-[6px]" : ""}`}>{t.id === "share" && idx.scoped ? `${sectorName(v.sector)} share` : t.label}</Link>)}</ScrollRow></nav>
      </RuleBox>
      <p className="ed-caption mt-3" aria-live="polite" data-count-line="">{idx.countLine} Change is from the first to the latest well-covered quarter (15+ sites, 25% coverage), all sectors. <Link to="/what-we-show" className="ed-tap" {...pr("/what-we-show")}>What we show and why →</Link></p>
    </section>
    {idx.groups.map(g => {
      const head = <><h2 id={`sig-${g.tier}`} className="ed-h3 inline">{g.title} · {g.rows.length}</h2><p className="ed-caption mt-1">{TIER_NOTE[g.tier]}</p></>;
      const body = g.rows.length ? <Ledger className="mt-3" label={`${g.title} signals`} rows={rowsOf(g, idx.scoped, v.sector, lensQ)} />
        : <p className="ed-body mt-3">No {g.title.toLowerCase()} signal in this dimension{idx.scoped ? ` for ${sectorName(v.sector)}` : ""} this week. Pick another dimension or switch the lens to All.</p>;
      return g.tier === "archive"
        ? <section key={g.tier} aria-labelledby={`sig-${g.tier}`} className="ed-wrap mt-12"><details open={!g.folded} data-archive-fold=""><summary className="ed-tap cursor-pointer list-none">{head}<span className="ed-data mt-2 block underline">{g.folded ? `Show the ${g.rows.length} archive signals` : "Fold the archive"}</span></summary>{body}</details></section>
        : <section key={g.tier} aria-labelledby={`sig-${g.tier}`} className="ed-wrap mt-12">{head}{body}</section>;
    })}
    <ReadFooter terminal="/terminal?panel=overview" />
  </DigestShell>;
}
