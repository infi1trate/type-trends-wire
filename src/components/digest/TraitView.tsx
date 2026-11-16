import { Link } from "@tanstack/react-router";
import type { TraitPage } from "@/lib/digest/trait";
import { pct, pts } from "@/lib/digest/copy";
import { BasisWord, DigestShell, DigestFooter, Dim, Figure, SectionHead, SiteCard, StageWord, pr } from "./Editorial";
import { LedgerCall } from "./LedgerView";
import { EmbedPanel } from "@/components/embed/EmbedPanel";

export function TraitView({ page: p }: { page: TraitPage }) {
  const footer = { methodology: "/#m-the-digest", glossary: "/#g-stage", rss: "/digest/rss.xml", terminal: "/", contact: null };
  let n = 0; const next = () => String(++n).padStart(2, "0");
  return <DigestShell label={`${p.name} explainer`}>
    <article aria-labelledby="ed-trait">
      <header className="ed-wrap ed-grid pt-10 md:pt-14">
        <div className="lg:col-span-8">
          <p className="ed-kicker">Signal explainer · {p.dimension}</p>
          <h1 id="ed-trait" className="ed-cover mt-3">{p.name}</h1>
          <p className="ed-data mt-4 flex flex-wrap items-center gap-x-3 gap-y-2"><Dim d={p.dimension} /><BasisWord b={p.basis} /><StageWord stage={p.stage} />{p.tier && <span className="ed-badge" title="Tier: what we show by default">{p.tier}</span>}
            {p.share != null && <span>{pct(p.share, 1)} of tracked homepages</span>}
            {p.momentum != null && <span>{p.momentum >= 0 ? "gaining" : "losing"} {pts(p.momentum)}</span>}
          </p>
          <p className="ed-standfirst mt-6">{p.definition}</p>
          {p.soWhat && <p className="ed-body mt-4"><span className="ed-kicker">So what · </span>{p.soWhat}</p>}
          <dl className="ed-data mt-6 grid max-w-xl grid-cols-2 gap-4">
            <div className="ed-hair pt-2"><dt className="ed-kicker">Momentum</dt><dd className="mt-1"><span className="text-[32px] leading-[40px]">{p.momentumIndex ?? "—"}</span>{p.direction && <span className="ml-2">{p.direction}</span>}</dd></div>
            <div className="ed-hair pt-2"><dt className="ed-kicker">Confidence</dt><dd className="mt-1"><span className="text-[32px] leading-[40px]">{p.confidence ?? "—"}</span></dd></div>
          </dl>
          {p.confidenceReason && <p className="ed-caption mt-2">{p.confidenceReason}. Momentum ranks the stored next-wave score among headline and supporting signals (0–100). <Link to="/what-we-show" className="ed-tap" {...pr("/what-we-show")}>How we derive these →</Link></p>}
        </div>
        <aside className="lg:col-span-4 lg:self-end" aria-label="How to read it">
          {p.stage && p.stageNote && <p className="ed-small"><span className="ed-kicker">Stage · {p.stage}</span><br />{p.stageNote}</p>}
          {p.dimensionNote && <p className="ed-small mt-4"><span className="ed-kicker">Dimension · {p.dimension}</span><br />{p.dimensionNote}</p>}
          <p className="ed-data mt-4"><Link to="/" search={{ panel: "brief", trait: p.key, sector: "all" }} className="ed-tap" {...pr(p.terminal)}>Open in terminal →</Link></p>
        </aside>
      </header>

      <section aria-labelledby="ed-t-chart" className="ed-wrap mt-12">
        <SectionHead n={next()} id="ed-t-chart" title="Share by quarter" />
        {p.card ? <Figure card={p.card} label={`${p.name}: share of tracked homepages by quarter, with the forecast band`} caption={<>Solid line measured, band forecast (80% interval). Source: forecast run {p.runId ?? "—"}, data through {p.dataThrough ?? "—"}. Only quarters with at least 15 sites and 25% archive coverage are drawn.</>} />
          : <p className="ed-body">{p.chartNote}</p>}
        {p.card && <div className="mt-4"><EmbedPanel target={{ kind: "trait", key: p.key }} title={`${p.name} [${p.dimension}]`} /></div>}
      </section>

      {(p.evidence.length > 0 || p.tierReasons.length > 0) && <section aria-labelledby="ed-t-evidence" className="ed-wrap mt-16">
        <SectionHead n={next()} id="ed-t-evidence" title={p.evidence.length ? p.evidenceTitle : "Why it is shown this way"} kicker={p.rule ? `${p.name} counts a homepage when it has: ${p.rule}.` : p.evidence.length ? "Composite signals this one counts toward." : undefined} />
        {p.evidence.length > 0 && <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">{p.evidence.map(e => <li key={e.key} className="ed-hair min-w-0 pt-3">
          <Link to="/trait/$key" params={{ key: e.key }} className="ed-h3 no-underline hover:underline" {...pr(e.href)}>{e.name}</Link>
          <p className="ed-data mt-1 flex flex-wrap items-center gap-2"><Dim d={e.dimension} /><BasisWord b={e.basis} /><StageWord stage={e.stage} />{e.share != null && <span>{pct(e.share, 1)}</span>}{e.tier && <span className="ed-muted">{e.tier}</span>}</p>
        </li>)}</ul>}
        {p.tierReasons.length > 0 && <p className="ed-caption mt-4 max-w-[72ch]"><span className="ed-kicker">Tier · {p.tier} · </span>{p.tierReasons.join(" ")} <Link to="/what-we-show" className="ed-tap" {...pr("/what-we-show")}>What we show and why →</Link></p>}
      </section>}

      <section aria-labelledby="ed-t-calls" className="ed-wrap mt-16">
        <SectionHead n={next()} id="ed-t-calls" title="Our calls" kicker="Every call the ledger recorded for this signal, newest first, with how it resolved." />
        {p.calls.length ? <ul className="space-y-6">{p.calls.map(c => <LedgerCall key={c.id} c={c} showName={false} />)}</ul> : <p className="ed-body ed-small">No calls recorded for this signal yet. The ledger records the signals the weekly brief names, every alert and the top 20 next-wave scores.</p>}
        <p className="ed-data mt-4"><Link to="/ledger" className="ed-tap" {...pr("/ledger")}>The full ledger →</Link></p>
      </section>

      {p.sectors.length > 0 && <section aria-labelledby="ed-t-sectors" className="ed-wrap mt-16">
        <SectionHead n={next()} id="ed-t-sectors" title="Where it leads" kicker="Sectors whose share is above the all-sector share." />
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-3">{p.sectors.map(s => <li key={s.sector} className="ed-hair pt-3">
          <p className="ed-h3">{s.sector}</p>
          <p className="ed-data mt-1 flex flex-wrap items-center gap-2">{pct(s.share, 1)} <span className="ed-muted">(+{(s.lead * 100).toFixed(1)} pts vs all)</span><StageWord stage={s.stage} /></p>
        </li>)}</ul>
      </section>}

      {p.receipts.length > 0 && <section aria-labelledby="ed-t-receipts" className="ed-wrap mt-16">
        <SectionHead n={next()} id="ed-t-receipts" title="How we know" kicker="The parts of the forecast behind this signal, in words. Each links to its method." />
        <dl className="ed-body space-y-4">{p.receipts.map(r => <div key={r.term} className="ed-hair grid grid-cols-1 gap-1 pt-3 md:grid-cols-[12rem_1fr]">
          <dt className="ed-kicker">{r.term}</dt>
          <dd className="ed-small">{r.text} <a href={`/#${r.anchor}`} className="ed-data whitespace-nowrap" {...pr(`/#${r.anchor}`)}>Method →</a></dd>
        </div>)}</dl>
      </section>}

      {p.examples.length > 0 && <section aria-labelledby="ed-t-examples" className="ed-wrap mt-16">
        <SectionHead n={next()} id="ed-t-examples" title="Example sites" kicker="Library sites that adopted it early, ranked by how many quarters they led." />
        <div className="grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-4">{p.examples.map(e => <SiteCard key={e.domain} domain={e.domain} name={e.name} sector={e.sector} thumb={e.thumb} lines={e.adopted ? [`adopted ${e.adopted}`] : []} />)}</div>
      </section>}

      {p.related.length > 0 && <section aria-labelledby="ed-t-related" className="ed-wrap mt-16">
        <SectionHead n={next()} id="ed-t-related" title="Related signals" kicker={`Other ${p.dimension} signals, by share.`} />
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">{p.related.map(r => <li key={r.key} className="ed-hair pt-3">
          <Link to="/trait/$key" params={{ key: r.key }} className="ed-h3 no-underline hover:underline" {...pr(r.href)}>{r.name}</Link>
          <p className="ed-data mt-1 flex flex-wrap items-center gap-2"><StageWord stage={r.stage} />{r.share != null && <span>{pct(r.share, 0)}</span>}</p>
        </li>)}</ul>
      </section>}
    </article>
    <DigestFooter footer={footer} />
  </DigestShell>;
}
