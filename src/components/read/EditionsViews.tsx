// EDITIONS in Read mode: the Morning Line (daily), sector reports (quarterly), the /editions index and the private /welcome page.
// Current editorial type system and chrome; every number links to its receipts. No AI per view.
import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { NO_COMPARISON_TEXT } from "@/lib/run-gap";
import { storyTime } from "@/lib/stories";
import { pct } from "@/lib/digest/copy";
import { cardText } from "@/lib/chart/card";
import { label as traitLabel, type StageName } from "@/lib/labels";
import { EDITIONS } from "@/lib/ia";
import { MCP_TOOL_COUNT } from "@/lib/site";
import { signalSeriesQuery } from "@/lib/data";
import type { MorningItem } from "@/lib/editions/morning";
import type { loadMorning, loadSectorIndex, loadEditions } from "@/lib/editions/editions.server";
import type { SectorReport } from "@/lib/editions/sector";
import type { loadWelcome } from "@/lib/editions/welcome.server";
import { BasisWord, DigestShell, SectionHead, StageWord, pr } from "@/components/digest/Editorial";
import { CropFigure, CropFallback } from "./Evidence";
import { ReadFooter, Spark } from "./Bits";

const Item = ({ s, lead = false }: { s: MorningItem; lead?: boolean }) => <article className={lead ? "" : "ed-hair pt-4"}>
  <p className="ed-kicker flex flex-wrap items-center gap-2">{s.kicker}</p>
  <h3 className={`${lead ? "ed-h1" : "ed-h3"} mt-2`}><Link to="/stories/$id" params={{ id: s.id }} className="no-underline hover:underline" {...pr(s.href)}>{s.headline}</Link></h3>
  {s.deck && <p className={lead ? "ed-standfirst mt-4" : "ed-small mt-2"}>{s.deck}</p>}
  {s.why.text && <p className="ed-small mt-2"><span className="ed-kicker mr-2">Why it matters</span>{s.why.text} {s.why.basis === "ai" && <BasisWord b="ai" />}</p>}
  <p className="ed-data ed-muted mt-2 flex flex-wrap gap-x-3"><time dateTime={s.at}>{storyTime(s.at)}</time><span>Score {s.score}</span><Link to="/stories/$id" params={{ id: s.id }} className="ed-tap">Receipts →</Link></p>
</article>;

function LeadSpark({ k }: { k: string }) {
  const { data } = useQuery(signalSeriesQuery("all"));
  return <p className="ed-data mt-3 flex flex-wrap items-center gap-3"><Spark points={data?.[k]} label={traitLabel(k).name} /><Link to="/signals/$key" params={{ key: k }} className="ed-tap">{traitLabel(k).name} →</Link></p>;
}

export type MorningData = NonNullable<Awaited<ReturnType<typeof loadMorning>>>;
export function MorningView({ d }: { d: MorningData }) {
  const e = d.edition;
  return <DigestShell label="The Morning Line" edition="morning">
    <header className="ed-wrap pt-8 md:pt-12">
      <p className="ed-kicker">The Morning Line · daily · {e.final ? "final edition" : "today, updating until the UTC day ends"}</p>
      <h1 className="ed-cover mt-3">{e.title}</h1>
      <p className="ed-standfirst mt-5 max-w-[60ch]">{e.count ? `${e.count} ${e.count === 1 ? "story" : "stories"} ran in the 24 hours to ${storyTime(e.window.to)}, ranked by score.` : `No story ran in the 24 hours to ${storyTime(e.window.to)}.`}{e.final ? " This edition no longer changes." : ""}</p>
      {e.thin && <p className="ed-small mt-3 max-w-[60ch] font-semibold" data-testid="thin">A thin edition: fewer than three stories cleared the bar. {e.lastFull ? "The last full edition is below." : "There is no full edition yet to show below."}</p>}
    </header>
    <div className="ed-wrap ed-grid mt-10">
      <div className="lg:col-span-8">
        <section aria-labelledby="ml-lead">
          <h2 id="ml-lead" className="ed-kicker ed-rule pt-3">The lead</h2>
          <div className="mt-4">{e.lead ? <Item s={e.lead} lead /> : <p className="ed-small">No lead today.</p>}</div>
        </section>
        {e.more.length > 0 && <section aria-labelledby="ml-more" className="mt-12">
          <h2 id="ml-more" className="ed-kicker ed-rule pt-3">Also today · by score</h2>
          <div className="mt-4 grid grid-cols-1 gap-8 md:grid-cols-2">{e.more.map(s => <Item key={s.id} s={s} />)}</div>
        </section>}
        <section aria-labelledby="ml-opening" className="mt-12">
          <h2 id="ml-opening" className="ed-kicker ed-rule pt-3">The opening of the day</h2>
          <p className="ed-caption mt-1">The best white-space story of the last seven days not used in the previous three editions.</p>
          <div className="mt-4">{e.opening ? <Item s={e.opening} /> : <p className="ed-small">{e.openingInList ? "This week's white-space stories already run above, so there is no separate opening today." : "No opening this time: no unused white-space story from the last seven days."}</p>}</div>
        </section>
        {e.lastFull && <section aria-labelledby="ml-last" className="mt-12">
          <h2 id="ml-last" className="ed-kicker ed-rule pt-3">The last full edition · <Link to="/morning/$date" params={{ date: e.lastFull.day }} className="ed-tap">{e.lastFull.title}</Link></h2>
          <div className="mt-4"><Item s={e.lastFull.lead} /></div>
          {e.lastFull.more.length > 0 && <ul className="mt-4 space-y-2">{e.lastFull.more.map(s => <li key={s.id} className="ed-small"><Link to="/stories/$id" params={{ id: s.id }} className="ed-tap">{s.headline}</Link> <span className="ed-data ed-muted">Score {s.score}</span></li>)}</ul>}
        </section>}
      </div>
      <aside className="space-y-12 lg:col-span-4" aria-label="Moving now, figure and the desk">
        <section aria-labelledby="ml-moving">
          <h2 id="ml-moving" className="ed-kicker ed-rule pt-3">Moving now</h2>
          <p className="ed-caption mt-1">{e.moving.pair ? `Headline signals that changed stage between forecast run ${e.moving.pair.earlier.id} and run ${e.moving.pair.latest.id} (${e.moving.pair.days} days apart).` : "Headline signals that changed stage week over week."}</p>
          {e.moving.items.length ? <ul className="mt-3 space-y-3">{e.moving.items.map(m => <li key={m.key} className="ed-hair pt-2"><Link to="/signals/$key" params={{ key: m.key }} className="ed-h3 no-underline hover:underline">{m.name}</Link>
            <p className="ed-data mt-1 flex flex-wrap items-center gap-2"><span>{m.from} → </span><StageWord stage={m.to as StageName} />{m.share != null && <span>{pct(m.share, 1)}</span>}</p></li>)}</ul>
            : <p className="ed-small mt-3">{e.moving.pair ? "No headline signal changed stage between those runs." : NO_COMPARISON_TEXT}</p>}
        </section>
        <section aria-labelledby="ml-figure">
          <h2 id="ml-figure" className="ed-kicker ed-rule pt-3">The figure</h2>
          {e.figure?.kind === "chart" ? <>
            <Link to="/chart/$week" params={{ week: e.figure.week }} className="mt-3 block border border-ed-ink"><img src={`/chart/${e.figure.week}.png`} width={1200} height={675} loading="lazy" decoding="async" className="block h-auto w-full" alt={`Chart of the week ${e.figure.week}: ${cardText(e.figure.model).name} share by quarter.`} /></Link>
            <p className="ed-small mt-2">Chart of the week {e.figure.week}: {cardText(e.figure.model).call}</p>
          </> : e.figure?.kind === "signal" ? <><p className="ed-caption mt-1">The lead story's signal, share by quarter.</p><LeadSpark k={e.figure.key} /></> : <p className="ed-small mt-3">No figure for this edition.</p>}
        </section>
        <section aria-labelledby="ml-desk">
          <h2 id="ml-desk" className="ed-kicker ed-rule pt-3">On the desk</h2>
          <p className="ed-caption mt-1">Stories the engine held in this window, and why.</p>
          {e.desk.length ? <ul className="mt-3 space-y-3">{e.desk.map(h => <li key={h.id} className="ed-hair pt-2 ed-small"><Link to="/stories/$id" params={{ id: h.id }} className="ed-tap">{h.headline}</Link><span className="ed-caption block">Held: {h.reason} · score {h.score}</span></li>)}</ul> : <p className="ed-small mt-3">Nothing held in this window.</p>}
        </section>
        <section aria-labelledby="ml-archive">
          <h2 id="ml-archive" className="ed-kicker ed-rule pt-3">Archive</h2>
          <ul className="ed-data mt-3 space-y-1">{d.archive.map(a => <li key={a.day}><Link to="/morning/$date" params={{ date: a.day }} className="ed-tap inline-flex min-h-11 items-center lg:min-h-0" aria-current={a.day === e.day ? "page" : undefined}>{a.day}</Link> <span className="ed-muted">· {a.count} {a.count === 1 ? "story" : "stories"}{a.final ? "" : " · today"}</span></li>)}</ul>
          <p className="ed-data mt-3"><a href="/morning/rss.xml" className="ed-tap">RSS (finished editions)</a></p>
        </section>
      </aside>
    </div>
    <ReadFooter terminal="/terminal?panel=morning" />
  </DigestShell>;
}

// SECTOR REPORTS ------------------------------------------------------------------------------------
const share = (v: number | null) => pct(v, 1) ?? "—";
function Side({ s }: { s: { stage: StageName | null; share: number | null; momentum_index: number | null } }) {
  return <span className="flex flex-wrap items-center gap-2"><StageWord stage={s.stage} /><span>{share(s.share)}</span><span className="ed-muted">Momentum {s.momentum_index ?? "—"}</span></span>;
}
const StoryList = ({ items, empty }: { items: { id: string; kicker: string; headline: string; at: string; score: number }[]; empty: string }) => items.length
  ? <ul className="space-y-3">{items.map(s => <li key={s.id} className="ed-hair pt-2"><p className="ed-kicker">{s.kicker}</p><Link to="/stories/$id" params={{ id: s.id }} className="ed-h3 no-underline hover:underline" {...pr(`/stories/${encodeURIComponent(s.id)}`)}>{s.headline}</Link><p className="ed-data ed-muted mt-1">{storyTime(s.at)} · score {s.score}</p></li>)}</ul>
  : <p className="ed-small">{empty}</p>;
const Block = ({ n, id, title, kicker, children }: { n: string; id: string; title: string; kicker?: string; children: ReactNode }) =>
  <section aria-labelledby={id} className="ed-wrap mt-14"><SectionHead n={n} id={id} title={title} kicker={kicker} />{children}</section>;

export function SectorReportView({ r }: { r: SectorReport }) {
  const nav = useNavigate();
  const onChange = (s: string) => { if (s === "all") void nav({ to: "/sectors" }); else void nav({ to: "/sectors/$sector", params: { sector: s } }); };
  const num = (b: (typeof r.blocks)[number]) => String(r.blocks.indexOf(b)).padStart(2, "0");
  return <DigestShell label={r.title} edition="sectors" fixedSector={{ value: r.sector, onChange }}>
    <div className="sector-report">
      <header className="sector-cover ed-wrap pt-8 md:pt-12" data-block="headline">
        <p className="ed-kicker">Sector report · quarterly · as of {r.asOfText}</p>
        <h1 className="ed-cover mt-3">{r.title}</h1>
        <p className="ed-standfirst mt-5 max-w-[60ch]">{r.brands} brands tracked in {r.name}. {r.coverage.enough ? `${r.signals.length} headline signals measured here, ${r.contrast.risingHere.length} rising here and not elsewhere, ${r.storiesInQuarter} ${r.storiesInQuarter === 1 ? "story" : "stories"} this quarter.` : `${r.storiesInQuarter} ${r.storiesInQuarter === 1 ? "story" : "stories"} this quarter.`}</p>
        {r.note && <p className="ed-small mt-3 max-w-[60ch] font-semibold">{r.note}</p>}
        <p className="ed-caption mt-3 max-w-[72ch]">{r.basis}</p>
        <p className="print-only ed-caption mt-3" {...pr(r.href)}>{r.href}</p>
      </header>
      <Block n={num("signals")} id="sr-signals" title="Headline signals" kicker={`Stage, share and Momentum in ${r.name} against all sectors.`}>
        {r.signals.length ? <div className="overflow-x-auto"><table className="ed-data w-full min-w-[620px] border-collapse text-left">
          <caption className="sr-only">Headline signals in {r.name} against all sectors</caption>
          <thead><tr className="ed-kicker"><th scope="col" className="py-2 pr-3 font-semibold">Signal</th><th scope="col" className="py-2 pr-3 font-semibold">{r.name}</th><th scope="col" className="py-2 font-semibold">All sectors</th></tr></thead>
          <tbody>{r.signals.map(s => <tr key={s.key} className="ed-hair align-top"><th scope="row" className="py-2 pr-3 font-normal"><Link to="/signals/$key" params={{ key: s.key }} search={{ sector: r.sector }} className="ed-tap">{s.name}</Link> <span className="ed-muted">[{s.dimension}]</span> {s.basis === "ai" && <BasisWord b="ai" />}</th><td className="py-2 pr-3"><Side s={s.here} /></td><td className="py-2"><Side s={s.all} /></td></tr>)}</tbody>
        </table></div> : <p className="ed-small">{r.note ?? "No headline signal is measured in this sector yet."}</p>}
      </Block>
      <Block n={num("contrast")} id="sr-contrast" title="Here, not elsewhere" kicker="Rising or emerging in this sector while not rising across all sectors, and the reverse.">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {([["Rising here, not elsewhere", r.contrast.risingHere], ["Rising elsewhere, not here", r.contrast.risingElsewhere]] as const).map(([t, xs]) => <div key={t}>
            <h3 className="ed-kicker">{t}</h3>
            {xs.length ? <ul className="mt-3 space-y-3">{xs.map(s => <li key={s.key} className="ed-hair pt-2"><Link to="/signals/$key" params={{ key: s.key }} search={{ sector: r.sector }} className="ed-h3 no-underline hover:underline">{s.name}</Link><p className="ed-data mt-1">Here: {s.here.stage ?? "not staged"} · all sectors: {s.all.stage ?? "not staged"}</p></li>)}</ul> : <p className="ed-small mt-3">None this quarter.</p>}
          </div>)}
        </div>
      </Block>
      <Block n={num("white-space")} id="sr-white" title="White space" kicker="Signals rising elsewhere that this sector's brands have not picked up (stories from the last 90 days)."><StoryList items={r.whiteSpace} empty="No white-space story for this sector in the last 90 days." /></Block>
      <Block n={num("counter-moves")} id="sr-counter" title="Counter-moves" kicker="Brands here moving against a signal's direction (last 90 days)."><StoryList items={r.counterMoves} empty="No counter-move in this sector in the last 90 days." /></Block>
      <Block n={num("leaders")} id="sr-leaders" title="Who leads it" kicker="Trendsetter rank in the forecast run, with each brand's latest published move.">
        {r.leaders.length ? <ol className="space-y-3">{r.leaders.map(l => <li key={l.domain} className="ed-hair grid grid-cols-[4ch_1fr] gap-x-3 pt-2"><span className="ed-data">#{l.rank}</span><span><Link to="/brands/$domain" params={{ domain: l.domain }} className="ed-tap font-semibold">{l.name ?? l.domain}</Link> <span className="ed-data ed-muted">{l.domain}</span>{l.latest ? <span className="ed-small block">Latest move: <Link to="/stories/$id" params={{ id: l.latest.id }} className="ed-tap">{l.latest.headline}</Link> <span className="ed-data ed-muted">{storyTime(l.latest.at)}</span></span> : <span className="ed-caption block">No published move yet.</span>}</span></li>)}</ol> : <p className="ed-small">No trendsetter from this sector in the forecast run.</p>}
      </Block>
      <Block n={num("patterns")} id="sr-patterns" title="Patterns in this sector" kicker="Example brands here that show each pattern; section crops where a current one exists.">
        {r.patterns.length ? <div className="grid grid-cols-1 gap-10">{r.patterns.map(p => <div key={p.key}>
          <h3 className="ed-h3"><a href={p.href} className="no-underline hover:underline">{p.name}</a> <span className="ed-data ed-muted">{p.examples} examples · {p.withCaptures} with captures</span></h3>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">{p.sample.map(x => <div key={x.domain}>{x.crop ? <CropFigure crop={x.crop} sizes="(min-width: 768px) 33vw, 100vw" /> : <CropFallback domain={x.domain} section="hero" />}<p className="ed-data mt-1"><Link to="/brands/$domain" params={{ domain: x.domain }} className="ed-tap">{x.name ?? x.domain}</Link></p></div>)}</div>
        </div>)}</div> : <p className="ed-small">No pattern has three or more examples in this sector yet.</p>}
      </Block>
      <Block n={num("stories")} id="sr-stories" title={`The stories of ${r.quarter.label}`} kicker={`Published stories about ${r.name} this quarter, by score (${r.storiesInQuarter} in all).`}><StoryList items={r.stories} empty="No published story about this sector this quarter yet." /></Block>
      <Block n={num("basis")} id="sr-basis" title="What the numbers are based on"><p className="ed-small max-w-[72ch]">{r.basis} Sector numbers are shown only when at least half of the headline signals are measured in the sector ({r.coverage.covered} of {r.coverage.total} here). No AI-written text appears in this report.</p></Block>
    </div>
    <ReadFooter terminal={`/terminal?panel=sectors&sector=${r.sector}`} />
  </DigestShell>;
}

export type SectorIndexData = Awaited<ReturnType<typeof loadSectorIndex>>;
export function SectorsIndexView({ d }: { d: SectorIndexData }) {
  const covered = d.sectors.filter(s => s.enough), thin = d.sectors.filter(s => !s.enough);
  const Row = ({ s }: { s: SectorIndexData["sectors"][number] }) => <li className="ed-hair pt-3"><Link to="/sectors/$sector" params={{ sector: s.sector }} className="ed-h3 no-underline hover:underline">State of {s.name}</Link><p className="ed-data ed-muted mt-1">{s.brands} brands · {s.covered} of {s.total} headline signals measured · {s.stories} stories this quarter</p></li>;
  return <DigestShell label="Sector reports" edition="sectors">
    <header className="ed-wrap pt-8 md:pt-12">
      <p className="ed-kicker">Sector reports · quarterly</p>
      <h1 className="ed-cover mt-3">The state of each sector</h1>
      <p className="ed-standfirst mt-5 max-w-[60ch]">One report per sector for the current quarter, built from the forecast run{d.run ? ` of ${storyTime(d.run.at)}` : ""}, stored stories and the brands we track. Each prints as a clean document.</p>
    </header>
    <section aria-labelledby="sx-covered" className="ed-wrap mt-10"><h2 id="sx-covered" className="ed-kicker ed-rule pt-3">With forecast coverage</h2>
      {covered.length ? <ul className="mt-3 grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">{covered.map(s => <Row key={s.sector} s={s} />)}</ul> : <p className="ed-small mt-3">No sector has enough forecast coverage yet.</p>}
    </section>
    {thin.length > 0 && <section aria-labelledby="sx-thin" className="ed-wrap mt-10"><h2 id="sx-thin" className="ed-kicker ed-rule pt-3">Not enough coverage yet</h2>
      <p className="ed-caption mt-1">These reports show stories, brands and patterns, without sector signal numbers.</p>
      <ul className="mt-3 grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">{thin.map(s => <Row key={s.sector} s={s} />)}</ul></section>}
    <ReadFooter terminal="/terminal?panel=sectors" />
  </DigestShell>;
}

export type EditionsData = Awaited<ReturnType<typeof loadEditions>>;
export function EditionsView({ d }: { d: EditionsData }) {
  return <DigestShell label="Editions" edition={null}>
    <header className="ed-wrap pt-8 md:pt-12">
      <p className="ed-kicker">Editions</p>
      <h1 className="ed-cover mt-3">Daily, weekly, quarterly</h1>
      <p className="ed-standfirst mt-5 max-w-[60ch]">Three shapes of the same newsroom. Each is built from stored stories and signals, never written per visit.</p>
    </header>
    <div className="ed-wrap mt-10 grid grid-cols-1 gap-10 md:grid-cols-3">
      {EDITIONS.map(x => <section key={x.id} aria-labelledby={`edn-${x.id}`} className="ed-rule pt-3">
        <p className="ed-kicker">{x.rhythm}</p>
        <h2 id={`edn-${x.id}`} className="ed-h2 mt-2"><a href={x.read} className="no-underline hover:underline">{x.name}</a></h2>
        <p className="ed-small mt-2">{x.what}</p>
        {x.id === "morning" && <p className="ed-small mt-3">{d.morning?.lead ? <>Today: <Link to="/stories/$id" params={{ id: d.morning.lead.id }} className="ed-tap">{d.morning.lead.headline}</Link> <span className="ed-data ed-muted">· {d.morning.count} {d.morning.count === 1 ? "story" : "stories"}</span></> : "No story yet today."}</p>}
        {x.id === "digest" && <p className="ed-small mt-3">{d.digest ? <>Latest issue: <Link to="/digest/$week" params={{ week: d.digest.week }} className="ed-tap">{d.digest.week}</Link></> : "No issue stored yet."}</p>}
        {x.id === "sectors" && <p className="ed-small mt-3">{d.sectors.filter(s => s.enough).length} of {d.sectors.length} sectors have forecast coverage.</p>}
        <p className="ed-data mt-3"><a href={x.read} className="ed-tap">Open {x.name} →</a></p>
      </section>)}
    </div>
    <ReadFooter terminal="/terminal?panel=digest" />
  </DigestShell>;
}

// WELCOME (private) -----------------------------------------------------------------------------------
export type WelcomeData = Awaited<ReturnType<typeof loadWelcome>>;
const PACKAGES = [
  { name: "Reader", what: ["Live front page and every story", "The Morning Line (daily)", "The Digest (weekly)"] },
  { name: "Desk", what: ["Terminal mode", "Signals, brand and pattern pages", "Sector reports (quarterly)", "Competitive audits", "Watchlists"] },
  { name: "Agency", what: ["Everything in Reader and Desk", "MCP keys for agent access", "Embeds"] },
];
export function WelcomeView({ d }: { d: WelcomeData }) {
  const Ex = ({ job, title, children }: { job: string; title: string; children: ReactNode }) => <section className="ed-rule pt-3" aria-label={job}><p className="ed-kicker">{job}</p><h3 className="ed-h3 mt-1">{title}</h3><div className="mt-3">{children}</div></section>;
  return <DigestShell label="Welcome" section="tools" edition={null}>
    <header className="ed-wrap pt-8 md:pt-12">
      <p className="ed-kicker">Private preview · not public</p>
      <h1 className="ed-cover mt-3">The live newsroom for how brands look and sound on the web</h1>
      <p className="ed-standfirst mt-5 max-w-[60ch]">We crawl a library of brand homepages, measure what changes and write it up as stories with receipts. For brand, marketing and agency leads who need to spot a move, prove it and act on it.</p>
    </header>
    <section aria-labelledby="w-jobs" className="ed-wrap mt-12"><SectionHead n="01" id="w-jobs" title="Three jobs" kicker="Each shown with what is live right now." />
      <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
        <Ex job="Spot" title="See what changed today">{d.spot ? <><p className="ed-kicker">{d.spot.kicker}</p><p className="ed-h3 mt-1"><a href={d.spot.href} className="no-underline hover:underline">{d.spot.headline}</a></p><p className="ed-data ed-muted mt-1">{storyTime(d.spot.at)}</p></> : <p className="ed-small">No lead story yet.</p>}</Ex>
        <Ex job="Prove" title="Show the receipts">{d.prove ? <><p className="ed-h3"><a href={d.prove.href} className="no-underline hover:underline">{d.prove.name}</a> <span className="ed-data ed-muted">{d.prove.sectorName}</span></p>{d.prove.lastMove && <p className="ed-small mt-2">Latest: {d.prove.lastMove.text}</p>}{d.prove.shows.length > 0 && <p className="ed-data mt-2">Shows: {d.prove.shows.map(s => s.name).join(", ")}</p>}<p className="ed-small mt-2">{d.prove.soWhat}</p></> : <p className="ed-small">No brand page to excerpt yet.</p>}</Ex>
        <Ex job="Act" title="Find the opening">{d.act ? <><p className="ed-kicker">{d.act.kicker}</p><p className="ed-h3 mt-1"><a href={d.act.href} className="no-underline hover:underline">{d.act.headline}</a></p>{d.act.deck && <p className="ed-small mt-2">{d.act.deck}</p>}</> : <p className="ed-small">No white-space story right now.</p>}</Ex>
      </div>
    </section>
    <section aria-labelledby="w-editions" className="ed-wrap mt-14"><SectionHead n="02" id="w-editions" title="The editions" kicker="A rhythm to read it by." />
      <ul className="grid grid-cols-1 gap-6 md:grid-cols-3">{EDITIONS.map(x => <li key={x.id} className="ed-hair pt-2"><p className="ed-kicker">{x.rhythm}</p><p className="ed-h3 mt-1"><a href={x.read} className="no-underline hover:underline">{x.name}</a></p><p className="ed-small mt-1">{x.what}</p></li>)}</ul>
      <p className="ed-caption mt-3">{d.editions.morning ? `${d.editions.morning.title}: ${d.editions.morning.count} stories so far.` : ""} {d.editions.sectors} sectors with forecast coverage.</p>
    </section>
    <section aria-labelledby="w-tools" className="ed-wrap mt-14"><SectionHead n="03" id="w-tools" title="The tools" />
      <ul className="ed-small grid grid-cols-1 gap-3 md:grid-cols-2">
        <li><Link to="/audit/new" className="ed-tap font-semibold">Competitive audit</Link>: compare two to six sites side by side.</li>
        <li><Link to="/watch/new" className="ed-tap font-semibold">Watchlists</Link>: a client's competitive set, with a private feed.</li>
        <li><Link to="/ledger" className="ed-tap font-semibold">The ledger</Link>: every forecast call and how it resolved.</li>
        <li><Link to="/tools" className="ed-tap font-semibold">Embeds</Link>: a signal or chart on any page.</li>
      </ul>
    </section>
    <section aria-labelledby="w-agents" className="ed-wrap mt-14"><SectionHead n="04" id="w-agents" title="Agent access" />
      <p className="ed-small max-w-[72ch]">An MCP server with {MCP_TOOL_COUNT} tools lets assistants read the same stories, signals, editions and receipts, including the Morning Line and sector reports.</p>
    </section>
    <section aria-labelledby="w-how" className="ed-wrap mt-14"><SectionHead n="05" id="w-how" title="How it is made" />
      <ul className="ed-small max-w-[72ch] space-y-2">
        <li>We measure type, color and layout from each page's code and rendered styles.</li>
        <li>Some traits are read by an AI from homepage captures; those are marked <BasisWord b="ai" /> everywhere they appear.</li>
        <li>Every number links to its receipts, and every story to the data behind it.</li>
        <li>Forecast calls are kept in a public ledger that cannot be rewritten. <Link to="/what-we-show" className="ed-tap">What we show and why</Link>.</li>
      </ul>
    </section>
    <section aria-labelledby="w-who" className="ed-wrap mt-14"><SectionHead n="06" id="w-who" title="Who it is for" />
      <p className="ed-small max-w-[72ch]">Brand, marketing and agency leads first: people who brief designers, pitch clients and need to say what the market is doing, with proof.</p>
    </section>
    <section aria-labelledby="w-draft" className="ed-wrap mt-14 border-2 border-ed-ink p-4" data-testid="draft-packaging"><p className="ed-kicker">Draft · not public · no prices</p>
      <h2 id="w-draft" className="ed-h2 mt-2">Draft packaging</h2>
      <p className="ed-small mt-2 max-w-[72ch]">Three packages, described only by what is in them. Names and prices are the owner's to decide; there is no sign-up.</p>
      <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-3">{PACKAGES.map(p => <div key={p.name} className="ed-hair pt-2"><h3 className="ed-h3">{p.name}</h3><ul className="ed-small mt-2 list-disc pl-5">{p.what.map(w => <li key={w}>{w}</li>)}</ul></div>)}</div>
    </section>
    <ReadFooter terminal="/terminal" />
  </DigestShell>;
}
