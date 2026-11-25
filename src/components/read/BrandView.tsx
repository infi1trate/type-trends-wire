import { line as voiced } from "@/lib/voice";
// BRAND object page (/brands/<domain>, Steady): Headline (the identity card and the two actions) → Evidence (moves with their
// before/after captures, sections, how it sits in its sector) → So what → Related (similar brands, stories, signals).
import { SEASONAL_LABEL } from "@/lib/promo";
import { REVERSED_LABEL } from "@/lib/reversal";
import { Link } from "@tanstack/react-router";
import { faceLine, openPairId, type BrandCard, type BrandPage, type Face } from "@/lib/brand-page";
import type { ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { brandMovesQuery, brandSectionsQuery, brandSectorQuery, brandSimilarQuery, brandStoriesQuery } from "@/lib/data";
import type { SimilarResult } from "@/lib/similar";
import { Later, ROW } from "./Later";
import type { Story } from "@/lib/stories";
import { RelatedStories, Receipt } from "./StoryCard";
import type { TraitRef } from "@/lib/agency/audit";
import { storyTime } from "@/lib/stories";
import { pct } from "@/lib/digest/copy";
import { label as traitLabel, sectorName } from "@/lib/labels";
import { BasisWord, DigestShell, Dim, StageWord, pr } from "@/components/digest/Editorial";
import { AppLink } from "@/components/terminal/AppLink";
import { ObjectPage, BlockPart } from "./ObjectPage";
import { SurfacesPart } from "./Surfaces";
import { ReadFooter } from "./Bits";
import { Ledger } from "@/components/brand/Ledger";
import { Card, Raised } from "@/components/brand/Containers";
import { FigureView } from "@/components/data/Figures";
import { BeforeAfter, CoverFigure, CropFallback, CropFigure } from "./Evidence";
import { BrandMark, MarkedName } from "./BrandMark";
import type { Cover, Pic } from "@/lib/pictures";
import type { ArtNear } from "@/lib/art/read.server";
import { CROP_SECTION_NAME } from "@/lib/labels";
import { isCropSection, type CropSection } from "@/lib/crops";

const Refs = ({ xs, empty }: { xs: TraitRef[]; empty: string }) => xs.length ? <ul className="space-y-3">{xs.map(x => <li key={x.trait} className="ed-hair pt-2">
  <Link to="/signals/$key" params={{ key: x.trait }} className="ed-small font-medium">{x.name}</Link>
  <p className="ed-data mt-1 flex flex-wrap items-center gap-2"><Dim d={x.dimension} /><BasisWord b={x.basis} /><StageWord stage={x.stage} />{x.share != null && <span>{pct(x.share, 1)}</span>}</p>
</li>)}</ul> : <p className="ed-small">{empty}</p>;

/** Sections strip: the latest crop of each section that exists; each opens its history (?section=…). Zero crops → the honest fallback. */
type SectionsIn = Pick<BrandPage, "domain" | "sections" | "history">;
function Sections({ b, open }: { b: SectionsIn; open: CropSection | null }) {
  const hist = open ? b.history[open] : [];
  return <div id="ed-sections">
    {b.sections.length ? <ul className="tile-wall" data-tile-wall="">{b.sections.map((c, i) => <li key={c.section} className={i === 0 ? "tile-lg" : "tile-sm"}>
      <CropFigure crop={c} sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw" />
      <p className="ed-data mt-1"><Link to="/brands/$domain" params={{ domain: b.domain }} search={{ section: c.section }} hash="ed-sections" resetScroll={false} className="ed-tap" aria-current={open === c.section ? "true" : undefined}>History · {c.versions} {c.versions === 1 ? "version" : "versions"} →</Link></p>
    </li>)}</ul> : <div className="max-w-md"><CropFallback domain={b.domain} section={CROP_SECTION_NAME.hero} /><p className="ed-caption mt-2">{voiced("read.brandView.1")}</p></div>}
    {open && <div className="mt-10" role="region" aria-labelledby="ed-section-history">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4"><h4 id="ed-section-history" className="ed-h3">{CROP_SECTION_NAME[open]} history</h4><Link to="/brands/$domain" params={{ domain: b.domain }} search={{}} hash="ed-sections" resetScroll={false} className="ed-tap ed-data">Close</Link></div>
      <p className="ed-caption mt-1">Every stored version, newest first. A new version is kept only when the section looks different; up to 12 are kept.</p>
      {hist.length ? <ol className="tile-wall mt-4">{hist.map((c, i) => <li key={c.src} className={i === 0 ? "tile-lg" : "tile-sm"}><CropFigure crop={c} label={`${i === 0 ? "Latest" : `Version ${hist.length - i}`} · seen ${c.captured_at.slice(0, 10)}${c.last_seen_at.slice(0, 10) !== c.captured_at.slice(0, 10) ? ` to ${c.last_seen_at.slice(0, 10)}` : ""}`} /></li>)}</ol>
        : <div className="mt-4 max-w-md"><CropFallback domain={b.domain} section={CROP_SECTION_NAME[open]} /></div>}
    </div>}
  </div>;
}

/** One identity value: its label, the value, and the receipt it comes from. */
const Fact = ({ k, children, receipt }: { k: string; children: React.ReactNode; receipt: string }) => <div className="min-w-0">
  <dt className="ed-kicker">{k}</dt>
  <dd className="mt-1"><AppLink href={receipt} className="ed-tap no-underline hover:underline" title="Receipt: the stored capture in the terminal">{children}</AppLink></dd>
</div>;
function FaceValue({ f }: { f: Face | null }) {
  if (!f) return <span className="ed-small">Not measured</span>;
  const rest = faceLine(f).slice(f.family.length);
  return <span className="block break-words">
    <span className="ed-h3" style={f.css ? { fontFamily: f.css } : undefined} data-set-in={f.css ? "" : undefined}>{f.family}</span>
    {rest && <span className="ed-caption">{rest}</span>}
  </span>;
}

/** The card as drawn: I1 adds the brand's own icon and cover (absent on older callers, which draw as before). W3b · `art` is drawn only
 *  in the Data view (dataview/Views.tsx); the Read view never draws a museum line. */
type CardIn = BrandCard & { icon?: Pic | null; cover?: Cover | null; art?: ArtNear | null; accentArt?: import("@/lib/art/accent").AccentNear | null; tiles?: BrandPage["sections"] | null };
const NO_HISTORY = {} as BrandPage["history"];
function IdentityCard({ b }: { b: CardIn }) {
  const i = b.identity;
  return <Card as="section" aria-labelledby="ed-brand-title" className="p-5 md:p-8" data-identity-card="">
    <p className="ed-kicker">Brand · {b.sectorName}</p>
    <h1 id="ed-brand-title" className="ed-h1 brand-title mt-3 break-words"><BrandMark icon={b.icon} name={b.name} size={72} mobileSize={56} eager /><span className="min-w-0">{b.name}</span></h1>
    <p className="mt-2 max-sm:min-h-[2lh]"><a href={`https://${b.domain}`} target="_blank" rel="noopener" className="ed-code ed-tap" {...pr(`https://${b.domain}`)}>{b.domain}</a> <span className="ed-caption">· last captured {b.captured ? storyTime(b.captured) : "not yet"}</span></p>
    {b.cover && <div className="mt-5"><CoverFigure c={b.cover} /></div>}
    <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      <dl className="min-w-0 space-y-4"><Fact k="Headline type" receipt={i.receipt}><FaceValue f={i.h1} /></Fact><Fact k="Body type" receipt={i.receipt}><FaceValue f={i.body} /></Fact></dl>
      <dl className="min-w-0"><div><dt className="ed-kicker">Palette · share of the first screen</dt>
        <dd className="mt-2">{i.palette.length ? <ul className="space-y-1" aria-label={`${b.name} palette, largest first`}>{i.palette.map((p, k) => <li key={`${p.hex}${k}`}>
          <AppLink href={i.receipt} className="ed-tap flex items-center gap-2 no-underline hover:underline"><span className="ed-swatch inline-block h-6 w-6 shrink-0 border" style={{ background: p.hex }} aria-hidden="true" /><span className="ed-code">{p.hex}</span><span className="ed-data ml-auto">{p.share != null ? pct(p.share, 0) : "—"}</span></AppLink>
        </li>)}</ul> : <span className="ed-small">{voiced("read.brandView.2")}</span>}</dd></div></dl>
      <dl className="min-w-0"><div><dt className="ed-kicker">Voice and style</dt>
        <dd className="mt-2">{i.tags.length ? <ul className="flex flex-wrap gap-2" aria-label="Voice and style tags">{i.tags.map(t => <li key={t.key}><AppLink href={i.receipt} className="ed-tap ed-data inline-flex items-center gap-1 no-underline hover:underline">{t.name}<BasisWord b={t.basis} /></AppLink></li>)}</ul> : <span className="ed-small">{voiced("read.brandView.3")}</span>}</dd></div></dl>
      <dl className="min-w-0"><div><dt className="ed-kicker">Layout · measured</dt>
        <dd className="mt-2">{i.layout.length ? <ul className="space-y-1">{i.layout.map(f => <li key={f.id}><AppLink href={i.receipt} className="ed-tap flex items-baseline justify-between gap-3 no-underline hover:underline"><span className="ed-small">{f.label}</span><span className="ed-data">{f.value}</span></AppLink></li>)}</ul> : <span className="ed-small">{voiced("read.brandView.4")}</span>}</dd></div></dl>
    </div>
  </Card>;
}

function Moves({ b }: { b: Pick<BrandPage, "timeline" | "name"> }) {
  if (!b.timeline.length) return <p className="ed-small max-w-[60ch]">No change recorded on {b.name} yet. Every new capture is compared with the last; when two captures agree on a change, it lands here with the pictures either side.</p>;
  const open = openPairId(b.timeline);
  return <ol className="space-y-8" aria-label="Moves, newest first">{b.timeline.map(t => {
    const pics = t.compare ? <div className="max-w-[1064px]"><BeforeAfter before={t.compare.before} after={t.compare.after} /></div>
      : t.pair ? <div className="max-w-[1064px]" data-move-pair=""><FigureView fig={t.pair} view={{ figure: t.id, highlight: [], side: "after" }} live pair /></div> : null;
    return <li key={t.id} data-move={t.id}>
      <Ledger rows={[{ key: t.id, href: t.href, receipt: !t.story && t.id.startsWith("event:") ? `change:${t.id.slice(6)}` : undefined, title: <>{t.text}</>, tags: [t.rebrand ? "Confirmed rebrand" : t.kind, ...(t.seasonal ? [SEASONAL_LABEL] : []), ...(t.reversed ? [REVERSED_LABEL] : [])], facts: [<BasisWord key="b" b={t.basis} />, t.story ? "Story" : "Receipt"], time: <time dateTime={t.at}>{storyTime(t.at)}</time> }]} />
      {pics ? t.id === open ? <div className="mt-4" data-pair-open="">{pics}</div>
        : <details className="move-pics mt-2" data-pair-closed=""><summary className="ed-tap ed-data inline-flex min-h-11 cursor-pointer items-center">Show the two captures</summary><div className="mt-3">{pics}</div></details>
        : t.pairShared ? <p className="ed-caption mt-2">Same two captures as the move above.</p> : null}
      {t.folded && <details className="mt-2" data-flip-moves=""><summary className="ed-tap ed-data inline-flex min-h-11 cursor-pointer items-center">Show the {t.folded.length} single moves</summary>
        <Ledger className="mt-2" label="The single moves in this run" rows={t.folded.map(x => ({ key: x.id, href: x.href, title: <>{x.text}</>, tags: [x.kind], facts: [<BasisWord key="b" b={x.basis} />, x.story ? "Story" : "Receipt"], time: <time dateTime={x.at}>{storyTime(x.at)}</time> }))} /></details>}
    </li>; })}</ol>;
}

function Sector({ b }: { b: Pick<BrandPage, "domain" | "sectorName" | "field" | "contrast"> }) {
  const c = b.contrast, list = (xs: NonNullable<typeof c>["has"], has: boolean) => xs.length ? <ul className="space-y-2">{xs.map(x => <li key={x.key} className="ed-hair pt-2">
    <Link to="/signals/$key" params={{ key: x.key }} className="ed-small font-medium">{traitLabel(x.key).name}</Link>
    <p className="ed-data mt-1">{has ? "It shows it; " : "It doesn't; "}{pct(x.sector.v, 0)} of {x.sector.n} other {b.sectorName} brands do</p></li>)}</ul>
    : <p className="ed-small">{has ? `Nothing it shows is rare in ${b.sectorName}.` : `It shows everything most of ${b.sectorName} shows.`}</p>;
  return <>
    {b.field && b.field.points.length ? <div className="max-w-3xl"><FigureView fig={b.field} view={{ figure: "field", highlight: [b.domain], focus: null }} /></div>
      : <p className="ed-small">Not enough {b.sectorName} brands have both measures for a field yet.</p>}
    {c && <div className="ed-grid mt-8">
      <div className="lg:col-span-6"><h4 className="ed-kicker">It has, its sector mostly doesn't</h4><div className="mt-2">{list(c.has, true)}</div></div>
      <div className="lg:col-span-6"><h4 className="ed-kicker">Its sector mostly has, it doesn't</h4><div className="mt-2">{list(c.lacks, false)}</div></div>
    </div>}
  </>;
}

const SIMILAR_TITLE = "Similar brands";
function SimilarList({ similar }: { similar: SimilarResult }) {
  const icons = (similar as SimilarResult & { icons?: Record<string, Pic> }).icons ?? {};
  return similar.items.length > 0 ? <Ledger label="Similar brands" rows={similar.items.map((x, k) => ({ key: x.domain, href: x.href, number: k + 1, title: <MarkedName icon={icons[x.domain]}>{x.name}</MarkedName>, line: `Shares ${x.shared.map(s => traitLabel(s).name).join(", ")}`, facts: [`${Math.round(x.overlap * 100)}% overlap`], tags: [x.sameSector ? "Same sector" : sectorName(x.sector)] }))} /> : null;
}
/** The parts that may arrive after the card; BrandView passes them ready, BrandPageView passes deferred slots. */
type Parts = { surfaces?: ReactNode; moves: ReactNode; sections: ReactNode; sector: ReactNode; similarLine: ReactNode; similar: ReactNode; stories: ReactNode };
function BrandBody({ b, parts, bare = false }: { b: CardIn; parts: Parts; bare?: boolean }) {
  const page = <ObjectPage kind="brand" id="ed-brand" blocks={{
      headline: <>
        <IdentityCard b={b} />
        <div className="no-print mt-6 flex flex-wrap gap-4" data-brand-actions="">
          <Raised href={b.actions.watch}>Watch this brand</Raised>
          <Raised href={b.actions.compare}>Audit a page against it</Raised>
        </div>
        {b.lastMove && <p className="ed-standfirst mt-8 max-w-[62ch]">{b.lastMove.text}<span className="ed-caption mt-1 block">{storyTime(b.lastMove.at)}</span></p>}
        {parts.surfaces}
      </>,
      evidence: <>
        <BlockPart title="Moves" kicker="Every dated, measured change, newest first, with the two captures either side. Rebrands are confirmed by the rebrand desk.">
          {parts.moves}
        </BlockPart>
        <BlockPart title="Sections" kicker="Credited crops of the desktop homepage: hero, navigation, pricing, call to action and footer, each with its history.">{parts.sections}</BlockPart>
        <BlockPart title={`How it sits in ${b.sectorName}`} kicker="Every brand in its sector by headline size and white space, this brand marked, with the sector centre; then the headline signals that set it apart.">
          {parts.sector}
        </BlockPart>
        {b.versus && <BlockPart title={`Versus ${b.versus.scopeName}`} kicker="Signals this brand shows, read in its own sector's forecast (headline and supporting signals only).">
          <div className="ed-grid"><div className="lg:col-span-6"><h4 className="ed-kicker">Ahead · rising or emerging</h4><div className="mt-2"><Refs xs={b.versus.ahead} empty={voiced("read.brandView.5")} /></div></div>
            <div className="lg:col-span-6"><h4 className="ed-kicker">Behind · fading</h4><div className="mt-2"><Refs xs={b.versus.behind} empty="It uses no fading signals." /></div></div></div>
        </BlockPart>}
      </>,
      "so-what": <p className="ed-pull max-w-[44ch]">{b.soWhat}</p>,
      related: <>
        <BlockPart title={SIMILAR_TITLE} kicker={undefined}>{parts.similarLine}{parts.similar}</BlockPart>
        <BlockPart title="Stories about this brand">{parts.stories}</BlockPart>
        <BlockPart title="Signals it shows">
          {b.shows.length ? <ul className="ed-data flex flex-wrap gap-x-5 gap-y-2">{b.shows.map(s => <li key={s.key} className="flex items-center gap-1"><Link to="/signals/$key" params={{ key: s.key }} className="ed-tap">{s.name}</Link><StageWord stage={s.stage} />{s.tier === "headline" && <span className="ed-muted">headline</span>}</li>)}</ul> : <p className="ed-small">{voiced("read.brandView.7")}</p>}
        </BlockPart>
        <BlockPart title="More">
          <p className="ed-data flex flex-wrap gap-x-6">
            {b.actions.audit && <a href={b.actions.audit} className="ed-tap">Audit against its two most similar brands</a>}
            <AppLink href={b.actions.differentiate} className="ed-tap">Differentiate from this brand ⇄</AppLink>
            {b.actions.recommendType && <AppLink href={b.actions.recommendType} className="ed-tap">Recommend type for {b.sectorName} ⇄</AppLink>}
            <Receipt href={b.actions.terminal} className="ed-tap">Dense record in the terminal ⇄</Receipt>
          </p>
        </BlockPart>
      </>,
    }} />;
  if (bare) return page;
  return <BrandFrame name={b.name} domain={b.domain}>{page}</BrandFrame>;
}
/** E3b · the brand page's frame (bar, status line, footer), drawn from the brand's seeded name before any read. */
export function BrandFrame({ name, domain, children }: { name: string; domain: string; children: ReactNode }) {
  return <DigestShell label={`${name} brand`} section="brands" lens={false}>
    {children}
    <ReadFooter terminal={`/brands/${domain}?view=data`} />
  </DigestShell>;
}
const similarLine = (line: string) => <p className="ed-caption -mt-2 mb-3 max-w-[72ch]" data-similar-line="">{line}</p>;

/** The whole brand page from one model (tests, kit, share). */
export function BrandView({ b, section = null }: { b: BrandPage & { stories?: Story[] }; section?: string | null }) {
  const open = isCropSection(section) ? section : null;
  return <BrandBody b={b} parts={{ moves: <Moves b={b} />, sections: <Sections b={b} open={open} />, sector: <Sector b={b} />, similarLine: similarLine(b.similar.line), similar: <SimilarList similar={b.similar} />,
    stories: <RelatedStories stories={b.stories ?? []} empty={voiced("read.brandView.6")} /> }} />;
}

// P1 · shell first: the card arrives with the page; each section below fills its own slot as its read lands.
function MovesPart({ b }: { b: Pick<BrandCard, "domain" | "name"> }) { const { data } = useSuspenseQuery(brandMovesQuery(b.domain)); return <Moves b={{ name: b.name, timeline: data.timeline }} />; }
function SectionsPart({ b, open }: { b: Pick<BrandCard, "domain">; open: CropSection | null }) { const { data } = useSuspenseQuery(brandSectionsQuery(b.domain)); return <Sections b={{ domain: b.domain, ...data }} open={open} />; }
function SectorPart({ b }: { b: BrandCard }) { const { data } = useSuspenseQuery(brandSectorQuery(b.domain)); return <Sector b={{ domain: b.domain, sectorName: b.sectorName, ...data }} />; }
function SimilarPart({ b }: { b: Pick<BrandCard, "domain"> }) { const { data } = useSuspenseQuery(brandSimilarQuery(b.domain)); return <>{similarLine(data.line)}<SimilarList similar={data} /></>; }
function StoriesPart({ b }: { b: Pick<BrandCard, "domain"> }) { const { data } = useSuspenseQuery(brandStoriesQuery(b.domain)); return <RelatedStories stories={data} empty={voiced("read.brandView.6")} />; }
export function BrandPageView({ card, section = null, bare = false }: { card: CardIn; section?: string | null; bare?: boolean }) {
  const open = isCropSection(section) ? section : null;
  return <BrandBody b={card} bare={bare} parts={{
    surfaces: <Later id="ed-surfaces" shapes={[]}><SurfacesPart domain={card.domain} /></Later>,
    moves: <Later id="ed-moves" shapes={[{ kind: "rows", n: 3, height: ROW.ledger }, { kind: "picture", ratio: 2 * 1280 / 800, maxWidth: 1064 }, { kind: "rows", n: 3, height: ROW.ledger }]}><MovesPart b={card} /></Later>,
    // D1b · the strip from the card's own latest crops when they came with it (no late arrival); the section history still arrives late.
    sections: <Later shapes={[{ kind: "picture", ratio: 1280 / 800, maxWidth: 640 }, { kind: "text", lines: 1 }]}
      fallback={card.tiles?.length ? <Sections b={{ domain: card.domain, sections: card.tiles, history: NO_HISTORY }} open={null} /> : undefined}><SectionsPart b={card} open={open} /></Later>,
    sector: <Later shapes={[{ kind: "picture", ratio: 4 / 3, maxWidth: 768 }, { kind: "rows", n: 4, height: ROW.compact }]}><SectorPart b={card} /></Later>,
    similarLine: null,
    similar: <Later shapes={[{ kind: "text", lines: 1 }, { kind: "rows", n: 4, height: ROW.ledger }]}><SimilarPart b={card} /></Later>,
    stories: <Later shapes={[{ kind: "rows", n: 3, height: ROW.ledger }]}><StoriesPart b={card} /></Later>,
  }} />;
}
/** C1 · the brand page when its identity card failed twice: the brand's name, the one failed line in the card's place, and every part
 *  that does not need the card (moves, sections, similar brands, stories), each in its own slot. Never fewer words than that. */
export function BrandPageWithoutCard({ domain, name, line }: { domain: string; name: string; line: ReactNode }) {
  const b = { domain, name };
  return <ObjectPage kind="brand" id="ed-brand" blocks={{
    headline: <><h1 id="ed-brand-title" className="ed-cover break-words">{name}</h1><div className="mt-6" data-card-failed="">{line}</div></>,
    evidence: <>
      <BlockPart title="Moves" kicker="Every dated, measured change, newest first, with the two captures either side. Rebrands are confirmed by the rebrand desk.">
        <Later id="ed-moves" shapes={[{ kind: "rows", n: 3, height: ROW.ledger }]}><MovesPart b={b} /></Later>
      </BlockPart>
      <BlockPart title="Sections" kicker="Credited crops of the desktop homepage: hero, navigation, pricing, call to action and footer, each with its history."><Later shapes={[{ kind: "picture", ratio: 1280 / 800, maxWidth: 640 }]}><SectionsPart b={b} open={null} /></Later></BlockPart>
    </>,
    "so-what": null,
    related: <>
      <BlockPart title={SIMILAR_TITLE} kicker={undefined}><Later shapes={[{ kind: "rows", n: 4, height: ROW.ledger }]}><SimilarPart b={b} /></Later></BlockPart>
      <BlockPart title="Stories about this brand"><Later shapes={[{ kind: "rows", n: 3, height: ROW.ledger }]}><StoriesPart b={b} /></Later></BlockPart>
    </>,
  }} />;
}
