// BRAND object page (/brands/<domain>): Headline → Evidence → So what → Related.
import { Link } from "@tanstack/react-router";
import type { BrandPage } from "@/lib/brand-page";
import type { Story } from "@/lib/stories";
import { RelatedStories } from "./StoryCard";
import type { TraitRef } from "@/lib/agency/audit";
import { storyTime } from "@/lib/stories";
import { pct } from "@/lib/digest/copy";
import { BasisWord, DigestShell, Dim, SiteCard, StageWord, Swatches, pr } from "@/components/digest/Editorial";
import { AppLink } from "@/components/terminal/AppLink";
import { ObjectPage, BlockPart } from "./ObjectPage";
import { ReadFooter } from "./Bits";
import { Ledger } from "@/components/brand/Ledger";
import { BeforeAfter, CropFallback, CropFigure } from "./Evidence";
import { CROP_SECTION_NAME } from "@/lib/labels";
import { isCropSection, type CropSection } from "@/lib/crops";

const Refs = ({ xs, empty }: { xs: TraitRef[]; empty: string }) => xs.length ? <ul className="space-y-3">{xs.map(x => <li key={x.trait} className="ed-hair pt-2">
  <Link to="/signals/$key" params={{ key: x.trait }} className="ed-small font-medium">{x.name}</Link>
  <p className="ed-data mt-1 flex flex-wrap items-center gap-2"><Dim d={x.dimension} /><BasisWord b={x.basis} /><StageWord stage={x.stage} />{x.share != null && <span>{pct(x.share, 1)}</span>}</p>
</li>)}</ul> : <p className="ed-small">{empty}</p>;

/** Sections strip: the latest crop of each section that exists; each opens its history (?section=…). Zero crops → the honest fallback. */
function Sections({ b, open }: { b: BrandPage; open: CropSection | null }) {
  const hist = open ? b.history[open] : [];
  return <div id="ed-sections">
    {b.sections.length ? <ul className="tile-wall" data-tile-wall="">{b.sections.map((c, i) => <li key={c.section} className={i === 0 ? "tile-lg" : "tile-sm"}>
      <CropFigure crop={c} sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw" />
      <p className="ed-data mt-1"><Link to="/brands/$domain" params={{ domain: b.domain }} search={{ section: c.section }} hash="ed-sections" resetScroll={false} className="ed-tap" aria-current={open === c.section ? "true" : undefined}>History · {c.versions} {c.versions === 1 ? "version" : "versions"} →</Link></p>
    </li>)}</ul> : <div className="max-w-md"><CropFallback domain={b.domain} section={CROP_SECTION_NAME.hero} /><p className="ed-caption mt-2">No section of this brand has been captured yet. Crops arrive when the crawler sends them.</p></div>}
    {open && <div className="mt-10" role="region" aria-labelledby="ed-section-history">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4"><h4 id="ed-section-history" className="ed-h3">{CROP_SECTION_NAME[open]} history</h4><Link to="/brands/$domain" params={{ domain: b.domain }} search={{}} hash="ed-sections" resetScroll={false} className="ed-tap ed-data">Close</Link></div>
      <p className="ed-caption mt-1">Every stored version, newest first. A new version is kept only when the section looks different; up to 12 are kept.</p>
      {hist.length ? <ol className="tile-wall mt-4">{hist.map((c, i) => <li key={c.src} className={i === 0 ? "tile-lg" : "tile-sm"}><CropFigure crop={c} label={`${i === 0 ? "Latest" : `Version ${hist.length - i}`} · seen ${c.captured_at.slice(0, 10)}${c.last_seen_at.slice(0, 10) !== c.captured_at.slice(0, 10) ? ` to ${c.last_seen_at.slice(0, 10)}` : ""}`} /></li>)}</ol>
        : <div className="mt-4 max-w-md"><CropFallback domain={b.domain} section={CROP_SECTION_NAME[open]} /></div>}
    </div>}
  </div>;
}

export function BrandView({ b, section = null }: { b: BrandPage & { stories?: Story[] }; section?: string | null }) {
  const open = isCropSection(section) ? section : null;
  const face = (f: { family: string; google: boolean } | null, role: string) => f ? <p className="ed-small"><span className="ed-kicker">{role} · </span>{f.family}{f.google ? <span className="ed-caption"> (Google Fonts)</span> : null}</p> : <p className="ed-small"><span className="ed-kicker">{role} · </span>not measured</p>;
  return <DigestShell label={`${b.name} brand`} section="brands" lens={false}>
    <ObjectPage kind="brand" id="ed-brand" blocks={{
      headline: <div className="ed-grid">
        <div className="lg:col-span-8">
          <p className="ed-kicker">Brand · {b.sectorName}</p>
          <h1 id="ed-brand-title" className="ed-h1 mt-3 break-words">{b.name}</h1>
          <dl className="facts-row mt-4" data-facts-row="">
            <div><dt>Site</dt><dd><a href={`https://${b.domain}`} target="_blank" rel="noopener" {...pr(`https://${b.domain}`)}>{b.domain} ↗</a></dd></div>
            <div><dt>Sector</dt><dd>{b.sectorName}</dd></div>
            <div><dt>Last captured</dt><dd>{b.captured ? storyTime(b.captured) : "—"}</dd></div>
            <div><dt>Moves</dt><dd>{b.timeline.length}</dd></div>
            <div><dt>Signals</dt><dd>{b.shows.length}</dd></div>
          </dl>
          {b.lastMove && <p className="ed-standfirst mt-6">{b.lastMove.text}<span className="ed-caption block mt-1">{storyTime(b.lastMove.at)}</span></p>}
          <p className="ed-data mt-4"><AppLink href={b.actions.terminal} className="ed-tap">Dense record in the terminal ⇄</AppLink></p>
        </div>
        <div className="lg:col-span-4"><SiteCard domain={b.domain} name={b.name} sector={b.sectorName} thumb={b.thumb} lines={[b.captured ? `captured ${b.captured.slice(0, 10)}` : "not captured yet"]} sizes="(min-width: 1024px) 33vw, 100vw" /></div>
      </div>,
      evidence: <>
        <BlockPart title="Sections" kicker="Credited crops of the desktop homepage: hero, navigation, pricing, call to action and footer, each with its history."><Sections b={b} open={open} /></BlockPart>
        <BlockPart title="Identity" kicker="From the latest desktop homepage capture. Voice and aesthetic tags are AI estimates.">
          <div className="ed-grid">
            <div className="space-y-2 lg:col-span-4">{face(b.identity.h1, "Headline type")}{face(b.identity.body, "Body type")}<p className="ed-small"><span className="ed-kicker">Theme · </span>{b.identity.theme ?? "not measured"}</p>{b.identity.accent && <p className="ed-small"><span className="ed-kicker">Accent · </span>{b.identity.accent.name} <span className="ed-data ed-muted">{b.identity.accent.hex}</span></p>}</div>
            <div className="lg:col-span-4">{b.identity.palette.length ? <Swatches colors={b.identity.palette} label={`${b.name} palette`} /> : <p className="ed-small">Palette not measured.</p>}</div>
            <ul className="flex flex-wrap content-start gap-2 lg:col-span-4" aria-label="Voice and aesthetic tags">{b.identity.tags.map(t => <li key={t.key} className="ed-data flex items-center gap-1"><span>{t.name}</span><BasisWord b={t.basis} /></li>)}{!b.identity.tags.length && <li className="ed-small">No confident AI read yet.</li>}</ul>
          </div>
        </BlockPart>
        <BlockPart title="Timeline of moves" kicker="Confirmed changes (two captures agree) and rebrands, newest first.">
          {b.timeline.length ? <>
            <Ledger label="Timeline of moves" rows={b.timeline.map(t => ({ key: t.id, href: t.href, title: <>{t.text}{t.basis === "ai" && <> <BasisWord b="ai" /></>}</>, tags: [t.kind], facts: [t.story ? "Story" : "Receipt"], time: <time dateTime={t.at}>{storyTime(t.at)}</time> }))} />
            {(() => { const c = b.timeline.find(t => t.compare)?.compare; return c ? <div className="mt-6"><p className="ed-kicker mb-2">The latest move with crops on both sides</p><BeforeAfter before={c.before} after={c.after} /></div> : null; })()}
          </> : <p className="ed-small">No confirmed move recorded yet.</p>}
        </BlockPart>
        {b.versus && <BlockPart title={`Versus ${b.versus.scopeName}`} kicker="Signals this brand shows, read in its own sector's forecast (headline and supporting signals only).">
          <div className="ed-grid"><div className="lg:col-span-6"><h4 className="ed-kicker">Ahead · rising or emerging</h4><div className="mt-2"><Refs xs={b.versus.ahead} empty="None of its signals is rising or emerging right now." /></div></div>
            <div className="lg:col-span-6"><h4 className="ed-kicker">Behind · fading</h4><div className="mt-2"><Refs xs={b.versus.behind} empty="It uses no fading signals." /></div></div></div>
        </BlockPart>}
      </>,
      "so-what": <p className="ed-pull max-w-[44ch]">{b.soWhat}</p>,
      related: <>
        <BlockPart title="Stories about this brand"><RelatedStories stories={b.stories ?? []} empty="No story has named this brand yet." /></BlockPart>
        <BlockPart title="Closest brands in its sector" kicker="Most signals in common (headline and supporting).">
          {b.closest.length ? <ul className="ed-data flex flex-wrap gap-x-6 gap-y-1">{b.closest.map(c => <li key={c.domain}><Link to="/brands/$domain" params={{ domain: c.domain }} className="ed-tap">{c.name ?? c.domain}</Link> <span className="ed-muted">{c.shared} shared</span></li>)}</ul> : <p className="ed-small">No close match in its sector yet.</p>}
        </BlockPart>
        <BlockPart title="Signals it shows">
          {b.shows.length ? <ul className="ed-data flex flex-wrap gap-x-5 gap-y-2">{b.shows.map(s => <li key={s.key} className="flex items-center gap-1"><Link to="/signals/$key" params={{ key: s.key }} className="ed-tap">{s.name}</Link><StageWord stage={s.stage} />{s.tier === "headline" && <span className="ed-muted">headline</span>}</li>)}</ul> : <p className="ed-small">No staged signal measured on this brand yet.</p>}
        </BlockPart>
        <BlockPart title="Act">
          <p className="ed-data flex flex-wrap gap-x-6">
            <a href={b.actions.watch} className="ed-tap">+ Watch</a>
            <a href={b.actions.compare} className="ed-tap">Compare with…</a>
            {b.actions.audit && <a href={b.actions.audit} className="ed-tap">Audit against its closest brands</a>}
            <AppLink href={b.actions.differentiate} className="ed-tap">Differentiate from this brand ⇄</AppLink>
            {b.actions.recommendType && <AppLink href={b.actions.recommendType} className="ed-tap">Recommend type for {b.sectorName} ⇄</AppLink>}
          </p>
        </BlockPart>
      </>,
    }} />
    <ReadFooter terminal={b.actions.terminal} />
  </DigestShell>;
}
