// STORY object page (/stories/<id>): Headline → Evidence → So what → Related, from a stored story with the editor's edits applied.
import { Link } from "@tanstack/react-router";
import type { StoryPageModel } from "@/lib/stories/view";
import type { Thumb } from "@/lib/thumbs";
import { storyTime } from "@/lib/stories";
import { BasisWord, DigestShell, Dim, SiteCard, pr } from "@/components/digest/Editorial";
import { ObjectPage, BlockPart } from "./ObjectPage";
import { ReadFooter, Spark } from "./Bits";
import { Receipt, StoryCard } from "./StoryCard";

export type StoryPageData = StoryPageModel & { thumb: Thumb | null; series: { key: string; name: string; points: number[] } | null };
const JOB = { spot: "Spot what is changing", prove: "Prove who is doing it", act: "Act on the opening" } as const;
const day = (iso: string) => iso.slice(0, 10);

/** Longer headlines drop one step so a palette list can't fill the screen. */
const LONG_HEADLINE = 48;

export function StoryView({ s }: { s: StoryPageData }) {
  const notRun = s.state === "held" ? `This story did not run on the front page: ${s.heldReason}.` : s.state === "killed" ? `Taken down by the editor${s.killReason ? `: ${s.killReason}` : ""}.` : null;
  return <DigestShell label={s.headline} section="live">
    <ObjectPage kind="story" id="ed-story" blocks={{
      headline: <div className="max-w-[60rem]">
        <p className="ed-kicker flex flex-wrap items-center gap-2"><span>{s.kicker}</span>{s.basis && <BasisWord b={s.basis} />}<span className="ed-muted">{JOB[s.job]}</span></p>
        <h1 id="ed-story-title" className={`${s.headline.length > LONG_HEADLINE ? "ed-h1" : "ed-cover"} mt-3 break-words`}>{s.headline}</h1>
        {s.deck && <p className="ed-standfirst mt-5">{s.deck}</p>}
        <p className="ed-data ed-muted mt-4 flex flex-wrap gap-x-4"><time dateTime={s.at}>{storyTime(s.at)}</time>{s.sectorName && <span>{s.sectorName}</span>}{s.correctedAt && <span>Corrected {day(s.correctedAt)}</span>}{s.pinnedUntil && <span>Pinned to the front page</span>}</p>
        {notRun && <p className="ed-small mt-4 border-l-2 border-ed-ink pl-3" role="note">{notRun}</p>}
      </div>,
      evidence: <>
        {s.beforeAfter && <BlockPart title="Before → after" kicker="Two captures agree on the change; the brand page has the full record.">
          <div className="ed-grid">
            <div className="lg:col-span-4 ed-typo"><span className="ed-kicker ed-muted">Before</span><span className="ed-h3 break-words">{s.beforeAfter.before}</span></div>
            <div className="lg:col-span-4 ed-typo"><span className="ed-kicker ed-muted">After</span><span className="ed-h3 break-words">{s.beforeAfter.after}</span></div>
            {s.thumb && s.brands[0] && <div className="lg:col-span-4"><SiteCard domain={s.brands[0].domain} name={null} sector={s.sectorName ?? ""} thumb={s.thumb} lines={["latest capture"]} sizes="(min-width: 1024px) 30vw, 100vw" /></div>}
          </div>
        </BlockPart>}
        {!s.beforeAfter && s.thumb && s.brands[0] && <BlockPart title="Latest capture"><div className="max-w-md"><SiteCard domain={s.brands[0].domain} name={null} sector={s.sectorName ?? ""} thumb={s.thumb} lines={["latest capture"]} /></div></BlockPart>}
        <BlockPart title="Facts" kicker="Every line links to its receipt.">
          {s.facts.length ? <ul className="space-y-3">{s.facts.map((f, i) => <li key={i} className="ed-hair flex flex-wrap items-baseline gap-x-3 pt-2">
            <span className="ed-small">{f.href ? <Receipt href={f.href} {...pr(f.href)}>{f.text}</Receipt> : f.text}</span>{f.basis && <BasisWord b={f.basis} />}
          </li>)}</ul> : <p className="ed-small">No facts were stored with this story.</p>}
        </BlockPart>
        {s.series && <BlockPart title={`${s.series.name}: share by quarter`} kicker="Usable quarters only (15+ sites, 25% coverage), library-wide.">
          <p className="ed-data flex items-center gap-3"><Spark points={s.series.points} label={s.series.name} /><Link to="/signals/$key" params={{ key: s.series.key }} className="ed-tap">Full chart →</Link></p>
        </BlockPart>}
        {s.brands.length > 0 && <BlockPart title="Brands named">
          <ul className="ed-data flex flex-wrap gap-x-6 gap-y-1">{s.brands.map(b => <li key={b.domain}><Link to="/brands/$domain" params={{ domain: b.domain }} className="ed-tap">{b.domain}</Link></li>)}</ul>
        </BlockPart>}
      </>,
      "so-what": <>
        <p className="ed-pull max-w-[44ch]">{s.soWhat.text}</p>
        <p className="ed-data mt-3 flex flex-wrap items-center gap-2"><BasisWord b={s.soWhat.basis} /><span className="ed-muted">{s.soWhat.basis === "ai" ? `Written from the facts above by ${s.soWhat.model ?? "the AI model"}${s.soWhat.at ? ` on ${day(s.soWhat.at)}` : ""}, checked against them.` : "Deterministic so-what from the measured data."}</span></p>
        <details className="mt-6 max-w-[60rem]">
          <summary className="ed-tap ed-data cursor-pointer">Why this ran · score {s.score} of 100 (threshold {s.threshold})</summary>
          <table className="ed-data mt-3 w-full border-collapse text-left">
            <caption className="ed-caption mb-2 text-left">{s.whyRan}</caption>
            <thead><tr><th scope="col" className="py-1 pr-4">Component</th><th scope="col" className="py-1 pr-4 text-right">Points</th><th scope="col" className="py-1">Why</th></tr></thead>
            <tbody>{s.components.map(c => <tr key={c.id} className="ed-hair"><th scope="row" className="py-1 pr-4 font-normal">{c.label}</th><td className="num py-1 pr-4 text-right">{c.value}/25</td><td className="py-1">{c.why}</td></tr>)}</tbody>
          </table>
        </details>
      </>,
      related: <>
        {s.signals.length > 0 && <BlockPart title="Signals"><ul className="ed-data flex flex-wrap gap-x-6 gap-y-2">{s.signals.map(x => <li key={x.key} className="flex items-center gap-2"><Link to="/signals/$key" params={{ key: x.key }} className="ed-tap">{x.name}</Link><Dim d={x.dimension} /><BasisWord b={x.basis} /></li>)}</ul></BlockPart>}
        {s.patterns.length > 0 && <BlockPart title="Patterns"><ul className="ed-data flex flex-wrap gap-x-6">{s.patterns.map(p => <li key={p.key}><Link to="/patterns/$key" params={{ key: p.key }} className="ed-tap">{p.name} examples →</Link></li>)}</ul></BlockPart>}
        {s.evidence.length > 0 && <BlockPart title="Receipts"><ul className="ed-data flex flex-wrap gap-x-6 gap-y-1">{s.evidence.map(e => <li key={e.href}><Receipt href={e.href} className="ed-tap">{e.label}{e.href.startsWith("/") ? " →" : " ↗"}</Receipt></li>)}</ul></BlockPart>}
        <BlockPart title="Earlier stories on the same signal or brand">
          {s.earlier.length ? <div className="grid grid-cols-1 gap-8 md:grid-cols-2">{s.earlier.map(x => <StoryCard key={x.id} s={x} />)}</div> : <p className="ed-small">No earlier story on this signal or brand.</p>}
        </BlockPart>
        {s.edits.length > 0 && <BlockPart title="Editor's log"><ol className="ed-data space-y-1">{s.edits.map((e, i) => <li key={i}><time dateTime={e.at}>{day(e.at)}</time> · {e.action}{e.note ? ` · ${e.note}` : ""}</li>)}</ol></BlockPart>}
      </>,
    }} />
    <ReadFooter terminal={`/terminal?panel=today&story=${encodeURIComponent(s.id)}`} />
  </DigestShell>;
}
