// `/` — the live front page. Renders the pure front model (src/lib/front/front.ts) and nothing else; the live column and Moving now
// refresh from /front.json without a reload. Theme tokens and kit components only.
import { useCallback, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { FrontModel, FrontUpdates } from "@/lib/front/front";
import { FORMAT_LABEL, FORMAT_NOTE, FORMATS, frontSearch, type FormatFilter } from "@/lib/front/formats";
import { numberLabel } from "@/lib/stories/numbers";
import { storyTime } from "@/lib/stories";
import { sectorName } from "@/lib/labels";
import { pct } from "@/lib/digest/copy";
import { BasisWord, DigestShell, Dim, StageWord } from "@/components/digest/Editorial";
import { BarChart, DonutChart, LineChart, ScatterChart } from "@/components/charts/Charts";
import { BeforeAfter } from "./Evidence";
import { Receipt } from "./StoryCard";
import { ReadFooter, Spark } from "./Bits";
import { FrontClock, FrontTicker, LiveColumn, LiveItem, useNow } from "./FrontLive";
import { relTime } from "@/lib/front/front";

const FILTERS: FormatFilter[] = ["all", ...FORMATS];
const share = (v: number) => pct(v, 1) ?? "—";
const signed = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}`;
const Kicker = ({ id, children }: { id: string; children: React.ReactNode }) => <h2 id={id} className="ed-kicker ed-rule pt-3">{children}</h2>;

function FormatRow({ m }: { m: FrontModel }) {
  return <nav aria-label="Formats" className="ed-wrap no-print mt-4">
    <ul className="ed-data flex flex-wrap gap-x-1 gap-y-1">{FILTERS.map(f => <li key={f}>
      <Link to="/" search={frontSearch({ sector: m.sector, format: f })} aria-current={m.format === f ? "true" : undefined} resetScroll={false}
        className={`ed-tap inline-flex min-h-11 items-center border px-3 no-underline ${m.format === f ? "border-ed-ink font-semibold" : "border-transparent"}`}>{FORMAT_LABEL[f]}</Link>
    </li>)}</ul>
    <p className="ed-caption mt-1" aria-live="polite">Showing {m.format === "all" ? "every format" : `${FORMAT_LABEL[m.format]}: ${FORMAT_NOTE[m.format]}`}{m.sector !== "all" ? ` · ${sectorName(m.sector)} first` : ""}</p>
  </nav>;
}

function Lead({ m, now }: { m: FrontModel; now: number }) {
  const l = m.lead!;
  return <section aria-labelledby="front-lead" className="ed-wrap mt-6"><div className="border-b-2 border-ed-ink pb-8">
    <p className="ed-kicker flex flex-wrap items-center gap-2"><span className="tk-chip inline-block border px-1">{l.label}</span><span>{l.story.typeName}{l.story.sectorName ? ` · ${l.story.sectorName}` : ""}</span>{l.story.basis && <BasisWord b={l.story.basis} />}</p>
    <div className="ed-grid mt-3 gap-y-6">
      <div className={l.evidence ? "lg:col-span-7" : "lg:col-span-10"}>
        <h2 id="front-lead" className="ed-h1 break-words"><Link to="/stories/$id" params={{ id: l.story.id }} className="no-underline hover:underline">{l.story.headline}</Link></h2>
        {l.why && <p className="ed-standfirst mt-4"><span className="ed-kicker mr-2 align-middle">Why it matters</span>{l.why.text} {l.why.basis === "ai" && <BasisWord b="ai" />}</p>}
        <p className="ed-data ed-muted mt-3 flex flex-wrap gap-x-3">{l.story.number != null && <span className="font-semibold">{numberLabel(l.story.number)}</span>}<time dateTime={l.story.at}>{storyTime(l.story.at)}</time><span>{relTime(l.story.at, now)}</span>{l.story.corrected && <span>Corrected {l.story.corrected.slice(0, 10)}</span>}<Link to="/stories/$id" params={{ id: l.story.id }} className="ed-tap">Receipts →</Link></p>
      </div>
      {l.evidence?.kind === "crops" && <figure className="lg:col-span-5"><BeforeAfter before={l.evidence.before} after={l.evidence.after} /><figcaption className="ed-caption mt-2">Before → after · {l.evidence.section}</figcaption></figure>}
      {l.evidence?.kind === "spark" && <figure className="lg:col-span-5"><p className="ed-kicker">{l.evidence.name}: share by quarter</p><div className="mt-2"><Spark points={l.evidence.points} label={l.evidence.name} w={320} h={88} /></div><figcaption className="ed-caption mt-2">Well-covered quarters only (15+ sites, 25% coverage), all sectors. <Link to="/signals/$key" params={{ key: l.evidence.key }} className="ed-tap">Full chart →</Link></figcaption></figure>}
    </div>
  </div></section>;
}

function Moving({ moving }: { moving: NonNullable<FrontModel["moving"]> }) {
  return <section aria-labelledby="front-moving" className="ed-wrap mt-8">
    <Kicker id="front-moving">Moving now</Kicker>
    {moving.comparison && <p className="ed-caption mt-1">{moving.comparison}</p>}
    {moving.items.length ? <ul className="front-rail mt-3 flex gap-x-8 overflow-x-auto pb-2">{moving.items.map(x => <li key={x.key} className="ed-hair min-w-[15rem] pt-3">
      <Link to="/signals/$key" params={{ key: x.key }} className="ed-h3 no-underline hover:underline">{x.name}</Link>
      <p className="ed-data mt-1 flex flex-wrap items-center gap-2"><Dim d={x.dimension} /><span>{x.from ?? "Not staged"} → </span><StageWord stage={x.to as never} />{x.share != null && <span>{pct(x.share, 1)}</span>}</p>
    </li>)}</ul> : <p className="ed-small mt-2">{moving.line} <Link to="/signals" className="ed-tap">See every headline signal →</Link></p>}
  </section>;
}

function ChartOfDay({ c }: { c: NonNullable<FrontModel["chart"]> }) {
  const f = { title: c.title, note: c.note, source: c.source, receipt: c.receipt };
  return <section aria-labelledby="front-chart">
    <Kicker id="front-chart">Chart of the day</Kicker>
    <div className="mt-3">
      {c.kind === "scatter" && <ScatterChart {...f} points={c.points} x={{ label: "Share", format: share }} y={{ label: "Momentum (pts/q)", format: signed }} />}
      {c.kind === "line" && <LineChart {...f} series={c.series} y={{ label: "Share", format: share }} />}
      {c.kind === "bar" && <BarChart {...f} bars={c.bars} format={share} valueLabel="Share" />}
      {c.kind === "donut" && <DonutChart {...f} slices={c.slices} unit="stories" />}
    </div>
  </section>;
}

function Strip({ s, format, now }: { s: NonNullable<FrontModel["strip"]>; format: FormatFilter; now: number }) {
  if (s.kind === "pick") return <section aria-labelledby="front-sector">
    <Kicker id="front-sector">Your sector</Kicker>
    <p className="ed-small mt-2">Pick a sector to see its two strongest signals, its newest story and any opening.</p>
    <ul className="ed-data mt-2 flex flex-wrap gap-x-1">{s.sectors.map(x => <li key={x.id}><Link to="/" search={frontSearch({ sector: x.id, format })} resetScroll={false} className="ed-tap inline-flex min-h-11 items-center px-2">{x.name}</Link></li>)}</ul>
  </section>;
  return <section aria-labelledby="front-sector">
    <Kicker id="front-sector">Your sector · {s.name}</Kicker>
    {s.note && <p className="ed-caption mt-1">{s.note}</p>}
    {s.signals.length > 0 && <ul className="mt-2">{s.signals.map(x => <li key={x.key} className="ed-hair py-2"><Link to="/signals/$key" params={{ key: x.key }} className="ed-h4 no-underline hover:underline">{x.name}</Link><span className="ed-data mt-1 flex flex-wrap items-center gap-2"><StageWord stage={x.stage} /><span>{x.share == null ? "—" : pct(x.share, 1)}</span>{s.scope === "all" && <span className="ed-muted">all sectors</span>}</span></li>)}</ul>}
    {s.newest && <><p className="ed-kicker mt-4">Newest {s.name} story</p><ul className="mt-1"><LiveItem s={s.newest} now={now} /></ul></>}
    {s.whiteSpace && s.whiteSpace.id !== s.newest?.id && <><p className="ed-kicker mt-4">White space</p><ul className="mt-1"><LiveItem s={s.whiteSpace} now={now} /></ul></>}
    {!s.newest && <p className="ed-small mt-3">No {s.name} story in the last four months.</p>}
    <p className="ed-data mt-3"><Link to="/sectors/$sector" params={{ sector: s.sector }} className="ed-tap">State of {s.name}, the sector report →</Link></p>
  </section>;
}

export function FrontView({ m }: { m: FrontModel }) {
  const now = useNow(m.now, 30_000);
  const [moving, setMoving] = useState(m.moving);
  const onUpdates = useCallback((u: FrontUpdates) => { if (u.moving) setMoving(u.moving); }, []);
  const empty = m.format === "all" ? "No story in the last week." : `No ${FORMAT_LABEL[m.format]} stories this week.`;
  return <DigestShell label="Live" section="live" lens tour edition={null} dateline={<FrontClock now={m.now} />} segmented note={m.sector !== "all" ? `${sectorName(m.sector)} stories first in each group` : null}>
    <FrontTicker items={m.ticker} />
    <FormatRow m={m} />
    {m.lead ? <Lead m={m} now={now} /> : m.format === "all" && <p className="ed-wrap ed-standfirst mt-6">No story has run yet. Stories are written after each crawl, forecast and news check, and only when something in the data clears the bar.</p>}
    {moving && <Moving moving={moving} />}
    <div className="ed-wrap ed-grid mt-10 gap-y-12">
      <section aria-labelledby="front-live" className="lg:col-span-8" data-tour="r-live">
        <Kicker id="front-live">{m.format === "explore" ? "Explore" : "Live"}</Kicker>
        {m.state === "quiet" && m.format !== "explore" && <p className="ed-caption mt-1" role="note">Quiet: no new story in the last 24 hours. Below is the rest of this week{m.sections.archive ? ", then the same week from the archive" : ""}, each with the date it happened.</p>}
        {m.format === "explore"
          ? <ul className="mt-3">{m.explore.map(x => <li key={`${x.kind}:${x.key}`} className="ed-hair py-3"><span className="ed-kicker">{x.kind === "brand" ? "Brand" : "Pattern"}</span> <Link to={x.kind === "brand" ? "/brands/$domain" : "/patterns/$key"} params={x.kind === "brand" ? { domain: x.key } : { key: x.key }} className="ed-h4 no-underline hover:underline">{x.name}</Link><span className="ed-caption mt-1 block">In “{x.via}” · <time dateTime={x.at}>{storyTime(x.at)}</time></span></li>)}</ul>
          : <LiveColumn initial={m.column.items} serverNow={m.now} sector={m.sector} format={m.format} quiet={m.column.quiet} onUpdates={onUpdates} empty={empty} />}
        {m.format === "explore" && !m.sections.explore && <p className="ed-small mt-3">No brand or pattern page is behind this week's stories yet.</p>}
        {m.sections.archive && <section aria-labelledby="front-archive" className="mt-8">
          <h3 id="front-archive" className="ed-kicker">From the archive</h3>
          <ul className="mt-2 border-t border-ed-rule">{m.archive.map(a => <li key={a.id} className="tk-row"><Receipt href={a.href} className="tk-row-link block p-3"><span className="label tk-row-muted block">{a.match} · <time dateTime={a.at}>{a.date}</time>{a.number != null ? ` · ${numberLabel(a.number)}` : ""}</span><span className="tk-row-ink">{a.headline}</span>{a.line && <span className="tk-row-line">{a.line}</span>}</Receipt></li>)}</ul>
        </section>}
        <p className="ed-data mt-6"><Link to="/morning" className="ed-tap">Older stories, day by day, in the Morning Line →</Link></p>
      </section>
      <aside className="space-y-12 lg:col-span-4" aria-label="Chart of the day, new on the scene and your sector">
        {m.chart && <ChartOfDay c={m.chart} />}
        {m.sections.launches && <section aria-labelledby="front-launches">
          <Kicker id="front-launches">New on the scene</Kicker>
          <p className="ed-caption mt-1">Product Hunt launches. They never rank in the live column.</p>
          <ul className="mt-2">{m.launches.map(s => <LiveItem key={s.id} s={s} now={now} />)}</ul>
        </section>}
        {m.strip && <Strip s={m.strip} format={m.format} now={now} />}
        {m.format === "all" && m.sections.explore && <section aria-labelledby="front-explore">
          <Kicker id="front-explore">Explore</Kicker>
          <p className="ed-caption mt-1">Brand and pattern pages behind this week's stories.</p>
          <ul className="ed-data mt-2">{m.explore.map(x => <li key={`${x.kind}:${x.key}`}><Link to={x.kind === "brand" ? "/brands/$domain" : "/patterns/$key"} params={x.kind === "brand" ? { domain: x.key } : { key: x.key }} className="ed-tap inline-flex min-h-11 items-center gap-2"><span className="ed-muted">{x.kind === "brand" ? "Brand" : "Pattern"}</span>{x.name}</Link></li>)}</ul>
        </section>}
      </aside>
    </div>
    {m.sections.editions && <section aria-labelledby="front-editions" className="ed-wrap mt-14">
      <Kicker id="front-editions">Editions</Kicker>
      <ul className="mt-2 grid grid-cols-1 gap-x-8 md:grid-cols-3">{m.editions.map(e => <li key={e.id} className="ed-hair py-3"><Receipt href={e.href} className="ed-h4 no-underline hover:underline">{e.title}</Receipt><span className="ed-data ed-muted mt-1 block">{e.date}</span></li>)}</ul>
    </section>}
    <nav aria-label="About the front page" className="ed-wrap ed-data mt-14 flex flex-wrap gap-x-6">{m.footer.map(f => <Receipt key={f.href} href={f.href} className="ed-tap inline-flex min-h-11 items-center">{f.label}</Receipt>)}</nav>
    <ReadFooter terminal="/terminal" />
  </DigestShell>;
}
