// E5 · THE DIGEST, one argument a week. Renders the pure edition model (src/lib/digest/edition.ts) and nothing else, top to bottom:
// the dark headline block, the argument, one chart, the five changes that mattered with their pictures beside them, what to do with it,
// the numbers line, corrections when needed, and three links to keep reading. Cream page, hairline rows, no gallery.
import { Link } from "@tanstack/react-router";
import type { Edition, EditionRow } from "@/lib/digest/edition";
import { DigestShell, DigestFooter, Figure, SectionHead, pr } from "./Editorial";
import { StoryCover } from "@/components/read/Covers";
import { BeforeAfter, CropFigure } from "@/components/read/Evidence";
import { FiltersScope } from "@/components/brand/Illustration";
import { StoryNo } from "@/components/brand/Ledger";
import { Receipt } from "@/components/read/StoryCard";
import { longDate } from "@/lib/digest/week";
import { CONTACT_EMAIL } from "@/lib/site";

const LONG = 48;
const footerOf = (e: Edition) => ({ methodology: "/#m-the-digest", glossary: "/#g-stage", rss: "/digest/rss.xml", terminal: "/", contact: CONTACT_EMAIL ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Correction: ${e.name} No. ${e.number}`)}` : null });

function Row({ r }: { r: EditionRow }) {
  const pic = r.picture;
  return <li className="ledger-row py-6 md:py-8" data-digest-row={r.number ?? r.id}>
    <div className={pic ? "grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10" : ""}>
      <div className="min-w-0">
        <p className="ed-kicker flex flex-wrap items-baseline gap-x-3">{r.number != null && <StoryNo n={r.number} />}<span className="break-words">{r.subject}</span>{r.when && <span className="ed-muted whitespace-nowrap">{r.when}</span>}</p>
        <div className="ed-body mt-3"><p className="max-w-[62ch] text-[1.125rem] leading-relaxed">{r.sentence}</p></div>
        <p className="mt-3"><Link to={r.href as "/"} className="ed-tap inline-flex min-h-[44px] items-center" {...pr(r.href)}>Read the story →</Link></p>
      </div>
      {pic && <div className="min-w-0" data-digest-picture="">
        {pic.kind === "pair" ? <BeforeAfter before={pic.before} after={pic.after} sizes="(min-width: 1024px) 30vw, 100vw" /> : <CropFigure crop={pic.crop} sizes="(min-width: 1024px) 55vw, 100vw" />}
      </div>}
    </div>
  </li>;
}

const ARGUMENT_MEASURE = { maxWidth: "68ch" } as const;
export function EditionView({ issue: e, latest = false }: { issue: Edition; latest?: boolean }) {
  const t = e.text;
  let n = 0; const next = () => String(++n).padStart(2, "0");
  return <DigestShell label={`${e.name} No. ${e.number}`}>
    <FiltersScope>
    <article aria-labelledby="ed-story-title" data-digest="edition" data-words={e.words}>
      <StoryCover seed={e.number} headline={t.headline} long={t.headline.length > LONG} deck={t.deck} object={null}
        kicker={<span>{e.kicker}</span>}
        left={<span className="cover-num block">No. {e.number}</span>}
        right={<span className="block">{e.dates.label}</span>} />

      <div className="ed-wrap">
        {latest && <p className="ed-caption mt-6" data-digest-next="">{`Next issue: No. ${e.next.number}, ${longDate(e.next.monday)}`}</p>}
        {/* E5b · the argument is the issue's main text: set exactly as a study's opening paragraph (ed-body, 68ch). */}
        <section aria-label="The argument" className="mt-12 space-y-5 md:mt-16" data-digest-argument="">
          {t.argument.map((p, i) => <p key={i} className="ed-body" style={ARGUMENT_MEASURE}>{p}</p>)}
          {t.stale && t.at && <p className="ed-caption" data-text-from="">Text from {longDate(t.at)}</p>}
        </section>

        {e.chart && <section aria-labelledby="dg-chart" className="mt-16 lg:mt-20" data-digest-chart="">
          <SectionHead n={next()} title={`${e.chart.name}, by quarter`} id="dg-chart" />
          <Figure card={{ series: e.chart.series, forecast: [] }} label={`${e.chart.name}: share of tracked homepages by quarter`} caption={<>{t.chart_caption ?? e.chart.caption}</>} />
        </section>}

        <section aria-labelledby="dg-changes" className="mt-16 lg:mt-20" data-digest-changes="">
          <SectionHead n={next()} title={e.rows.length >= 5 ? "Five changes that mattered" : "The changes that mattered"} id="dg-changes" />
          <ul className="ledger" aria-label="The week's changes">{e.rows.map(r => <Row key={r.id} r={r} />)}</ul>
          {e.quiet && <p className="ed-small mt-4" data-digest-quiet="">{e.quiet}</p>}
        </section>

        {t.use && <section aria-labelledby="dg-use" className="mt-16 lg:mt-20" data-digest-use="">
          <SectionHead n={next()} title="What to do with it" id="dg-use" />
          <p className="ed-pull max-w-[62ch]">{t.use}</p>
        </section>}

        <section aria-labelledby="dg-numbers" className="mt-16 lg:mt-20" data-digest-numbers="">
          <SectionHead n={next()} title="The numbers" id="dg-numbers" />
          <p className="ed-small max-w-[68ch]">{e.numbers.map((p, i) => <span key={p.href + i}>{i > 0 && " · "}<Receipt href={p.href} className="ed-tap" {...pr(p.href)}>{p.text}</Receipt></span>)}.</p>
          {e.corrections && <p className="ed-small mt-4 max-w-[68ch] border-l-2 border-ed-ink pl-3" role="note" data-digest-corrections="">{e.corrections.text} <Link to="/what-we-show" hash="ed-w-story" className="ed-tap">What makes a story</Link></p>}
        </section>

        <nav aria-labelledby="dg-keep" className="mt-16 lg:mt-20" data-digest-keep="">
          <SectionHead n={next()} title="Keep reading" id="dg-keep" />
          <ul className="flex flex-col gap-y-2 md:flex-row md:flex-wrap md:gap-x-8">{e.keep.map(k => <li key={k.href} className="min-w-0"><Link to={k.href as "/"} className="ed-tap inline-flex min-h-[44px] items-center break-words" {...pr(k.href)}>{k.label} →</Link></li>)}</ul>
        </nav>
      </div>
    </article>
    </FiltersScope>
    <DigestFooter footer={footerOf(e)} />
  </DigestShell>;
}
