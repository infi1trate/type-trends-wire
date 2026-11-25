import { line as voiced } from "@/lib/voice";
// `/` — Today, the front page. Renders the pure front model (src/lib/front/front.ts) and nothing else; the live column and Moving now
// refresh from /front.json without a reload. Composition A (brand/README.md, "Layout moves"), Steady density: a date and state line
// pinned left and right; ONE pink Plate for the lead; Moving now as a rule box; the live column as a Ledger; chart of the day in a Card;
// the sector strip, editions and data stories as rule boxes. Nothing else is filled with colour.
import { Component, Suspense, use, useCallback, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BRAND_NAME } from "@/lib/brand";
import type { FrontModel, FrontRest, FrontStory, FrontTop, FrontUpdates } from "@/lib/front/front";
import type { Crop } from "@/lib/crops";
import { FRONT_TAPE_SUB, FRONT_TAPE_TITLE, UNCONFIRMED_HREF, WHOLE_TAPE_HREF, confirmedText, unconfirmedText, type FrontTape, type TapePair } from "@/lib/front/tape-block";
import { BrandMark } from "./BrandMark";
import { useQueryClient, useSuspenseQuery, type QueryClient } from "@tanstack/react-query";
import { frontAlsoQuery, frontRestQuery, frontTapeQuery, frontTopQuery, frontWireQuery } from "@/lib/data";
import { WIRE_DATA_HREF, WIRE_SUB, WIRE_TITLE, type WireBlockRow } from "@/lib/newsroom/news";
import { shortDay } from "@/lib/labels";
import { FailGroup, Later, ROW } from "./Later";
import { FORMAT_LABEL, FORMAT_NOTE, FORMATS, frontSearch, type FormatFilter } from "@/lib/front/formats";
import { numberLabel } from "@/lib/stories/numbers";
import { storyTime } from "@/lib/stories";
import { sectorName } from "@/lib/labels";
import { pct } from "@/lib/digest/copy";
import { DigestShell, Dim, StageWord } from "@/components/digest/Editorial";
import { Bars, DonutChart, QuarterLine, ScatterChart } from "@/components/chartkit";
import { Card, Plate, Raised, RuleBox } from "@/components/brand/Containers";
import { Ledger, ledgerDigits } from "@/components/brand/Ledger";
import { BeforeAfter, CoverFigure, CropFigure } from "./Evidence";
import { Receipt } from "./StoryCard";
import { ReadFooter } from "./Bits";
import { STAFF_HREFS, useStaffKey } from "@/lib/staff-key";
import { LeadFigureSlot } from "./Covers";
import { LeadPicture, planDraws } from "./LeadPicture";
import { LEAD_SIZES } from "@/lib/first-paint";
import { FiltersScope } from "@/components/brand/Illustration";
import { FrontDate, FrontTicker, LiveColumn, LiveItem, useNow } from "./FrontLive";
import { leadFigure, relTime } from "@/lib/front/front";

const FILTERS: FormatFilter[] = ["all", ...FORMATS];
/** The ruled list's heading; its time group of the same name adds no second heading (E3b). */
export const EARLIER_TITLE = "Earlier this week";
const share = (v: number) => pct(v, 1) ?? "—";
const signed = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}`;
const Kicker = ({ id, children }: { id: string; children: ReactNode }) => <h2 id={id} className="ed-kicker">{children}</h2>;

function FormatRow({ m }: { m: Pick<FrontModel, "sector" | "format"> }) {
  return <nav aria-label="Formats" className="no-print min-w-0 md:flex-1">
    <ul className="ed-navtext front-formats flex gap-x-5 overflow-x-auto">{FILTERS.map(f => <li key={f} className="shrink-0">
      <Link to="/" search={frontSearch({ sector: m.sector, format: f })} aria-current={m.format === f ? "true" : undefined} resetScroll={false}
        className={`-mb-[3px] inline-flex min-h-11 items-center border-b-[3px] no-underline ${m.format === f ? "border-ed-ink" : "border-transparent"}`}>{FORMAT_LABEL[f]}</Link>
    </li>)}</ul>
    <p className={`ed-caption ${m.format === "all" && m.sector === "all" ? "sr-only" : "mt-1"}`} aria-live="polite">Showing {m.format === "all" ? "every format" : `${FORMAT_LABEL[m.format]}: ${FORMAT_NOTE[m.format]}`}{m.sector !== "all" ? ` · ${sectorName(m.sector)} first` : ""}</p>
  </nav>;
}

/** The lead: the page's one Plate. Kicker with the story number, H1, deck, a Raised "Receipts" button, the basis mark and the evidence slot.
 *  I3b: with a lead picture (pair, single, mosaic, words, swatches or card) the right column holds only the picture, with compact captions,
 *  and from 1024 px the stat and trail sit small in the text column under the Receipts row; below 1024 px the order is kicker, headline,
 *  deck, picture, Receipts row, stat and trail. Without one, the lead is laid out exactly as before I3. */
function Lead({ m, now }: { m: FrontTop; now: number }) {
  const l = m.lead!, fig = leadFigure(l.evidence);
  const kicker = <p className="ed-kicker flex flex-wrap items-center gap-x-3 gap-y-1">{l.story.number != null && <span className="plate-num">{numberLabel(l.story.number)}</span>}<span>{l.label}</span><span>{l.story.typeName}{l.story.sectorName ? ` · ${l.story.sectorName}` : ""}</span></p>;
  const headline = <h2 id="front-lead" className="ed-h1 mt-4 break-words"><Link to="/stories/$id" params={{ id: l.story.id }} className="no-underline hover:underline">{l.story.headline}</Link></h2>;
  const deck = l.story.line && <p className="ed-standfirst mt-5">{l.story.line}</p>;
  const receipts = (cls: string) => <div className={`flex flex-wrap items-center gap-x-5 gap-y-3 ${cls}`}>
    <Raised href={`/stories/${encodeURIComponent(l.story.id)}`}>Receipts →</Raised>
    <span className="ed-data"><time dateTime={l.story.at}>{storyTime(l.story.at)}</time> · {relTime(l.story.at, now)}{l.story.corrected && <> · Corrected {l.story.corrected.slice(0, 10)}</>}</span>
  </div>;
  // S1 · a plan with nothing to draw (a chart or "none" plan) gives the right column to the signal's chart at full size instead.
  if (l.evidence?.kind === "plan" && !planDraws(l.evidence.plan) && fig) return <section aria-labelledby="front-lead"><Plate className="md:p-10">
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12" data-lead-layout="chart">
      <div className="min-w-0 lg:col-span-7">{kicker}{headline}{deck}{receipts("mt-8")}</div>
      <div className="min-w-0 lg:col-span-5 lg:self-center"><LeadFigureSlot f={fig} /></div>
    </div>
  </Plate></section>;
  if (l.evidence?.kind === "plan") return <section aria-labelledby="front-lead"><Plate className="md:p-10">
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:grid-rows-[auto_auto_1fr] lg:gap-y-6" data-lead-layout="picture">
      <div className="min-w-0 lg:col-span-7 lg:row-start-1">{kicker}{headline}{deck}</div>
      <div className="min-w-0 lg:col-span-5 lg:col-start-8 lg:row-span-3 lg:row-start-1 lg:self-center" data-evidence="plan"><LeadPicture plan={l.evidence.plan} compact stack tileSizes={LEAD_SIZES.frontMosaic} /></div>
      {receipts("lg:col-span-7 lg:row-start-2")}
      {/* A2b · the figure keeps the phone's figure role at every width and stays inside its own column (its trail's end labels too). */}
      {fig && <div className="min-w-0 overflow-hidden lg:col-span-7 lg:row-start-3 lg:self-start" data-lead-figure=""><LeadFigureSlot f={fig} /></div>}
    </div>
  </Plate></section>;
  return <section aria-labelledby="front-lead"><Plate className="md:p-10">
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      <div className={l.evidence ? "lg:col-span-7" : "lg:col-span-10"}>
        {kicker}{headline}{deck}
        {receipts("mt-8")}
      </div>
      {l.evidence?.kind === "crops" && <figure className="lg:col-span-5" data-evidence=""><BeforeAfter before={l.evidence.before} after={l.evidence.after} /><figcaption className="ed-caption mt-2">Before → after · {l.evidence.section}</figcaption></figure>}
      {l.evidence?.kind === "crop" && <div className="lg:col-span-5" data-evidence="crop"><CropFigure crop={l.evidence.crop} label={`After · ${l.evidence.section}`} priority sizes={LEAD_SIZES.frontCrop} /></div>}
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
      {c.kind === "line" && <QuarterLine look="read" {...f} series={c.series} y={{ label: "Share", format: share }} />}
      {c.kind === "bar" && <Bars look="read" {...f} bars={c.bars} format={share} valueLabel="Share" />}
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
    {s.newest && <><p className="ed-kicker mt-4">Newest {s.name} story</p><ul className="ledger mt-1"><LiveItem s={s.newest} now={now} digits={ledgerDigits([s.newest.number])} /></ul></>}
    {s.whiteSpace && s.whiteSpace.id !== s.newest?.id && <><p className="ed-kicker mt-4">White space</p><ul className="ledger mt-1"><LiveItem digits={ledgerDigits([s.whiteSpace.number])} s={s.whiteSpace} now={now} /></ul></>}
    {!s.newest && <p className="ed-small mt-3">No {s.name} story in the last four months.</p>}
    <p className="ed-data mt-3"><Link to="/sectors/$sector" params={{ sector: s.sector }} className="ed-tap">State of {s.name}, the sector report →</Link></p>
  </RuleBox></section>;
}

/** The date pinned left; from 768 px the format filter shares the row beside it (lib/shell.ts). E3: no page-state label (machinery). */
function DateState({ m }: { m: Pick<FrontModel, "sector" | "format" | "now"> }) {
  return <div className="flex flex-wrap items-end justify-between gap-x-6 border-b-[3px] border-ed-ink md:flex-nowrap" data-front-dateline="">
    <div className="flex min-h-11 items-center"><FrontDate now={m.now} /></div>
    <div className="order-last w-full md:order-none md:w-auto md:min-w-0 md:flex-1"><FormatRow m={m} /></div>
  </div>;
}

// ALSO TODAY (E3): the day's other stories as a row of Cards (two by two at 768, one column below). A card has a picture only when the
// story has a first-screen crop; a census shows its count large above the headline.
function AlsoCard({ s, crop }: { s: FrontStory; crop: Crop | null }) {
  return <li className="min-w-0"><Card as="article" className="flex h-full flex-col gap-3 p-4" aria-labelledby={`also-${s.id}`} data-also-card="">
    <p className="ed-kicker flex flex-wrap items-center gap-x-3 gap-y-1">{s.number != null && <span>{numberLabel(s.number)}</span>}<span>{s.typeName}{s.sectorName ? ` · ${s.sectorName}` : ""}</span></p>
    {s.count && <p className="ed-stat whitespace-nowrap" data-census-count="">{s.count}</p>}
    <h3 id={`also-${s.id}`} className="ed-h3 break-words"><Link to="/stories/$id" params={{ id: s.id }} className="no-underline hover:underline">{s.headline}</Link></h3>
    {s.line && <p className="ed-small">{s.line}</p>}
    {crop && <div className="mt-auto pt-2" data-also-picture=""><CropFigure crop={crop} sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw" /></div>}
  </Card></li>;
}
export function AlsoCards({ items, pictures }: { items: FrontStory[]; pictures: Record<string, Crop | null> }) {
  if (!items.length) return null;
  return <section aria-labelledby="front-also" data-front-also="">
    <Kicker id="front-also">Also today</Kicker>
    <ul className="mt-3 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">{items.map(s => <AlsoCard key={s.id} s={s} crop={pictures[s.id] ?? null} />)}</ul>
  </section>;
}
function AlsoLater({ m }: { m: FrontTop }) { const { data } = useSuspenseQuery(frontAlsoQuery(m.sector, m.format)); return <AlsoCards items={m.also} pictures={data} />; }

/** W1b · the old and new icon or card on a line in the latest changes: two small fixed boxes (no layout shift), lazy, the brand's own pictures. */
function TapePairPics({ p }: { p: TapePair }) {
  const box = p.kind === "icon" ? { w: 24, h: 24 } : { w: 42, h: 24 };
  const img = (x: TapePair["before"], label: string) => <img src={x.src} alt={`${label}: ${p.alt}`} width={box.w} height={box.h} loading="lazy" decoding="async" className="tape-pair-img" style={{ width: box.w, height: box.h }} />;
  return <span className="tape-pair" data-tape-pair="">{img(p.before, "Before")}<span aria-hidden="true">·</span>{img(p.after, "After")}</span>;
}
// LATEST CHANGES (E3): the eight newest confirmed changes as a ruled list, one line each, linking to the brand page; then the count line.
export function TapeBlock({ t }: { t: FrontTape }) {
  return <section aria-labelledby="front-tape" data-front-tape="">
    <h2 id="front-tape" className="ed-h2">{FRONT_TAPE_TITLE}</h2>
    <p className="ed-caption mt-1">{FRONT_TAPE_SUB}</p>
    {t.lines.length > 0
      ? <Ledger className="mt-3" small inlineTags label={FRONT_TAPE_TITLE} rows={t.lines.map(l => ({ key: String(l.id), href: l.href, lead: <BrandMark icon={l.icon} name={l.name} size={32} />, title: <>{l.sentence ?? <>{l.name} · {l.what}</>}{l.pair && <TapePairPics p={l.pair} />}</>, tags: l.marks, time: l.when }))} />
      : <p className="ed-small mt-3">No confirmed change in the last {t.days} days.</p>}
    <p className="ed-data mt-3" data-tape-counts="">{confirmedText(t.confirmed, t.days)}; <a href={UNCONFIRMED_HREF} className="ed-tap">{unconfirmedText(t.unconfirmed)}</a> (seen once or alternating).</p>
    <p className="ed-data mt-2"><a href={WHOLE_TAPE_HREF} className="ed-tap">All changes →</a></p>
  </section>;
}
function TapeLater() { const { data } = useSuspenseQuery(frontTapeQuery()); return <TapeBlock t={data} />; }
// N3 · THE WIRE: up to five links the news desk picked from the publications on the wire in the last 24 hours, built from the latest changes' own
// rows and type steps: the outlet, the line (the outlet's page, in a new tab), the date, and the tracked brand it names. No block when empty.
export function WireBlock({ rows }: { rows: WireBlockRow[] }) {
  if (!rows.length) return null;
  // Height budget (N3): at most 280 px added at 1440 and 380 px at 390, so the heading is a kicker line carrying the closing link, and
  // phones show the three newest rows (the rest are one tap away on the wire).
  return <section aria-labelledby="front-wire" data-front-wire="" className="front-wire">
    <div className="flex flex-wrap items-baseline justify-between gap-x-4">
      <h2 id="front-wire" className="ed-kicker">{WIRE_TITLE}<span className="sr-only">: {WIRE_SUB}</span></h2>
      <a href={WIRE_DATA_HREF} className="ed-tap ed-data">The whole wire →</a>
    </div>
    <Ledger className="ledger-wire mt-2" small label={WIRE_TITLE} rows={rows.map(r => ({ key: String(r.id), href: r.url, external: true, title: r.line, tags: [r.outlet], time: shortDay(r.date),
      ...(r.brand ? { after: <Link to="/brands/$domain" params={{ domain: r.brand.domain }} className="ledger-brand ed-data">{r.brand.name}</Link> } : {}) }))} />
  </section>;
}
function WireRows() { const { data } = useSuspenseQuery(frontWireQuery()); return <WireBlock rows={data.rows} />; }
/** THE WIRE never holds up or takes down LATEST CHANGES: it waits silently and, if its read fails, the block is simply not shown. */
class WireQuiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() { return this.state.failed ? null : this.props.children; }
}
function WireLater() { return <WireQuiet><Suspense fallback={null}><WireRows /></Suspense></WireQuiet>; }

type Slots = { archive: ReactNode; aside: ReactNode; asideRest: ReactNode; lower: ReactNode; also: ReactNode; tape: ReactNode };
const exploreRow = (x: FrontModel["explore"][number]) => ({ key: `${x.kind}:${x.key}`, href: x.kind === "brand" ? `/brands/${encodeURIComponent(x.key)}` : `/patterns/${encodeURIComponent(x.key)}`, lead: x.kind === "brand" ? <BrandMark icon={null} name={x.name} size={32} /> : undefined, title: x.name, line: <>In “{x.via}” · <time dateTime={x.at}>{storyTime(x.at)}</time></>, tags: [x.kind === "brand" ? "Brand" : "Pattern"] });

function FrontArchive({ r }: { r: Pick<FrontRest, "archive" | "sections"> }) {
  if (!r.sections.archive) return null;
  return <section aria-labelledby="front-archive" className="mt-8">
    <h3 id="front-archive" className="ed-kicker">From the archive</h3>
    <Ledger className="mt-2" rows={r.archive.map(a => ({ key: a.id, href: a.href, number: a.number != null ? String(a.number) : "·", title: a.headline, line: a.line, tags: [a.match], time: <time dateTime={a.at}>{a.date}</time> }))} />
  </section>;
}
/** D1b · the left column's top-up: the newest stories from before this week (how many is chosen on the server so both columns end
 *  together, front/top-up.ts), as one more day group. Only where there are two columns (1024 px and wider); a CSS rule, so no shift. */
function BeforeThisWeek({ items, now }: { items: FrontStory[]; now: number }) {
  return <section aria-labelledby="fg-before" className="mt-6 hidden lg:block" data-front-more="">
    <h3 id="fg-before" className="ed-kicker">Before this week <span className="ed-muted">· {items.length}</span></h3>
    <ul className="ledger mt-2" data-ledger="">{items.map(s => <LiveItem key={s.id} s={s} now={now} digits={ledgerDigits(items.map(x => x.number))} />)}</ul>
  </section>;
}
// S1 · the rail in two parts: Chart of the day on top, then the rest (launches, your sector, explore, collections). Below 1024 px the
// page is one column and Moving now, Studies and Editions sit between the two parts.
function FrontAside({ r }: { r: FrontRest }) {
  return r.chart ? <ChartOfDay c={r.chart} /> : null;
}
function FrontAsideRest({ m, r }: { m: FrontTop; r: FrontRest }) {
  const now = useNow(m.now, 30_000);
  return <>
    {r.sections.launches && <section aria-labelledby="front-launches"><RuleBox>
      <Kicker id="front-launches">New on the scene</Kicker>
      <p className="ed-caption mt-1">Product Hunt launches. They never rank in the live column.</p>
      <Ledger className="mt-2" small label="Product Hunt launches" rows={r.launches.map(l => ({ key: l.id, href: l.href, title: l.title, line: [l.votesLine, l.dayLine].filter(Boolean).join(" · ") }))} />
    </RuleBox></section>}
    {r.strip && <Strip s={r.strip} format={m.format} now={now} />}
    {m.format === "all" && m.sections.exploreAside && <section aria-labelledby="front-explore"><RuleBox>
      <Kicker id="front-explore">Explore</Kicker>
      <p className="ed-caption mt-1">Brand and pattern pages behind this week's stories, one for each story.</p>
      <Ledger className="mt-2" small rows={m.exploreAside.map(exploreRow)} label="Brand and pattern pages" />
    </RuleBox></section>}
    {r.sections.collections && <section aria-labelledby="front-collections" data-shelf="collections"><RuleBox>
      <Kicker id="front-collections">Collections</Kicker>
      <p className="ed-caption mt-1">Numbered walls of homepage captures from the pattern gallery.</p>
      <Ledger className="mt-2" small rows={r.collections.map(c => ({ key: c.slug, href: c.href, number: c.number, title: c.title }))} label="Collections" />
      <p className="ed-data mt-3"><Receipt href="/collections" className="ed-tap">All collections →</Receipt></p>
    </RuleBox></section>}
  </>;
}
// S1 · Studies and Editions sit in the left column under the Morning Line link, as two ledgers under kicker headings (no boxes).
function FrontLower({ r }: { r: Pick<FrontRest, "editions" | "dataStories" | "sections"> }) {
  return <div className="space-y-10">
    {r.sections.dataStories && <section aria-labelledby="front-data" data-shelf="data-stories">
      <Kicker id="front-data">Studies</Kicker>
      <Ledger className="mt-3" rows={r.dataStories.map(d => ({ key: d.slug, href: d.href, number: `No. ${d.number}`, title: d.headline ?? d.question }))} />
      <p className="ed-data mt-3"><Receipt href="/data" className="ed-tap">All studies →</Receipt></p>
    </section>}
    {r.sections.editions && <section aria-labelledby="front-editions">
      <Kicker id="front-editions">Editions</Kicker>
      <Ledger className="mt-3" small rows={r.editions.map(e => ({ key: e.id, href: e.href, title: e.title, time: e.date }))} />
    </section>}
  </div>;
}

/** The whole front page from one full model (tests, /front.json consumers). */
export function FrontView({ m }: { m: FrontModel }) {
  return <FrontLayout m={m} slots={{ archive: <FrontArchive r={m} />, aside: <FrontAside r={m} />, asideRest: <FrontAsideRest m={m} r={m} />, lower: <FrontLower r={m} />, also: <AlsoCards items={m.also} pictures={{}} />, tape: null }} />;
}
// P1 · shell first: the lead, ticker and live column render from the critical read; the archive, side column and lower lists stream
// into <Later> slots from the deferred read (same model, built once per lens on the server).
const useRest = (m: FrontTop) => useSuspenseQuery(frontRestQuery(m.sector, m.format)).data;
function RestArchive({ m }: { m: FrontTop }) { return <FrontArchive r={useRest(m)} />; }
function RestAside({ m }: { m: FrontTop }) { return <FrontAside r={useRest(m)} />; }
function RestAsideRest({ m }: { m: FrontTop }) { return <FrontAsideRest m={m} r={useRest(m)} />; }
function RestLower({ m }: { m: FrontTop }) { return <FrontLower r={useRest(m)} />; }
/** The deferred slots of one top model: archive, side column, lower lists, Also today's pictures and the latest changes. */
function laterSlots(m: FrontTop): Slots {
  return {
    archive: m.sections.archive ? <Later id="front-archive-later" shapes={[{ kind: "block", height: 28 }, { kind: "rows", n: 4, height: ROW.ledger }]}><RestArchive m={m} /></Later> : null,
    aside: <Later id="front-aside-later" shapes={[{ kind: "block", height: 380 }]}><RestAside m={m} /></Later>,
    asideRest: <Later id="front-aside-rest-later" shapes={[{ kind: "block", height: 28 }, { kind: "rows", n: 4, height: ROW.compact }]}><RestAsideRest m={m} /></Later>,
    lower: m.sections.editions || m.sections.dataStories ? <Later id="front-lower-later" shapes={[{ kind: "rows", n: 4, height: ROW.compact }]}><RestLower m={m} /></Later> : null,
    also: m.sections.also ? <Later id="front-also-later" shapes={[{ kind: "block", height: 28 }, { kind: "block", height: 420 }]}><AlsoLater m={m} /></Later> : null,
    tape: <Later id="front-tape-later" className="d-stack" shapes={[{ kind: "block", height: 64 }, { kind: "rows", n: 8, height: ROW.compact }, { kind: "text", lines: 2 }]}><TapeLater /><WireLater /></Later>,
  };
}
/** E3b · shell first: the page frame (bar, status line, footer) goes out before any read; the ticker, lead and live column stream into
 *  one sized slot from the top read, and each lower module into its own. */
export function FrontPageView({ sector, format }: { sector: string; format: string }) {
  return <FrontFrame sector={sector}>
    <Later id="front-top-later" reserve="100dvh" shapes={[{ kind: "block", height: 36 }, { kind: "block", height: 48 }, { kind: "block", height: 560 }, { kind: "block", height: 420 }, { kind: "rows", n: 6, height: ROW.ledger }]}><TopLater sector={sector} format={format} /></Later>
  </FrontFrame>;
}
/** P2c · the top slot lands together with the lower modules: their reads started with the top's (route loader), so it waits for them
 *  too, up to this long. On a cold instance they used to land up to seconds after the lead, each swapping a placeholder whose height
 *  differs from its content (Also today: 464 px held, 1,003 px real at 390 px), which moved whatever stood below it. A read slower
 *  than this still streams into its own sized slot, as before. */
export const FRONT_TOGETHER_MS = 5_000;
const together = new WeakMap<QueryClient, Map<string, Promise<void>>>();
function useLowerTogether(sector: string, format: string) {
  const qc = useQueryClient();
  const reads: { key: readonly unknown[]; load: () => Promise<unknown> }[] = [
    { key: frontRestQuery(sector, format).queryKey, load: () => qc.ensureQueryData(frontRestQuery(sector, format)) },
    { key: frontAlsoQuery(sector, format).queryKey, load: () => qc.ensureQueryData(frontAlsoQuery(sector, format)) },
    { key: frontTapeQuery().queryKey, load: () => qc.ensureQueryData(frontTapeQuery()) },
    { key: frontWireQuery().queryKey, load: () => qc.ensureQueryData(frontWireQuery()) },
  ];
  const waiting = reads.filter(r => { const st = qc.getQueryState(r.key); return !st || st.status === "pending"; });
  if (!waiting.length) return;
  let byKey = together.get(qc);
  if (!byKey) together.set(qc, byKey = new Map());
  const key = waiting.map(r => JSON.stringify(r.key)).join("|");
  let p = byKey.get(key);
  if (!p) {
    p = Promise.race([Promise.allSettled(waiting.map(r => r.load())).then(() => undefined), new Promise<void>(r => setTimeout(r, FRONT_TOGETHER_MS))]);
    byKey.set(key, p);
  }
  use(p);
}
function TopLater({ sector, format }: { sector: string; format: string }) {
  const { data: m } = useSuspenseQuery(frontTopQuery(sector, format));
  useLowerTogether(sector, format);
  return <FrontBody m={m} slots={laterSlots(m)} />;
}

function FrontFrame({ sector, children }: { sector: string; children: ReactNode }) {
  return <DigestShell label="Today" section="live" lens tour edition={null} note={sector !== "all" ? `${sectorName(sector)} stories first in each group` : null}>
    {children}
    <ReadFooter terminal="/terminal" />
  </DigestShell>;
}
function FrontLayout({ m, slots }: { m: FrontTop; slots: Slots }) {
  return <FrontFrame sector={m.sector}><FrontBody m={m} slots={slots} /></FrontFrame>;
}
function FrontBody({ m, slots }: { m: FrontTop; slots: Slots }) {
  const now = useNow(m.now, 30_000), staff = !!useStaffKey();
  const [moving, setMoving] = useState(m.moving);
  const onUpdates = useCallback((u: FrontUpdates) => { setMoving(u.moving); }, []);
  const empty = m.format === "all" ? voiced("read.frontView.2") : `No ${FORMAT_LABEL[m.format]} stories this week.`;
  return <>
    <FrontTicker items={m.ticker} />
    <FiltersScope>
    <div className="ed-wrap d-stack front-stack mt-4">
      <h1 className="sr-only">{BRAND_NAME}: Today, the front page</h1>
      <DateState m={m} />
      {m.lead ? <Lead m={m} now={now} /> : m.format === "all" && <p className="ed-standfirst">{voiced("read.frontView.3")}</p>}
      {slots.also}
      {(m.format === "all" || m.format === "live") && slots.tape}
      {/* S1 · two columns from 1024 px (left: this week, the archive, the Morning Line link, Studies, Editions; rail: Chart of the day, then
          your sector, explore, collections) with Moving now full width after both. Below 1024 px the columns dissolve (display: contents)
          and `order` sets one column: this week, Chart of the day, Moving now, Studies, Editions, then the rest of the rail. */}
      <div className="flex flex-col gap-y-10 lg:grid lg:grid-cols-12 lg:gap-x-10" data-front-cols="">
        <div className="contents lg:col-span-8 lg:block lg:space-y-10" data-front-left="">
        <FailGroup>
        <section aria-labelledby="front-live" className="order-1" data-tour="r-live">
          {m.format === "explore"
            ? <><h2 id="front-live" className="ed-h2">Explore</h2><Ledger className="mt-4" rows={m.explore.map(exploreRow)} label="Brand and pattern pages" /></>
            : <LiveColumn initial={m.column.items} serverNow={m.now} sector={m.sector} format={m.format} quiet={m.column.quiet} onUpdates={onUpdates} empty={empty}
                heading={{ id: "front-live", title: EARLIER_TITLE, note: m.state === "quiet" ? <p className="ed-caption mt-1" role="note">Nothing new today. The brands are behaving. Here is the rest of the week{m.sections.archive ? ", and what was happening this same week in years past" : ""}.</p> : null }} />}
          {m.format === "explore" && !m.sections.explore && <p className="ed-small mt-3">{voiced("read.frontView.4")}</p>}
          {slots.archive}
          {m.format === "all" && m.more.length > 0 && <BeforeThisWeek items={m.more} now={now} />}
          <p className="ed-data mt-6"><Link to="/morning" className="ed-tap">Older stories, day by day, in the Morning Line →</Link></p>
        </section>
        {slots.lower && <div className="order-4">{slots.lower}</div>}
        </FailGroup>
        </div>
        <aside className="contents lg:col-span-4 lg:block lg:space-y-10" aria-label="Chart of the day, your sector, explore and collections" data-front-rail="">
          <FailGroup>
          {slots.aside && <div className="order-2">{slots.aside}</div>}
          <div className="order-5 space-y-10">{slots.asideRest}</div>
          </FailGroup>
        </aside>
        {moving && <div className="order-3 lg:col-span-12"><Moving moving={moving} /></div>}
      </div>
      <nav aria-label="About the front page" className="ed-navtext flex flex-wrap gap-x-6">{m.footer.filter(f => staff || !STAFF_HREFS.has(f.href)).map(f => <Receipt key={f.href} href={f.href} className="ed-tap inline-flex min-h-11 items-center">{f.label}</Receipt>)}</nav>
    </div>
    </FiltersScope>
  </>;
}
