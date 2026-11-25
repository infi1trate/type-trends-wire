// /signals (Steady): one ranked Ledger grouped by tier — Headline, Supporting, then Archive folded behind one control. Each row: rank,
// name, stage, share now, an unfiltered sparkline of well-covered quarters, Momentum and the basis mark. The sector lens reorders by
// that sector's share and shows it against all sectors; sort, dimension filter and lens live in the URL.
import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { signalsIndexQuery } from "@/lib/data";
import { SIGNAL_TABS } from "@/lib/ia";
import { NOT_SCORED_RULE, SIGNAL_SORTS, signalsSearch, type SignalsGroup, type SignalsRow, type SignalsView } from "@/lib/signals-index";
import { sectorName } from "@/lib/labels";
import { pct } from "@/lib/digest/copy";
import { BasisWord, DigestShell, StageWord, pr } from "@/components/digest/Editorial";
import { RuleBox } from "@/components/brand/Containers";
import { ReadFooter } from "./Bits";
import { Sparkline } from "@/components/chartkit";
import { ScrollRow } from "./ScrollRow";
import { StructureIndex } from "./Structure";
import { Later, ROW } from "./Later";

const TIER_NOTE: Record<SignalsGroup["tier"], string> = { headline: "Shown by default everywhere: visible, decision-worthy, well measured and moving.", supporting: "Evidence: shown inside headline signals, audits and drawers.", archive: "Collected, never deleted, not shown by default." };
const signed = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)} pts`);

/** S1 · one tier as a table-like list: rank | name over chips | trend line (own column) | Share now | Momentum | Change. The three
 *  figures are fixed-width, right-aligned tabular columns under one header row per tier; below 768 px the trend line and the figures
 *  take a second line (each figure then carries its own small label, since the header row is hidden). */
export function SignalRows({ rows, scoped, sector, lensQ, label }: { rows: SignalsRow[]; scoped: boolean; sector: string; lensQ: string | undefined; label: string }) {
  const digits = Math.max(1, ...rows.map(r => String(r.rank).length));
  const fig = (name: string, body: React.ReactNode, key: string) => <span key={key} className="sig-fig tabular-nums"><span className="sig-fig-label ed-kicker md:sr-only">{name} </span>{body}</span>;
  return <div className="mt-3" data-signal-rows="">
    <div className="sig-head ed-kicker" aria-hidden="true"><span className="sig-rank" style={{ minWidth: `${digits}ch` }} /><span /><span className="sig-spark-col" /><span className="sig-fig">Share now</span><span className="sig-fig">Momentum</span><span className="sig-fig">Change</span></div>
    <ul className="ledger" aria-label={label} data-ledger="" data-ledger-digits={digits}>
      {rows.map(r => <li key={r.key} className="ledger-row" data-ledger-row="">
        <Link to={`/signals/${encodeURIComponent(r.key)}${lensQ ? `?sector=${lensQ}` : ""}` as string} className="ledger-link sig-link">
          <span className="ledger-num sig-rank" data-ledger-number=""><span className="ledger-fit"><span>{r.rank}</span><span aria-hidden="true" className="ledger-ghost">{"0".repeat(digits)}</span></span></span>
          <span className="ledger-title sig-name">{r.name}<span className="ledger-line flex flex-wrap items-center gap-2"><StageWord stage={r.stage} /><BasisWord b={r.basis} /></span></span>
          <span className="sig-spark-col sig-spark"><Sparkline look="read" w={240} h={32} stretch values={r.points} label={`${r.name}, well-covered quarters, all sectors`} /></span>
          {fig("Share now", scoped ? <>{pct(r.share, 1) ?? "—"} <span className="ledger-muted block">{sectorName(sector)} · {pct(r.allShare, 1) ?? "—"} all</span></> : pct(r.share, 1) ?? "—", "s")}
          {fig("Momentum", r.momentum == null ? "—" : <>{r.momentum}{r.momentumAll && <span className="ledger-muted block">all sectors</span>}</>, "m")}
          {fig("Change", signed(r.change), "c")}
        </Link>
      </li>)}
    </ul>
  </div>;
}

export function SignalsIndexView({ v }: { v: SignalsView }) {
  const { data } = useSuspenseQuery(signalsIndexQuery(v));
  const idx = data.idx;
  const lensQ = v.sector === "all" ? undefined : v.sector;
  return <DigestShell label="Signals" section="signals" lens note={idx.note}>
    <header className="ed-wrap pt-8 md:pt-12">
      <p className="ed-kicker">Signals · {sectorName(idx.scope)} · {data.runId != null ? `forecast run ${data.runId}` : "no forecast run yet"}</p>
      <h1 className="ed-cover hold-signals-title mt-3">What deserves your attention</h1>
      <p className={`ed-standfirst mt-5 max-w-[62ch]${idx.scoped ? "" : " hold-signals-deck"}`}>Every signal we measure, ranked within its tier{idx.scoped ? ` by ${sectorName(v.sector)}'s share, shown against all sectors` : ""}. Headline signals are visible to visitors, worth a brand decision, measured on enough sites and moving.</p>
      <p className="ed-small mt-3" data-leading-link=""><Link to="/signals/leading" className="ed-tap font-semibold" {...pr("/signals/leading")}>What builders are installing, before brands show it →</Link></p>
    </header>
    <section aria-label="Sort and filter" className="ed-wrap mt-8">
      <RuleBox className="grid gap-3 p-4">
        <nav aria-label="Dimension"><ScrollRow className="ed-data gap-x-5"><span className="ed-kicker">Dimension</span>{SIGNAL_TABS.map(t => <Link key={t.id} to="/signals" search={signalsSearch({ ...v, tab: t.id })} resetScroll={false} aria-current={v.tab === t.id ? "page" : undefined} className={`ed-tap no-underline ${v.tab === t.id ? "font-semibold underline decoration-2 underline-offset-[6px]" : ""}`}>{t.label}</Link>)}</ScrollRow></nav>
        <nav aria-label="Sort"><ScrollRow className="ed-data gap-x-5"><span className="ed-kicker">Sort</span>{SIGNAL_SORTS.map(t => <Link key={t.id} to="/signals" search={signalsSearch({ ...v, sort: t.id })} resetScroll={false} aria-current={v.sort === t.id ? "true" : undefined} className={`ed-tap no-underline ${v.sort === t.id ? "font-semibold underline decoration-2 underline-offset-[6px]" : ""}`}>{t.id === "share" && idx.scoped ? `${sectorName(v.sector)} share` : t.label}</Link>)}</ScrollRow></nav>
      </RuleBox>
      <p className="ed-caption mt-3" aria-live="polite" data-count-line="">{(() => { const m = /^(\d+ headline)/.exec(idx.countLine); return m ? <><mark className="hl-mark" data-highlight="">{m[1]}</mark>{idx.countLine.slice(m[1]!.length)}</> : idx.countLine; })()} Change is from the first to the latest well-covered quarter (15+ sites, 25% coverage), all sectors. <Link to="/what-we-show" className="ed-tap" {...pr("/what-we-show")}>What we show and why →</Link></p>
    </section>
    {v.tab === "structure" ? <Later id="structure-index" shapes={[{ kind: "rows", n: 12, height: ROW.ledger }]}><StructureIndex scope={v.sector} /></Later> : idx.groups.map(g => {
      const head = <><h2 id={`sig-${g.tier}`} className="ed-h3 inline">{g.title} · {g.count}</h2><p className="ed-caption mt-1">{TIER_NOTE[g.tier]}</p></>;
      const cut = g.unscoredFrom ?? g.rows.length, scored = g.rows.slice(0, cut), unscored = g.rows.slice(cut);
      const all = signalsSearch({ ...v, archive: true });
      const body = g.count ? <>
        {scored.length > 0 && <SignalRows label={`${g.title} signals`} rows={scored} scoped={idx.scoped} sector={v.sector} lensQ={lensQ} />}
        {unscored.length > 0 && <><h3 className="ed-kicker mt-6" data-not-scored="">{NOT_SCORED_RULE} · {unscored.length}</h3><SignalRows label={`${g.title} signals, Momentum not scored`} rows={unscored} scoped={idx.scoped} sector={v.sector} lensQ={lensQ} /></>}
        {!g.folded && g.rows.length < g.count && <p className="ed-data mt-4"><Link to="/signals" search={all} hash={`sig-${g.tier}`} className="ed-tap underline" data-show-all="">Show all {g.count} {g.title.toLowerCase()} signals →</Link> <span className="ed-caption">The first {g.rows.length} are shown; the full list also opens the archive.</span></p>}
      </>
        : <p className="ed-body mt-3">No {g.title.toLowerCase()} signal in this dimension{idx.scoped ? ` for ${sectorName(v.sector)}` : ""} this week. Pick another dimension or switch the lens to All.</p>;
      return g.tier === "archive"
        ? <section key={g.tier} aria-labelledby={`sig-${g.tier}`} className="ed-wrap mt-12" data-archive-fold={g.folded ? "folded" : "open"}>{head}
          <p className="ed-data mt-2"><Link to="/signals" search={g.folded ? all : signalsSearch({ ...v, archive: false })} {...(g.folded ? { hash: "sig-archive" } : { resetScroll: false })} className="ed-tap underline">{g.folded ? `Show the ${g.count} archive signals →` : "Fold the archive"}</Link></p>
          {!g.folded && body}</section>
        : <section key={g.tier} aria-labelledby={`sig-${g.tier}`} className="ed-wrap mt-12">{head}{body}</section>;
    })}
    <ReadFooter terminal="/terminal?panel=overview" />
  </DigestShell>;
}
