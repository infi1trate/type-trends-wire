import { line as voiced } from "@/lib/voice";
// `/` — the live front page. Renders the pure front model (src/lib/front/front.ts) and nothing else; the live column and Moving now
// refresh from /front.json without a reload. Composition A (brand/README.md, "Layout moves"), Steady density: a date and state line
// pinned left and right; ONE pink Plate for the lead; Moving now as a rule box; the live column as a Ledger; chart of the day in a Card;
// the sector strip, editions and data stories as rule boxes. Nothing else is filled with colour.
import { useCallback, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BRAND_NAME } from "@/lib/brand";
import type { FrontModel, FrontRest, FrontTop, FrontUpdates } from "@/lib/front/front";
import { useSuspenseQuery } from "@tanstack/react-query";
import { frontRestQuery } from "@/lib/data";
import { Later, ROW } from "./Later";
import { FORMAT_LABEL, FORMAT_NOTE, FORMATS, frontSearch, type FormatFilter } from "@/lib/front/formats";
import { numberLabel } from "@/lib/stories/numbers";
import { storyTime } from "@/lib/stories";
import { sectorName } from "@/lib/labels";
import { pct } from "@/lib/digest/copy";
import { DigestShell, Dim, StageWord } from "@/components/digest/Editorial";
import { BarChart, DonutChart, LineChart, ScatterChart } from "@/components/charts/Charts";
import { Card, Plate, Raised, RuleBox } from "@/components/brand/Containers";
import { Ledger } from "@/components/brand/Ledger";
import { BeforeAfter, CoverFigure, CropFigure } from "./Evidence";
import { Receipt } from "./StoryCard";
import { ReadFooter } from "./Bits";
import { STAFF_HREFS, useStaffKey } from "@/lib/staff-key";
import { LeadFigureSlot } from "./Covers";
import { FiltersScope } from "@/components/brand/Illustration";
import { FrontDate, FrontTicker, LiveColumn, LiveItem, useNow } from "./FrontLive";
import { leadFigure, relTime } from "@/lib/front/front";

const FILTERS: FormatFilter[] = ["all", ...FORMATS];
const share = (v: number) => pct(v, 1) ?? "—";
const signed = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}`;
const Kicker = ({ id, children }: { id: string; children: ReactNode }) => <h2 id={id} className="ed-kicker">{children}</h2>;
const STATE_WORD = { busy: "Busy", steady: "Steady", quiet: "Quiet" } as const;
const STATE_NOTE = { busy: "Three or more stories in the last six hours", steady: "A story in the last day", quiet: voiced("read.frontView.1") } as const;

function FormatRow({ m }: { m: Pick<FrontModel, "sector" | "format"> }) {
  return <nav aria-label="Formats" className="no-print min-w-0 md:flex-1">
    <ul className="ed-navtext front-formats flex gap-x-5 overflow-x-auto">{FILTERS.map(f => <li key={f} className="shrink-0">
      <Link to="/" search={frontSearch({ sector: m.sector, format: f })} aria-current={m.format === f ? "true" : undefined} resetScroll={false}
        className={`-mb-[3px] inline-flex min-h-11 items-center border-b-[3px] no-underline ${m.format === f ? "border-ed-ink" : "border-transparent"}`}>{FORMAT_LABEL[f]}</Link>
    </li>)}</ul>
    <p className={`ed-caption ${m.format === "all" && m.sector === "all" ? "sr-only" : "mt-1"}`} aria-live="polite">Showing {m.format === "all" ? "every format" : `${FORMAT_LABEL[m.format]}: ${FORMAT_NOTE[m.format]}`}{m.sector !== "all" ? ` · ${sectorName(m.sector)} first` : ""}</p>
  </nav>;
}

/** The lead: the page's one Plate. Kicker with the story number, H1, deck, a Raised "Receipts" button, the basis mark and the evidence slot. */
function Lead({ m, now }: { m: FrontTop; now: number }) {
  const l = m.lead!, fig = leadFigure(l.evidence);
  return <section aria-labelledby="front-lead"><Plate className="md:p-10">
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      <div className={l.evidence ? "lg:col-span-7" : "lg:col-span-10"}>
        <p className="ed-kicker flex flex-wrap items-center gap-x-3 gap-y-1">{l.story.number != null && <span className="plate-num">{numberLabel(l.story.number)}</span>}<span>{l.label}</span><span>{l.story.typeName}{l.story.sectorName ? ` · ${l.story.sectorName}` : ""}</span></p>
        <h2 id="front-lead" className="ed-h1 mt-4 break-words"><Link to="/stories/$id" params={{ id: l.story.id }} className="no-underline hover:underline">{l.story.headline}</Link></h2>
        {l.story.line && <p className="ed-standfirst mt-5">{l.story.line}</p>}
        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Raised href={`/stories/${encodeURIComponent(l.story.id)}`}>Receipts →</Raised>
          <span className="ed-data"><time dateTime={l.story.at}>{storyTime(l.story.at)}</time> · {relTime(l.story.at, now)}{l.story.corrected && <> · Corrected {l.story.corrected.slice(0, 10)}</>}</span>
        </div>
      </div>
      {l.evidence?.kind === "crops" && <figure className="lg:col-span-5" data-evidence=""><BeforeAfter before={l.evidence.before} after={l.evidence.after} /><figcaption className="ed-caption mt-2">Before → after · {l.evidence.section}</figcaption></figure>}
      {l.evidence?.kind === "crop" && <div className="lg:col-span-5" data-evidence="crop"><CropFigure crop={l.evidence.crop} label={`After · ${l.evidence.section}`} priority sizes="(min-width: 1024px) 40vw, 100vw" /></div>}
      {l.evidence?.kind === "card" && <div className="lg:col-span-5" data-evidence="card"><CoverFigure c={l.evidence.cover} /></div>}
      {fig && <div className="lg:col-span-5 lg:self-stretch"><LeadFigureSlot f={fig} /></div>}
    </div>
  </Plate></section>;
}

function Moving({ moving }: { moving: NonNullable<FrontModel["moving"]> }) {
  return <section aria-labelledby="front-moving"><RuleBox>
    <Kicker id="front-moving">Moving now</Kicker>
    {moving.comparison && <p className="ed-caption mt-1">{moving.comparison}</p>}
    {moving.items.length ? <ul className="front-rail mt-3 flex gap-x-8 overflow-x-auto pb-2">{moving.items.map(x => <li key={x.key} className="ed-hair min-w-[15rem] pt-3">
      <Link to="/signals/$key" params={{ key: x.key }} className="ed-h3 no-underline hover:underline">{x.name}</Link>
      <p className="ed-data mt-2 flex flex-wrap items-center gap-2"><Dim d={x.dimension} /><span>{x.from ?? "Not staged"} → </span><StageWord stage={x.to as never} />{x.share != null && <span>{pct(x.share, 1)}</span>}</p>
    </li>)}</ul> : <p className="ed-small mt-2">{moving.line} <Link to="/signals" className="ed-tap">See every headline signal →</Link></p>}
  </RuleBox></section>;
}

function ChartOfDay({ c }: { c: NonNullable<FrontModel["chart"]> }) {
  const f = { title: c.title, note: c.note, source: c.source, receipt: c.receipt };
  return <section aria-labelledby="front-chart"><Card>
    <Kicker id="front-chart">Chart of the day</Kicker>
    <div className="mt-3">
      {c.kind === "scatter" && <ScatterChart {...f} points={c.points} x={{ label: "Share", format: share }} y={{ label: "Momentum (pts/q)", format: signed }} />}
      {c.kind === "line" && <LineChart {...f} series={c.series} y={{ label: "Share", format: share }} />}
      {c.kind === "bar" && <BarChart {...f} bars={c.bars} format={share} valueLabel="Share" />}
      {c.kind === "donut" && <DonutChart {...f} slices={c.slices} unit="stories" />}
    </div>
  </Card></section>;
}

function Strip({ s, format, now }: { s: NonNullable<FrontModel["strip"]>; format: FormatFilter; now: number }) {
  if (s.kind === "pick") return <section aria-labelledby="front-sector"><RuleBox>
    <Kicker id="front-sector">Your sector</Kicker>
    <p className="ed-small mt-2">Pick a sector to see its two strongest signals, its newest story and any opening.</p>
    <ul className="ed-data mt-2 flex flex-wrap gap-x-3">{s.sectors.map(x => <li key={x.id}><Link to="/" search={frontSearch({ sector: x.id, format })} resetScroll={false} className="ed-tap inline-flex min-h-11 items-center">{x.name}</Link></li>)}</ul>
  </RuleBox></section>;
  return <section aria-labelledby="front-sector"><RuleBox>
    <Kicker id="front-sector">Your sector · {s.name}</Kicker>
    {s.note && <p className="ed-caption mt-1">{s.note}</p>}
    {s.signals.length > 0 && <ul className="mt-2">{s.signals.map(x => <li key={x.key} className="ed-hair py-2"><Link to="/signals/$key" params={{ key: x.key }} className="ed-h4 no-underline hover:underline">{x.name}</Link><span className="ed-data mt-1 flex flex-wrap items-center gap-2"><StageWord stage={x.stage} /><span>{x.share == null ? "—" : pct(x.share, 1)}</span>{s.scope === "all" && <span className="ed-muted">all sectors</span>}</span></li>)}</ul>}
    {s.newest && <><p className="ed-kicker mt-4">Newest {s.name} story</p><ul className="ledger mt-1"><LiveItem s={s.newest} now={now} /></ul></>}
    {s.whiteSpace && s.whiteSpace.id !== s.newest?.id && <><p className="ed-kicker mt-4">White space</p><ul className="ledger mt-1"><LiveItem s={s.whiteSpace} now={now} /></ul></>}
    {!s.newest && <p className="ed-small mt-3">No {s.name} story in the last four months.</p>}
    <p className="ed-data mt-3"><Link to="/sectors/$sector" params={{ sector: s.sector }} className="ed-tap">State of {s.name}, the sector report →</Link></p>
  </RuleBox></section>;
}

/** Date and state, pinned to the left and right edges; from 768 px the format filter shares the row between them (lib/shell.ts). */
function DateState({ m }: { m: Pick<FrontModel, "sector" | "format" | "now" | "state"> }) {
  return <div className="flex flex-wrap items-end justify-between gap-x-6 border-b-[3px] border-ed-ink md:flex-nowrap" data-front-dateline="">
    <div className="flex min-h-11 items-center"><FrontDate now={m.now} /></div>
    <div className="order-last w-full md:order-none md:w-auto md:min-w-0 md:flex-1"><FormatRow m={m} /></div>
    <p className="ed-kicker flex min-h-11 items-center" title={STATE_NOTE[m.state]}><span className="sr-only">Page state: </span>{STATE_WORD[m.state]}<span className="ed-caption ml-2 normal-case tracking-normal max-xl:sr-only">{STATE_NOTE[m.state]}</span></p>
  </div>;
}

type Slots = { archive: ReactNode; aside: ReactNode; lower: ReactNode };
const exploreRow = (x: FrontModel["explore"][number]) => ({ key: `${x.kind}:${x.key}`, href: x.kind === "brand" ? `/brands/${encodeURIComponent(x.key)}` : `/patterns/${encodeURIComponent(x.key)}`, title: x.name, line: <>In “{x.via}” · <time dateTime={x.at}>{storyTime(x.at)}</time></>, tags: [x.kind === "brand" ? "Brand" : "Pattern"] });

function FrontArchive({ r }: { r: Pick<FrontRest, "archive" | "sections"> }) {
  if (!r.sections.archive) return null;
  return <section aria-labelledby="front-archive" className="mt-8">
    <h3 id="front-archive" className="ed-kicker">From the archive</h3>
    <Ledger className="mt-2" rows={r.archive.map(a => ({ key: a.id, href: a.href, number: a.number != null ? String(a.number) : "·", title: a.headline, line: a.line, tags: [a.match], time: <time dateTime={a.at}>{a.date}</time> }))} />
  </section>;
}
function FrontAside({ m, r }: { m: FrontTop; r: FrontRest }) {
  const now = useNow(m.now, 30_000);
  return <>
    {r.chart && <ChartOfDay c={r.chart} />}
    {r.sections.launches && <section aria-labelledby="front-launches"><RuleBox>
      <Kicker id="front-launches">New on the scene</Kicker>
      <p className="ed-caption mt-1">Product Hunt launches. They never rank in the live column.</p>
      <ul className="ledger mt-2">{r.launches.map(s => <LiveItem key={s.id} s={s} now={now} />)}</ul>
    </RuleBox></section>}
    {r.strip && <Strip s={r.strip} format={m.format} now={now} />}
    {m.format === "all" && m.sections.explore && <section aria-labelledby="front-explore"><RuleBox>
      <Kicker id="front-explore">Explore</Kicker>
      <p className="ed-caption mt-1">Brand and pattern pages behind this week's stories.</p>
      <Ledger className="mt-2" small rows={m.explore.map(exploreRow)} label="Brand and pattern pages" />
    </RuleBox></section>}
    {r.sections.collections && <section aria-labelledby="front-collections" data-shelf="collections"><RuleBox>
      <Kicker id="front-collections">Collections</Kicker>
      <p className="ed-caption mt-1">Numbered walls of homepage captures from the pattern gallery.</p>
      <Ledger className="mt-2" small rows={r.collections.map(c => ({ key: c.slug, href: c.href, number: c.number, title: c.title }))} label="Collections" />
      <p className="ed-data mt-3"><Receipt href="/collections" className="ed-tap">All collections →</Receipt></p>
    </RuleBox></section>}
  </>;
}
function FrontLower({ r }: { r: Pick<FrontRest, "editions" | "dataStories" | "sections"> }) {
  return <>
    {r.sections.editions && <section aria-labelledby="front-editions"><RuleBox>
      <Kicker id="front-editions">Editions</Kicker>
      <Ledger className="mt-3" small rows={r.editions.map(e => ({ key: e.id, href: e.href, title: e.title, time: e.date }))} />
    </RuleBox></section>}
    {r.sections.dataStories && <section aria-labelledby="front-data" data-shelf="data-stories"><RuleBox>
      <Kicker id="front-data">Data stories</Kicker>
      <Ledger className="mt-3" rows={r.dataStories.map(d => ({ key: d.slug, href: d.href, number: d.number, title: d.question }))} />
      <p className="ed-data mt-3"><Receipt href="/data" className="ed-tap">All data stories →</Receipt></p>
    </RuleBox></section>}
  </>;
}

/** The whole front page from one full model (tests, /front.json consumers). */
export function FrontView({ m }: { m: FrontModel }) {
  return <FrontLayout m={m} slots={{ archive: <FrontArchive r={m} />, aside: <FrontAside m={m} r={m} />, lower: <FrontLower r={m} /> }} />;
}
// P1 · shell first: the lead, ticker and live column render from the critical read; the archive, side column and lower lists stream
// into <Later> slots from the deferred read (same model, built once per lens on the server).
const useRest = (m: FrontTop) => useSuspenseQuery(frontRestQuery(m.sector, m.format)).data;
function RestArchive({ m }: { m: FrontTop }) { return <FrontArchive r={useRest(m)} />; }
function RestAside({ m }: { m: FrontTop }) { return <FrontAside m={m} r={useRest(m)} />; }
function RestLower({ m }: { m: FrontTop }) { return <FrontLower r={useRest(m)} />; }
export function FrontPageView({ m }: { m: FrontTop }) {
  return <FrontLayout m={m} slots={{
    archive: m.sections.archive ? <Later id="front-archive-later" shapes={[{ kind: "block", height: 28 }, { kind: "rows", n: 4, height: ROW.ledger }]}><RestArchive m={m} /></Later> : null,
    aside: <Later id="front-aside-later" shapes={[{ kind: "block", height: 380 }, { kind: "rows", n: 4, height: ROW.compact }]}><RestAside m={m} /></Later>,
    lower: m.sections.editions || m.sections.dataStories ? <Later id="front-lower-later" shapes={[{ kind: "rows", n: 4, height: ROW.compact }]}><RestLower m={m} /></Later> : null,
  }} />;
}

function FrontLayout({ m, slots }: { m: FrontTop; slots: Slots }) {
  const now = useNow(m.now, 30_000), staff = !!useStaffKey();
  const [moving, setMoving] = useState(m.moving);
  const onUpdates = useCallback((u: FrontUpdates) => { if (u.moving) setMoving(u.moving); }, []);
  const empty = m.format === "all" ? voiced("read.frontView.2") : `No ${FORMAT_LABEL[m.format]} stories this week.`;
  return <DigestShell label="Live" section="live" lens tour edition={null} note={m.sector !== "all" ? `${sectorName(m.sector)} stories first in each group` : null}>
    <FrontTicker items={m.ticker} />
    <FiltersScope>
    <div className="ed-wrap d-stack front-stack mt-4">
      <h1 className="sr-only">{BRAND_NAME}: the live front page</h1>
      <DateState m={m} />
      {m.lead ? <Lead m={m} now={now} /> : m.format === "all" && <p className="ed-standfirst">{voiced("read.frontView.3")}</p>}
      {moving && <Moving moving={moving} />}
      <div className="grid grid-cols-1 gap-y-10 lg:grid-cols-12 lg:gap-x-10">
        <section aria-labelledby="front-live" className="lg:col-span-8" data-tour="r-live">
          <h2 id="front-live" className="ed-h2">{m.format === "explore" ? "Explore" : "Live"}</h2>
          {m.state === "quiet" && m.format !== "explore" && <p className="ed-caption mt-1" role="note">Quiet: no new story in the last 24 hours. Below is the rest of this week{m.sections.archive ? ", then the same week from the archive" : ""}, each with the date it happened.</p>}
          {m.format === "explore"
            ? <Ledger className="mt-4" rows={m.explore.map(exploreRow)} label="Brand and pattern pages" />
            : <LiveColumn initial={m.column.items} serverNow={m.now} sector={m.sector} format={m.format} quiet={m.column.quiet} onUpdates={onUpdates} empty={empty} />}
          {m.format === "explore" && !m.sections.explore && <p className="ed-small mt-3">{voiced("read.frontView.4")}</p>}
          {slots.archive}
          <p className="ed-data mt-6"><Link to="/morning" className="ed-tap">Older stories, day by day, in the Morning Line →</Link></p>
        </section>
        <aside className="space-y-10 lg:col-span-4" aria-label="Chart of the day, new on the scene and your sector">
          {slots.aside}
        </aside>
      </div>
      {slots.lower}
      <nav aria-label="About the front page" className="ed-navtext flex flex-wrap gap-x-6">{m.footer.filter(f => staff || !STAFF_HREFS.has(f.href)).map(f => <Receipt key={f.href} href={f.href} className="ed-tap inline-flex min-h-11 items-center">{f.label}</Receipt>)}</nav>
    </div>
    </FiltersScope>
    <ReadFooter terminal="/terminal" />
  </DigestShell>;
}
