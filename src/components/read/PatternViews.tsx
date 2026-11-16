// PATTERNS: /patterns (headline layout + composite signals with ≥3 example brands) and /patterns/<key> (the example grid).
import { Link } from "@tanstack/react-router";
import type { PatternPage, PatternRow } from "@/lib/patterns";
import type { Story } from "@/lib/stories";
import { RelatedStories } from "./StoryCard";
import { PATTERN_MIN_EXAMPLES } from "@/lib/patterns";
import { sectorName } from "@/lib/labels";
import { pct } from "@/lib/digest/copy";
import { BasisWord, DigestShell, Dim, StageWord, pr } from "@/components/digest/Editorial";
import { AppLink } from "@/components/terminal/AppLink";
import { ObjectPage, BlockPart } from "./ObjectPage";
import { ReadFooter } from "./Bits";
import { useSectorLens } from "./lens";
import { CropFallback, CropFigure } from "./Evidence";
import { ILLUSTRATED_MIN } from "@/lib/crops";
import type { PatternExample } from "@/lib/patterns";

/** One example brand: its section crop when current, else the typographic card with the honest line. */
function Example({ e, section }: { e: PatternExample; section: string }) {
  return <article className="flex flex-col gap-2">
    {e.crop ? <CropFigure crop={e.crop} sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw" /> : <CropFallback domain={e.domain} section={section} />}
    <h3 className="ed-small font-medium">{e.name ?? e.domain}</h3>
    <p className="ed-caption">{e.sectorName} · {e.crop ? `captured ${e.crop.captured_at.slice(0, 10)}` : e.captured ? `measured ${e.captured.slice(0, 10)}` : "capture date unknown"}</p>
    <p className="ed-data flex flex-wrap gap-x-3"><Link to="/brands/$domain" params={{ domain: e.domain }} className="ed-tap" {...pr(`/brands/${e.domain}`)}>Brand page →</Link><a href={`https://${e.domain}`} target="_blank" rel="noopener" className="ed-tap" {...pr(`https://${e.domain}`)}>Live site ↗</a></p>
  </article>;
}

export function PatternsIndexView({ patterns, sector, illustrated = false, total, illustratedCount }: { patterns: PatternRow[]; sector: string; illustrated?: boolean; total: number; illustratedCount: number }) {
  const sec = sector === "all" ? undefined : sector;
  return <DigestShell label="Patterns" section="patterns" lens>
    <header className="ed-wrap pt-8 md:pt-12">
      <p className="ed-kicker">Patterns · {sectorName(sector)}</p>
      <h1 className="ed-cover mt-3">Signals, seen as examples</h1>
      <p className="ed-standfirst mt-5">Headline layout and composite signals with at least {PATTERN_MIN_EXAMPLES} example brands{sector !== "all" ? ` in ${sectorName(sector)}` : ""}. Open one for the brands that show it.</p>
      <nav aria-label="Filter patterns by captures" className="ed-data mt-6 flex flex-wrap gap-x-5">
        <Link to="/patterns" search={{ sector: sec, illustrated: undefined }} className={`ed-tap ${!illustrated ? "font-semibold underline" : ""}`} aria-current={!illustrated ? "page" : undefined}>All patterns <span className="ed-muted">{total}</span></Link>
        <Link to="/patterns" search={{ sector: sec, illustrated: "1" }} className={`ed-tap ${illustrated ? "font-semibold underline" : ""}`} aria-current={illustrated ? "page" : undefined}>Illustrated <span className="ed-muted">{illustratedCount}</span></Link>
      </nav>
      <p className="ed-caption mt-1">Illustrated: at least {ILLUSTRATED_MIN} example brands have a current capture of the section that shows the pattern.</p>
    </header>
    <section aria-label="Patterns" className="ed-wrap mt-10">
      {patterns.length ? <ul className="grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3">{patterns.map(p => <li key={p.key} className="ed-hair pt-4">
        <p className="ed-data flex flex-wrap items-center gap-2"><Dim d={p.dimension} /><BasisWord b={p.basis} /><StageWord stage={p.stage} /></p>
        <h2 className="ed-h3 mt-2"><Link to="/patterns/$key" params={{ key: p.key }} search={{ sector: sector === "all" ? undefined : sector }} className="no-underline hover:underline">{p.name}</Link></h2>
        <p className="ed-data mt-1">{p.examples} examples · {p.withCaptures} with {p.withCaptures === 1 ? "a capture" : "captures"} · Momentum {p.momentum_index ?? "—"} · Confidence {p.confidence}</p>
        {p.so_what && <p className="ed-small mt-2">{p.so_what}</p>}
        <p className="ed-caption mt-2">{p.sample.join(" · ")}</p>
      </li>)}</ul> : <p className="ed-body">{illustrated ? `No pattern is illustrated yet: none has ${ILLUSTRATED_MIN} example brands with a current capture${sector !== "all" ? ` in ${sectorName(sector)}` : ""}. Crops arrive when the crawler sends them.` : `No headline layout or composite signal has ${PATTERN_MIN_EXAMPLES} example brands${sector !== "all" ? ` in ${sectorName(sector)}` : ""} yet.`}</p>}
    </section>
    <ReadFooter terminal="/terminal?panel=patterns" />
  </DigestShell>;
}

export function PatternView({ p }: { p: PatternPage & { stories?: Story[] } }) {
  const [, setSector] = useSectorLens();
  return <DigestShell label={`${p.name} pattern`} section="patterns" lens>
    <ObjectPage kind="pattern" id="ed-pattern" blocks={{
      headline: <div>
        <p className="ed-kicker">Pattern · {p.dimension}</p>
        <h1 id="ed-pattern-title" className="ed-cover mt-3">{p.name}</h1>
        <p className="ed-data mt-4 flex flex-wrap items-center gap-x-3 gap-y-2"><Dim d={p.dimension} /><BasisWord b={p.basis} /><StageWord stage={p.stage} />{p.share != null && <span>{pct(p.share, 1)} of tracked homepages</span>}<span>Momentum {p.momentum_index ?? "—"}{p.direction ? ` · ${p.direction}` : ""}</span><span title={p.confidence_reason}>Confidence {p.confidence}</span></p>
        <p className="ed-data mt-4" data-testid="pattern-count">{p.countLine}{p.illustrated ? " · illustrated" : ""}</p>
        <p className="ed-standfirst mt-6">{p.total} {p.total === 1 ? "brand shows" : "brands show"} it{p.sector !== "all" ? ` in ${sectorName(p.sector)}` : ""} on their current homepage. Examples show each brand's {p.sectionName.toLowerCase()}.</p>
      </div>,
      evidence: <>
        <nav aria-label="Filter examples by sector" className="ed-data flex flex-wrap gap-x-4">
          <button type="button" onClick={() => setSector("all")} className={`ed-tap cursor-pointer ${p.sector === "all" ? "font-semibold underline" : ""}`}>All sectors</button>
          {p.sectors.map(s => <button key={s.sector} type="button" onClick={() => setSector(s.sector)} className={`ed-tap cursor-pointer ${p.sector === s.sector ? "font-semibold underline" : ""}`}>{s.name}<span className="ed-muted ml-1.5">{s.count}</span></button>)}
        </nav>
        {p.note && <p className="ed-caption mt-3">{p.note}</p>}
        {p.examples.length ? <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-4">{p.examples.map(e => <Example key={e.domain} e={e} section={p.sectionName} />)}</div>
          : <p className="ed-body mt-6">No brand in {sectorName(p.sector)} shows it yet.</p>}
        {p.total > p.examples.length && <p className="ed-caption mt-4">Showing {p.examples.length} of {p.total}, brands with captures first, then latest measurement.</p>}
      </>,
      "so-what": <p className="ed-pull max-w-[44ch]">{p.soWhat || "Not a headline signal right now, so we don't write a so-what line for it."}</p>,
      related: <>
        <BlockPart title="The signal behind it"><p className="ed-data flex flex-wrap gap-x-6"><Link to="/signals/$key" params={{ key: p.key }} className="ed-tap" {...pr(p.signalHref)}>{p.name}: chart, evidence and calls →</Link><AppLink href={p.whoUses} className="ed-tap">Who uses this well ⇄</AppLink></p></BlockPart>
        <BlockPart title="Stories naming it"><RelatedStories stories={p.stories ?? []} empty="No story has named this pattern yet." /></BlockPart>
        {p.related.length > 0 && <BlockPart title="Related patterns"><ul className="ed-data flex flex-wrap gap-x-6 gap-y-1">{p.related.map(r => <li key={r.key}><Link to="/patterns/$key" params={{ key: r.key }} className="ed-tap">{r.name}</Link> <span className="ed-muted">{r.examples} brands</span></li>)}</ul></BlockPart>}
      </>,
    }} />
    <ReadFooter terminal={`/terminal?panel=patterns&trait=${encodeURIComponent(p.key)}`} />
  </DigestShell>;
}
