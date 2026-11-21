import { dataHref } from "@/lib/ia";
import { line as voiced } from "@/lib/voice";
// PATTERN object page: /patterns/<key> (the example grid). The /patterns gallery lives in GalleryView.
import { Link } from "@tanstack/react-router";
import type { PatternPage } from "@/lib/patterns";
import type { Story } from "@/lib/stories";
import { RelatedStories } from "./StoryCard";
import { sectorName } from "@/lib/labels";
import { pct } from "@/lib/digest/copy";
import { BasisWord, DigestShell, Dim, StageWord, pr } from "@/components/digest/Editorial";
import { AppLink } from "@/components/terminal/AppLink";
import { ObjectPage, BlockPart } from "./ObjectPage";
import { ReadFooter } from "./Bits";
import { Ledger } from "@/components/brand/Ledger";
import { useSectorLens } from "./lens";
import { CropFallback, CropFigure } from "./Evidence";
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

export function PatternView({ p }: { p: PatternPage & { stories?: Story[] } }) {
  const [, setSector] = useSectorLens();
  return <DigestShell label={`${p.name} pattern`} section="patterns" lens>
    <ObjectPage kind="pattern" id="ed-pattern" blocks={{
      headline: <div>
        <p className="ed-kicker">Pattern · {p.dimension}</p>
        <h1 id="ed-pattern-title" className="ed-h1 mt-3">{p.name}</h1>
        <p className="ed-data mt-3 flex flex-wrap items-center gap-x-3 gap-y-2"><Dim d={p.dimension} /><BasisWord b={p.basis} /><StageWord stage={p.stage} /></p>
        <dl className="facts-row mt-4" data-facts-row="">
          <div><dt>Share</dt><dd>{p.share != null ? `${pct(p.share, 1)}` : "—"}</dd></div>
          <div><dt>Momentum</dt><dd>{p.momentum_index ?? "—"}{p.direction ? ` · ${p.direction}` : ""}</dd></div>
          <div><dt>Confidence</dt><dd title={p.confidence_reason}>{p.confidence}</dd></div>
          <div><dt>Brands</dt><dd>{p.total}</dd></div>
        </dl>
        <p className="ed-data mt-4" data-testid="pattern-count">{p.countLine}{p.illustrated ? " · illustrated" : ""}</p>
        <p className="ed-standfirst mt-6">{p.total} {p.total === 1 ? "brand shows" : "brands show"} it{p.sector !== "all" ? ` in ${sectorName(p.sector)}` : ""} on their current homepage. Examples show each brand's {p.sectionName.toLowerCase()}.</p>
      </div>,
      evidence: <>
        <nav aria-label="Filter examples by sector" className="ed-data flex flex-wrap gap-x-4">
          <button type="button" onClick={() => setSector("all")} className={`ed-tap cursor-pointer ${p.sector === "all" ? "font-semibold underline" : ""}`}>All sectors</button>
          {p.sectors.map(s => <button key={s.sector} type="button" onClick={() => setSector(s.sector)} className={`ed-tap cursor-pointer ${p.sector === s.sector ? "font-semibold underline" : ""}`}>{s.name}<span className="ed-muted ml-1.5">{s.count}</span></button>)}
        </nav>
        {p.note && <p className="ed-caption mt-3">{p.note}</p>}
        {p.examples.length ? <ul className="tile-wall mt-6" data-tile-wall="">{p.examples.map((e, i) => <li key={e.domain} className={i === 0 ? "tile-lg" : "tile-sm"}><Example e={e} section={p.sectionName} /></li>)}</ul>
          : <p className="ed-body mt-6">No brand in {sectorName(p.sector)} shows it yet.</p>}
        {p.total > p.examples.length && <p className="ed-caption mt-4">Showing {p.examples.length} of {p.total}, brands with captures first, then latest measurement.</p>}
      </>,
      "so-what": <p className="ed-pull max-w-[44ch]">{p.soWhat || "Not a headline signal right now, so we don't write a so-what line for it."}</p>,
      related: <>
        <BlockPart title="The signal behind it"><p className="ed-data flex flex-wrap gap-x-6"><Link to="/signals/$key" params={{ key: p.key }} className="ed-tap" {...pr(p.signalHref)}>{p.name}: chart, evidence and calls →</Link><AppLink href={p.whoUses} className="ed-tap">Who uses this well ⇄</AppLink></p></BlockPart>
        <BlockPart title="Stories naming it"><RelatedStories stories={p.stories ?? []} empty={voiced("read.patternViews.1")} /></BlockPart>
        {p.related.length > 0 && <BlockPart title="Related patterns"><Ledger small label="Related patterns" rows={p.related.map(r => ({ key: r.key, href: `/patterns/${encodeURIComponent(r.key)}`, title: r.name, facts: [`${r.examples} brands`] }))} /></BlockPart>}
      </>,
    }} />
    <ReadFooter terminal={dataHref({ type: "pattern", id: p.key })} />
  </DigestShell>;
}
