// /signals: headline signals ranked by Momentum, grouped by dimension tabs; a tier switch reaches supporting and archive.
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { signalSeriesQuery, signalsQuery } from "@/lib/data";
import { SIGNAL_TABS, signalTabOf, type SignalTab } from "@/lib/ia";
import { lensSignals } from "@/lib/sector-lens";
import { TIERS, TIER_WORD, type Tier } from "@/lib/tiers";
import { sectorName } from "@/lib/labels";
import { pct } from "@/lib/digest/copy";
import { BasisWord, DigestShell, Dim, StageWord, pr } from "@/components/digest/Editorial";
import { ReadFooter, Spark } from "./Bits";

const byMomentum = <T extends { momentum_index: number | null; share: number | null; name: string }>(a: T, b: T) => (b.momentum_index ?? -1) - (a.momentum_index ?? -1) || (b.share ?? 0) - (a.share ?? 0) || a.name.localeCompare(b.name);
const TIER_NOTE: Record<Tier, string> = { headline: "Shown by default everywhere: visible, decision-worthy, well measured and moving.", supporting: "Evidence: shown inside headline signals, audits and drawers.", archive: "Collected, never deleted, not shown by default." };

export function SignalsIndexView({ tab, tier, sector }: { tab: SignalTab; tier: Tier; sector: string }) {
  const { data } = useSuspenseQuery(signalsQuery());
  const lens = useMemo(() => lensSignals(data.snap.rows, data.tiers, sector), [data, sector]);
  const { data: series } = useQuery(signalSeriesQuery(lens.scope));
  const lensQ = sector === "all" ? undefined : sector, tierQ = tier === "headline" ? undefined : tier;
  const inTier = lens.signals.filter(s => s.tier === tier);
  const rows = inTier.filter(s => tab === "all" || signalTabOf(s.key, s.dimension) === tab).sort(byMomentum);
  const count = (t: SignalTab) => inTier.filter(s => t === "all" || signalTabOf(s.key, s.dimension) === t).length;
  return <DigestShell label="Signals" section="signals" lens note={lens.note}>
    <header className="ed-wrap pt-8 md:pt-12">
      <p className="ed-kicker">Signals · {sectorName(lens.scope)} · forecast run {data.snap.run_id ?? "—"}</p>
      <h1 className="ed-cover mt-3">What deserves your attention</h1>
      <p className="ed-standfirst mt-5">Headline signals ranked by Momentum: each is visible to visitors, worth a brand decision, measured on enough sites and moving.</p>
    </header>
    <div className="ed-wrap mt-8 flex flex-col gap-4 border-y border-ed-ink py-2 md:flex-row md:items-center md:justify-between">
      <nav aria-label="Dimensions" className="ed-data flex flex-wrap gap-x-5">{SIGNAL_TABS.map(t => <Link key={t.id} to="/signals" search={{ tab: t.id === "all" ? undefined : t.id, tier: tierQ, sector: lensQ }} aria-current={tab === t.id ? "page" : undefined} className={`ed-tap no-underline ${tab === t.id ? "font-semibold underline decoration-2 underline-offset-[6px]" : ""}`}>{t.label}<span className="ed-muted ml-1.5">{count(t.id)}</span></Link>)}</nav>
      <nav aria-label="Tier" className="ed-data flex flex-wrap items-center gap-x-4"><span className="ed-kicker">Tier</span>{TIERS.map(t => <Link key={t} to="/signals" search={{ tab: tab === "all" ? undefined : tab, tier: t === "headline" ? undefined : t, sector: lensQ }} aria-current={tier === t ? "true" : undefined} className={`ed-tap no-underline ${tier === t ? "font-semibold underline decoration-2 underline-offset-[6px]" : ""}`}>{TIER_WORD[t].toLowerCase().replace(/^./, c => c.toUpperCase())}</Link>)}</nav>
    </div>
    <p className="ed-wrap ed-caption mt-2">{TIER_NOTE[tier]} <Link to="/what-we-show" className="ed-tap" {...pr("/what-we-show")}>What we show and why →</Link> <Link to="/data" className="ed-tap">Data stories →</Link></p>
    <section aria-label={`${TIER_WORD[tier]} signals`} className="ed-wrap mt-6">
      {rows.length ? <ol>{rows.map((s, i) => <li key={s.key} className="ed-hair grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 gap-y-1 py-4 md:grid-cols-[2.5rem_minmax(0,5fr)_minmax(0,3fr)_minmax(0,4fr)]">
        <span className="ed-data ed-muted pt-1">{String(i + 1).padStart(2, "0")}</span>
        <div className="min-w-0">
          <Link to="/signals/$key" params={{ key: s.key }} search={{ sector: lensQ }} className="ed-h3 no-underline hover:underline" data-tour={i === 0 ? "r-signal" : undefined}>{s.name}</Link>
          <p className="ed-data mt-1 flex flex-wrap items-center gap-2"><Dim d={s.dimension} /><BasisWord b={s.basis} /><StageWord stage={s.stage} />{s.share != null && <span>{pct(s.share, 1)}</span>}</p>
        </div>
        <dl className="ed-data col-start-2 flex flex-wrap items-center gap-x-4 md:col-start-auto">
          <div><dt className="ed-kicker">Momentum</dt><dd>{s.momentum_index ?? "—"}{s.direction ? ` · ${s.direction}` : ""}</dd></div>
          <div><dt className="ed-kicker">Confidence</dt><dd title={s.confidence_reason}>{s.confidence}</dd></div>
          <div className="self-end"><Spark points={series?.[s.key]} label={s.name} /></div>
        </dl>
        <p className="ed-small col-start-2 md:col-start-auto">{s.so_what ?? <span className="ed-caption">{s.reasons.join(" ")}</span>}</p>
      </li>)}</ol> : <p className="ed-body py-6">No {TIER_WORD[tier].toLowerCase()} signal in this dimension{lens.scope !== "all" ? ` for ${sectorName(lens.scope)}` : ""} this week.</p>}
    </section>
    <ReadFooter terminal="/terminal?panel=overview" />
  </DigestShell>;
}
