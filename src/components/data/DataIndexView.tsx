// /data, the Studies home (E4): a heading, the lead study, the series in order with their studies, the "In the works" shelf and the
// brand tool, and nothing else. Template names, draft tags and draft reasons stay off this page (the study page's basis carries them).
import { Link } from "@tanstack/react-router";
import type { StudiesHome, HomeStudy } from "@/lib/data-stories/shelf";
import { dayText, pctText } from "@/lib/data-stories/text";
import { DigestShell } from "@/components/digest/Editorial";
import { ReadFooter } from "@/components/read/Bits";
import { Ledger, StoryNo } from "@/components/brand/Ledger";
import { FiltersScope, Trail } from "@/components/brand/Illustration";
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
      <p className="mt-6"><span className="ed-stat block" data-key-figure="">{s.key.n}</span><span className="ed-small mt-1 block max-w-[40ch]">{s.key.label}</span></p>
      <p className="ed-data mt-6"><Link to="/data/$slug" params={{ slug: s.slug }} className="ed-tap inline-flex min-h-[44px] items-center">Read the study →</Link></p>
    </div>
  </section>;
}
function Series({ s }: { s: StudiesHome["series"][number] }) {
  return <section aria-labelledby={`series-${s.id}`} className="mt-10 first:mt-0" data-series={s.id}>
    <h3 id={`series-${s.id}`} className="ed-h2">{s.title}</h3>
    <p className="ed-small mt-1 max-w-[60ch]">{s.description}</p>
    {s.studies.length
      ? <Ledger className="mt-3" label={s.title} rows={s.studies.map(x => ({ key: x.slug, href: x.href, number: <StoryNo n={x.number} />, title: x.headline, line: <><span className="block">{x.question}</span>{x.dataThrough && <span className="ed-data mt-1 block">{`Data through ${dayText(x.dataThrough)}`}</span>}</> }))} />
      : <p className="ed-small ed-muted mt-3" data-series-empty="">First study in the works.</p>}
  </section>;
}
export function DataIndexView({ home }: { home: StudiesHome }) {
  return <DigestShell label="Studies" section="signals">
    <header className="ed-wrap pt-8 md:pt-12" data-studies-head="">
      <p className="ed-kicker">Studies</p>
      <h1 className="ed-h1 mt-3 max-w-[24ch]">{STUDIES_TITLE}</h1>
      <p className="ed-standfirst mt-4 max-w-[60ch]">{STUDIES_STANDFIRST}</p>
    </header>
    {home.lead && <Lead s={home.lead} />}
    <section aria-labelledby="studies-series" className={`ed-wrap ${GAP}`} data-studies-series="">
      <h2 id="studies-series" className="sr-only">The series</h2>
      {home.series.map(s => <Series key={s.id} s={s} />)}
    </section>
    {home.shelf.length > 0 && <section aria-labelledby="in-the-works" id="in-the-works-block" className={`ed-wrap ${GAP}`} data-studies-shelf="">
      <h2 id="in-the-works" className="ed-h2">In the works</h2>
      <p className="ed-small mt-1 max-w-[60ch]">Studies the archive and the live crawl are still building, and what each is waiting for.</p>
      <ul className="ledger mt-3" aria-label="In the works">{home.shelf.map(r => <li key={r.key} className="ledger-row px-2 py-3" data-shelf-row={r.key}>
        <p className="ed-small font-semibold break-words">{r.question}</p>
        <p className="ed-caption mt-1">{r.series} · {r.wait}{r.earliest ? ` ${r.earliest}.` : ""}</p>
      </li>)}</ul>
    </section>}
    <section aria-labelledby="studies-tool" className={`ed-wrap ${GAP} mb-4`} data-studies-tool="">
      <ul className="ledger"><li className="ledger-row flex flex-col gap-1 px-2 py-3 md:flex-row md:items-baseline md:gap-4">
        <span className="ed-kicker shrink-0 md:w-24">Tool</span>
        <span className="min-w-0"><span id="studies-tool" className="ed-small font-semibold">{home.tool.question}</span> <span className="ed-small">{home.tool.line}</span></span>
        <Link to="/data/where-you-sit" className="ed-tap ed-data inline-flex min-h-[44px] shrink-0 items-center md:ml-auto">Try it →</Link>
      </li></ul>
    </section>
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
