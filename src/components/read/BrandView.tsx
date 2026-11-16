// BRAND object page (/brands/<domain>): Headline → Evidence → So what → Related.
import { Link } from "@tanstack/react-router";
import type { BrandPage } from "@/lib/brand";
import type { Story } from "@/lib/stories";
import { RelatedStories } from "./StoryCard";
import type { TraitRef } from "@/lib/agency/audit";
import { storyTime } from "@/lib/stories";
import { pct } from "@/lib/digest/copy";
import { BasisWord, DigestShell, Dim, SiteCard, StageWord, Swatches, pr } from "@/components/digest/Editorial";
import { AppLink } from "@/components/terminal/AppLink";
import { ObjectPage, BlockPart } from "./ObjectPage";
import { ReadFooter } from "./Bits";

const Refs = ({ xs, empty }: { xs: TraitRef[]; empty: string }) => xs.length ? <ul className="space-y-3">{xs.map(x => <li key={x.trait} className="ed-hair pt-2">
  <Link to="/signals/$key" params={{ key: x.trait }} className="ed-small font-medium">{x.name}</Link>
  <p className="ed-data mt-1 flex flex-wrap items-center gap-2"><Dim d={x.dimension} /><BasisWord b={x.basis} /><StageWord stage={x.stage} />{x.share != null && <span>{pct(x.share, 1)}</span>}</p>
</li>)}</ul> : <p className="ed-small">{empty}</p>;

export function BrandView({ b }: { b: BrandPage & { stories?: Story[] } }) {
  const face = (f: { family: string; google: boolean } | null, role: string) => f ? <p className="ed-small"><span className="ed-kicker">{role} · </span>{f.family}{f.google ? <span className="ed-caption"> (Google Fonts)</span> : null}</p> : <p className="ed-small"><span className="ed-kicker">{role} · </span>not measured</p>;
  return <DigestShell label={`${b.name} brand`} section="brands" lens={false}>
    <ObjectPage kind="brand" id="ed-brand" blocks={{
      headline: <div className="ed-grid">
        <div className="lg:col-span-7">
          <p className="ed-kicker">Brand · {b.sectorName}</p>
          <h1 id="ed-brand-title" className="ed-cover mt-3 break-words">{b.name}</h1>
          <p className="ed-data mt-4 flex flex-wrap gap-x-4"><a href={`https://${b.domain}`} target="_blank" rel="noopener" {...pr(`https://${b.domain}`)}>{b.domain} ↗</a><span>Last captured {b.captured ? storyTime(b.captured) : "—"}</span></p>
          {b.lastMove && <p className="ed-standfirst mt-6">{b.lastMove.text}<span className="ed-caption block mt-1">{storyTime(b.lastMove.at)}</span></p>}
          <p className="ed-data mt-4"><AppLink href={b.actions.terminal} className="ed-tap">Dense record in the terminal ⇄</AppLink></p>
        </div>
        <div className="lg:col-span-5"><SiteCard domain={b.domain} name={b.name} sector={b.sectorName} thumb={b.thumb} lines={[b.captured ? `captured ${b.captured.slice(0, 10)}` : "not captured yet"]} sizes="(min-width: 1024px) 40vw, 100vw" /></div>
      </div>,
      evidence: <>
        <BlockPart title="Identity" kicker="From the latest desktop homepage capture. Voice and aesthetic tags are AI estimates.">
          <div className="ed-grid">
            <div className="space-y-2 lg:col-span-4">{face(b.identity.h1, "Headline type")}{face(b.identity.body, "Body type")}<p className="ed-small"><span className="ed-kicker">Theme · </span>{b.identity.theme ?? "not measured"}</p>{b.identity.accent && <p className="ed-small"><span className="ed-kicker">Accent · </span>{b.identity.accent.name} <span className="ed-data ed-muted">{b.identity.accent.hex}</span></p>}</div>
            <div className="lg:col-span-4">{b.identity.palette.length ? <Swatches colors={b.identity.palette} label={`${b.name} palette`} /> : <p className="ed-small">Palette not measured.</p>}</div>
            <ul className="flex flex-wrap content-start gap-2 lg:col-span-4" aria-label="Voice and aesthetic tags">{b.identity.tags.map(t => <li key={t.key} className="ed-data flex items-center gap-1"><span>{t.name}</span><BasisWord b={t.basis} /></li>)}{!b.identity.tags.length && <li className="ed-small">No confident AI read yet.</li>}</ul>
          </div>
        </BlockPart>
        <BlockPart title="Timeline of moves" kicker="Confirmed changes (two captures agree) and rebrands, newest first.">
          {b.timeline.length ? <ol className="space-y-3">{b.timeline.map(t => <li key={t.id} className="ed-hair grid grid-cols-1 gap-x-6 pt-2 md:grid-cols-[12rem_minmax(0,1fr)]">
            <p className="ed-data ed-muted"><time dateTime={t.at}>{storyTime(t.at)}</time><br />{t.kind}</p>
            <p className="ed-small">{t.text} {t.basis === "ai" && <BasisWord b="ai" />}{t.story && <> <AppLink href={t.href} className="ed-tap">Story →</AppLink></>}</p>
          </li>)}</ol> : <p className="ed-small">No confirmed move recorded yet.</p>}
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
