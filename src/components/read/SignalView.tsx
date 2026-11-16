// SIGNAL object page (/signals/<key>): Headline → Evidence → So what → Related, in the editorial system.
import { Link } from "@tanstack/react-router";
import type { TraitPage } from "@/lib/digest/trait";
import { pct, pts } from "@/lib/digest/copy";
import { sectorName } from "@/lib/labels";
import { BasisWord, DigestShell, DigestFooter, Dim, Figure, SiteCard, StageWord, pr } from "@/components/digest/Editorial";
import { LedgerCall } from "@/components/digest/LedgerView";
import { EmbedPanel } from "@/components/embed/EmbedPanel";
import { AppLink } from "@/components/terminal/AppLink";
import { ObjectPage, BlockPart } from "./ObjectPage";
import { StoryCard } from "./StoryCard";

export function SignalView({ page: p, sector }: { page: TraitPage; sector: string }) {
  const footer = { methodology: "/#m-the-digest", glossary: "/#g-stage", rss: "/digest/rss.xml", terminal: p.terminal, contact: null };
  const lens = sector !== "all" ? p.byScope.find(r => r.scope === sector) ?? null : null;
  const note = sector !== "all" && !lens ? `${sectorName(sector)} has no forecast row for this signal, so numbers are all-sector` : null;
  return <DigestShell label={`${p.name} signal`} section="signals" lens note={note}>
    <ObjectPage kind="signal" id="ed-signal" blocks={{
      headline: <div className="ed-grid">
        <div className="lg:col-span-8">
          <p className="ed-kicker">Signal · {p.dimension}</p>
          <h1 id="ed-signal-title" className="ed-cover mt-3">{p.name}</h1>
          <p className="ed-data mt-4 flex flex-wrap items-center gap-x-3 gap-y-2"><Dim d={p.dimension} /><BasisWord b={p.basis} /><StageWord stage={p.stage} />{p.tier && <span className="ed-badge" title="Tier: what we show by default">{p.tier}</span>}
            {p.share != null && <span>{pct(p.share, 1)} of tracked homepages</span>}
            {p.momentum != null && <span>{p.momentum >= 0 ? "gaining" : "losing"} {pts(p.momentum)}</span>}
          </p>
          {lens && <p className="ed-data mt-2">In {sectorName(sector)}: <StageWord stage={lens.stage} /> {lens.share != null && <span>{pct(lens.share, 1)} of its homepages</span>}</p>}
          <p className="ed-standfirst mt-6">{p.definition}</p>
          <dl className="ed-data mt-6 grid max-w-xl grid-cols-2 gap-4">
            <div className="ed-hair pt-2"><dt className="ed-kicker">Momentum</dt><dd className="mt-1"><span className="text-[32px] leading-[40px]">{p.momentumIndex ?? "—"}</span>{p.direction && <span className="ml-2">{p.direction}</span>}</dd></div>
            <div className="ed-hair pt-2"><dt className="ed-kicker">Confidence</dt><dd className="mt-1"><span className="text-[32px] leading-[40px]">{p.confidence ?? "—"}</span></dd></div>
          </dl>
          {p.confidenceReason && <p className="ed-caption mt-2">{p.confidenceReason}. Momentum ranks the stored next-wave score among headline and supporting signals (0–100). <Link to="/what-we-show" className="ed-tap" {...pr("/what-we-show")}>How we derive these →</Link></p>}
        </div>
        <aside className="lg:col-span-4 lg:self-end" aria-label="How to read it and what to do">
          {p.stage && p.stageNote && <p className="ed-small"><span className="ed-kicker">Stage · {p.stage}</span><br />{p.stageNote}</p>}
          {p.dimensionNote && <p className="ed-small mt-4"><span className="ed-kicker">Dimension · {p.dimension}</span><br />{p.dimensionNote}</p>}
          <p className="ed-data mt-4 flex flex-col items-start">
            <AppLink href={p.whoUses} className="ed-tap">Who uses this well →</AppLink>
            <a href={`/watch/new?add=${encodeURIComponent(p.key)}`} className="ed-tap">+ Watch this signal</a>
            <AppLink href={p.terminal} className="ed-tap" {...pr(p.terminal)}>Open in terminal ⇄</AppLink>
          </p>
        </aside>
      </div>,
      evidence: <>
        <BlockPart title="Share by quarter" kicker="Solid line measured, band forecast (80% interval). Only quarters with at least 15 sites and 25% archive coverage are drawn.">
          {p.card ? <><Figure card={p.card} label={`${p.name}: share of tracked homepages by quarter, with the forecast band`} caption={<>Source: forecast run {p.runId ?? "—"}, data through {p.dataThrough ?? "—"}.</>} /><div className="mt-4"><EmbedPanel target={{ kind: "trait", key: p.key }} title={`${p.name} [${p.dimension}]`} /></div></> : <p className="ed-body">{p.chartNote}</p>}
        </BlockPart>
        {p.sectors.length > 0 && <BlockPart title="Where it leads" kicker="Sectors whose share is above the all-sector share.">
          <ul className="grid grid-cols-1 gap-6 md:grid-cols-3">{p.sectors.map(s => <li key={s.sector} className="ed-hair pt-3"><p className="ed-h3">{sectorName(s.sector)}</p><p className="ed-data mt-1 flex flex-wrap items-center gap-2">{pct(s.share, 1)} <span className="ed-muted">(+{(s.lead * 100).toFixed(1)} pts vs all)</span><StageWord stage={s.stage} /></p></li>)}</ul>
        </BlockPart>}
        {p.examples.length > 0 && <BlockPart title="Example brands" kicker="Library brands that adopted it early, ranked by how many quarters they led.">
          <div className="grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-4">{p.examples.map(e => <SiteCard key={e.domain} domain={e.domain} name={e.name} sector={e.sector} thumb={e.thumb} lines={e.adopted ? [`adopted ${e.adopted}`] : []} />)}</div>
        </BlockPart>}
        {p.evidence.length > 0 && <BlockPart title={p.evidenceTitle === "Member signals" ? "Composite members" : "Part of these composites"} kicker={p.rule ? `${p.name} counts a homepage when it has: ${p.rule}.` : "Composite signals this one counts toward."}>
          <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">{p.evidence.map(e => <li key={e.key} className="ed-hair min-w-0 pt-3">
            <Link to="/signals/$key" params={{ key: e.key }} className="ed-h3 no-underline hover:underline" {...pr(e.href)}>{e.name}</Link>
            <p className="ed-data mt-1 flex flex-wrap items-center gap-2"><Dim d={e.dimension} /><BasisWord b={e.basis} /><StageWord stage={e.stage} />{e.share != null && <span>{pct(e.share, 1)}</span>}{e.tier && <span className="ed-muted">{e.tier}</span>}</p>
          </li>)}</ul>
        </BlockPart>}
        <BlockPart title="Our calls" kicker="Every call the ledger recorded for this signal, newest first, with how it resolved.">
          {p.calls.length ? <ul className="space-y-6">{p.calls.map(c => <LedgerCall key={c.id} c={c} showName={false} />)}</ul> : <p className="ed-small">No calls recorded for this signal yet. The ledger records the signals the weekly brief names, every alert and the top 20 next-wave scores.</p>}
          <p className="ed-data mt-4"><Link to="/ledger" className="ed-tap" {...pr("/ledger")}>The full ledger →</Link></p>
        </BlockPart>
        {p.receipts.length > 0 && <details className="mt-10">
          <summary className="ed-kicker ed-tap cursor-pointer">The seven score components behind it</summary>
          <dl className="ed-body mt-4 space-y-4">{p.receipts.map(r => <div key={r.term} className="ed-hair grid grid-cols-1 gap-1 pt-3 md:grid-cols-[12rem_1fr]">
            <dt className="ed-kicker">{r.term}</dt><dd className="ed-small">{r.text} <a href={`/#${r.anchor}`} className="ed-data whitespace-nowrap" {...pr(`/#${r.anchor}`)}>Method →</a></dd>
          </div>)}</dl>
        </details>}
      </>,
      "so-what": <div className="ed-body">
        {p.soWhat ? <p className="ed-pull">{p.soWhat}</p> : <p className="ed-small">Not a headline signal, so we don't write a so-what line for it. {p.tierReasons.join(" ")}</p>}
        {p.tierReasons.length > 0 && p.soWhat && <p className="ed-caption mt-3 max-w-[72ch]"><span className="ed-kicker">Tier · {p.tier} · </span>{p.tierReasons.join(" ")} <Link to="/what-we-show" className="ed-tap" {...pr("/what-we-show")}>What we show and why →</Link></p>}
      </div>,
      related: <>
        {p.related.length > 0 && <BlockPart title="Signals in the same dimension" kicker={`Other ${p.dimension} headline signals, by share.`}>
          <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">{p.related.map(r => <li key={r.key} className="ed-hair pt-3">
            <Link to="/signals/$key" params={{ key: r.key }} className="ed-h3 no-underline hover:underline" {...pr(r.href)}>{r.name}</Link>
            <p className="ed-data mt-1 flex flex-wrap items-center gap-2"><StageWord stage={r.stage} />{r.share != null && <span>{pct(r.share, 0)}</span>}</p>
          </li>)}</ul>
        </BlockPart>}
        <BlockPart title="Brands showing it" kicker={p.showingTotal ? `${p.showingTotal} tracked brands show it on their current homepage; the latest captures first.` : undefined}>
          {p.showing.length ? <ul className="ed-data flex flex-wrap gap-x-5 gap-y-1">{p.showing.map(s => <li key={s.domain}><Link to="/brands/$domain" params={{ domain: s.domain }} className="ed-tap">{s.name ?? s.domain}</Link> <span className="ed-muted">{sectorName(s.sector)}</span></li>)}</ul> : <p className="ed-small">No tracked brand shows it on its current homepage.</p>}
        </BlockPart>
        <BlockPart title="Recent stories">
          {p.stories.length ? <div className="grid grid-cols-1 gap-8 md:grid-cols-2">{p.stories.map(s => <StoryCard key={s.id} s={s} />)}</div> : <p className="ed-small">No story has named this signal yet.</p>}
        </BlockPart>
      </>,
    }} />
    <DigestFooter footer={footer} />
  </DigestShell>;
}
