import { studyBand } from "@/lib/pop/rules";
// /data, the Studies home (E4; S1 shelf): a heading, the lead study, one "All studies" shelf of cards with the series key, "In the works" and the
// brand tool, and nothing else. Template names, draft tags and draft reasons stay off this page (the study page's basis carries them).
import { Link } from "@tanstack/react-router";
import type { StudiesHome, HomeStudy } from "@/lib/data-stories/shelf";
import { dayText, pctText } from "@/lib/data-stories/text";
import { DigestShell } from "@/components/digest/Editorial";
import { ReadFooter } from "@/components/read/Bits";
import { StoryNo } from "@/components/brand/Ledger";
import { FiltersScope, Trail } from "@/components/brand/Illustration";
import { FigureNumber } from "@/components/brand/FigureNumber";
import { line as voiced } from "@/lib/voice";

export const STUDIES_TITLE = "Longer answers, built from five years of captures";
export const STUDIES_STANDFIRST = "A study is one argument with its evidence, built from stored homepage captures, and each one belongs to a series that asks the same kind of question.";
const GAP = "mt-[var(--sys-gap-section)]";

function Lead({ s }: { s: HomeStudy }) {
  return <section aria-labelledby="studies-lead" className={`ed-wrap ${GAP} grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10`} data-studies-lead="">
    {s.cover && <div className="min-w-0 lg:order-2 lg:col-span-6" data-studies-cover=""><FiltersScope><Trail points={s.cover.points} label={s.cover.label} format={s.cover.unit === "share" ? pctText : String} w={640} h={360} seed={s.number} /></FiltersScope></div>}
    <div className={`min-w-0 ${s.cover ? "lg:col-span-6" : "lg:col-span-8"}`}>
      <p className="ed-kicker">{`${s.seriesTitle} · ${s.label}`}</p>
      <h2 id="studies-lead" className="ed-h1 mt-3 max-w-[22ch] break-words"><Link to="/data/$slug" params={{ slug: s.slug }} className="no-underline hover:underline">{s.headline}</Link></h2>
      <p className="ed-standfirst mt-4 max-w-[60ch]">{s.deck}</p>
      <p className="mt-6"><span className="ed-stat block" data-key-figure=""><FigureNumber text={String(s.key.n)} /></span><span className="ed-small mt-1 block max-w-[40ch]">{s.key.label}</span></p>
      <p className="ed-data mt-6"><Link to="/data/$slug" params={{ slug: s.slug }} className="ed-tap inline-flex min-h-[44px] items-center">Read the study →</Link></p>
    </div>
  </section>;
}
/** S1 · one study on the "All studies" shelf: series kicker, "No. 2" and the title on one baseline, the question on one line, the study's
 *  own share picture (fixed 16:9 box, lazy) and its data date. */
function StudyCard({ x }: { x: HomeStudy & { seriesTitle: string } }) {
  return <li className="min-w-0" data-study-card={x.slug}>
    <Link to="/data/$slug" params={{ slug: x.slug }} className="study-card">
      <span className="study-band block" data-band={studyBand(x.number)}><span className="ed-kicker block">{x.seriesTitle}</span>
      <span className="study-card-title mt-2"><span className="study-band-no">{x.number}</span><span className="ed-row-headline">{x.headline}</span></span></span>
      <span className="ed-small study-card-q mt-2 block">{x.question}</span>
      <span className="study-card-pic mt-3"><img src={`/data/${x.slug}.png`} alt="" width={1200} height={630} loading="lazy" decoding="async" /></span>
      {x.dataThrough && <span className="ed-data mt-2 block">{`Data through ${dayText(x.dataThrough)}`}</span>}
    </Link>
  </li>;
}
/** The shelf's studies, newest first; the lead is left out unless that would leave fewer than three cards. */
export function shelfStudies(home: Pick<StudiesHome, "lead" | "series">): HomeStudy[] {
  const all = home.series.flatMap(s => s.studies).sort((a, b) => b.number - a.number);
  const rest = home.lead ? all.filter(x => x.slug !== home.lead!.slug) : all;
  return rest.length >= 3 ? rest : all;
}
/** P2 · the Studies home in two parts: the heading (fixed copy, drawn with the shell) and the body (the lead, series, shelf and tool,
 *  which read stored study rows and stream in behind the shell). `DataIndexView` draws both at once, as before. */
// P2 · the heading's measures are the web fonts' 24ch and 60ch written in em (Big Shoulders' "0" is 0.526em, Newsreader's 0.5545em):
// a ch measure follows whichever font is drawn first, so under the fallback the box was narrower and the heading took a line more.
export function DataIndexHead() {
  return <header className="ed-wrap pt-8 md:pt-12" data-studies-head="">
      <p className="ed-kicker">Studies</p>
      <h1 className="ed-h1 hold-studies-title mt-3 max-w-[12.62em]">{STUDIES_TITLE}</h1>
      <p className="ed-standfirst hold-studies-deck mt-4 max-w-[33.27em]">{STUDIES_STANDFIRST}</p>
    </header>;
}
export function DataIndexBody({ home }: { home: StudiesHome }) {
  return <>
    {home.lead && <Lead s={home.lead} />}
    <section aria-labelledby="studies-series" className={`ed-wrap ${GAP}`} data-studies-series="">
      <h2 id="studies-series" className="ed-h2">All studies</h2>
      <ul className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3" aria-label="All studies">{shelfStudies(home).map(x => <StudyCard key={x.slug} x={x} />)}</ul>
      <dl className="mt-8 grid grid-cols-1 gap-x-8 gap-y-4 border-t border-ed-ink pt-4 md:grid-cols-3" aria-label="The series">{home.series.map(s => <div key={s.id} className="min-w-0" data-series={s.id}>
        <dt id={`series-${s.id}`} className="ed-kicker">{s.title}</dt>
        <dd className="ed-small mt-1">{s.description}{s.studies.length ? "" : <span className="ed-muted" data-series-empty=""> First study in the works.</span>}</dd>
      </div>)}</dl>
    </section>
    {home.shelf.length > 0 && <section aria-labelledby="in-the-works" id="in-the-works-block" className={`ed-wrap ${GAP}`} data-studies-shelf="">
      <h2 id="in-the-works" className="ed-h2">In the works</h2>
      <p className="ed-small mt-1 max-w-[60ch]">Studies the archive and the live crawl are still building, and what each is waiting for.</p>
      <ul className="mt-3 grid grid-cols-1 gap-x-10 lg:grid-cols-2" aria-label="In the works">{home.shelf.map(r => <li key={r.key} className="border-b border-ed-rule py-3" data-shelf-row={r.key}>
        <p className="ed-small break-words"><span className="ledger-tag mr-2 align-[0.1em]">{r.ready ? "Ready to write" : "Waiting"}</span><span className="font-semibold">{r.question}</span></p>
        <p className="ed-caption mt-1">{r.series}{r.ready ? "" : ` · ${r.wait}`}{r.earliest ? ` ${r.earliest}.` : ""}</p>
      </li>)}</ul>
    </section>}
    <section aria-labelledby="studies-tool" className={`ed-wrap ${GAP} mb-4`} data-studies-tool="">
      <ul className="ledger"><li className="ledger-row flex flex-col gap-1 py-3 md:flex-row md:items-baseline md:gap-4">
        <span className="ed-kicker shrink-0 md:w-24">Tool</span>
        <span className="min-w-0"><span id="studies-tool" className="ed-small font-semibold">{home.tool.question}</span> <span className="ed-small">{home.tool.line}</span></span>
        <Link to="/data/where-you-sit" className="ed-tap ed-data inline-flex min-h-[44px] shrink-0 items-center md:ml-auto">Try it →</Link>
      </li></ul>
    </section>
  </>;
}
export function DataIndexView({ home }: { home: StudiesHome }) {
  return <DigestShell label="Studies" section="signals">
    <DataIndexHead />
    <DataIndexBody home={home} />
    <ReadFooter terminal="/terminal?panel=history" />
  </DigestShell>;
}
export function DraftView({ d }: { d: { number: number; question: string; deck: string; template: string; reason: string | null; series?: string } }) {
  return <DigestShell label="Studies" section="signals">
    <header className="ed-wrap pt-8 md:pt-12">
      <p className="ed-kicker flex flex-wrap gap-x-3"><Link to="/data" className="ed-tap no-underline">{d.series ? `${d.series} · ` : ""}Study No. {d.number}</Link><span>In the works</span></p>
      <h1 className="ed-h1 mt-3 max-w-[22ch]">{d.question}</h1>
      <p className="ed-standfirst mt-4 max-w-[60ch]">{d.deck}</p>
      <p className="ed-body mt-6 max-w-[60ch]"><strong>{voiced("data.dataIndexView.1")}</strong> {d.reason}</p>
      <p className="ed-data mt-6"><Link to="/data" className="ed-tap">← All studies</Link></p>
    </header>
    <ReadFooter terminal="/terminal?panel=history" />
  </DigestShell>;
}
