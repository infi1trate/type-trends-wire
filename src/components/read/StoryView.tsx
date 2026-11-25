import { quarterText } from "@/lib/labels";
import { dataHref } from "@/lib/ia";
import { line as voiced } from "@/lib/voice";
// STORY object page (/stories/<id>), Quiet density: a cover (an ink slab the full width, the headline in Display crossing ONE
// tilted object, number and date pinned left, sector and type pinned right, the deck on its own ink backing), then the off-centre
// column: Evidence, So what (the quote role), Related as a Ledger. The editor's edits are applied before this renders.
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { StoryPageModel } from "@/lib/stories/view";
import { CENSUS_NEW_MARK } from "@/lib/stories/view";
import type { Thumb } from "@/lib/thumbs";
import type { Frame } from "@/lib/data-stories/types";
import { storyTime } from "@/lib/stories";
import { DigestShell, SiteCard, pr } from "@/components/digest/Editorial";
import { Ledger, StoryNo } from "@/components/brand/Ledger";
import { FiltersScope } from "@/components/brand/Illustration";
import { ReceiptContext } from "@/components/receipts/open";
import { CaptureFrame } from "@/components/data/Figures";
import { ObjectPage, BlockPart } from "./ObjectPage";
import { ReadFooter } from "./Bits";
import { Receipt } from "./StoryCard";
import { BeforeAfter, CropFallback, CropFigure } from "./Evidence";
import type { Story } from "@/lib/stories";
import { StoryCover, frameObject, type CoverObject } from "./Covers";
import type { StoryEvidence } from "@/lib/stories/evidence";
import { numberLabel } from "@/lib/stories/numbers";
import { FRAME_LABEL, compareKind } from "@/lib/stories/frames";
import { NO_CAPTURE_LINE } from "@/lib/crops";
import type { Pic } from "@/lib/pictures";
import { BrandMark } from "./BrandMark";
import { LeadPicture } from "./LeadPicture";
import type { LeadPlan } from "@/lib/lead-picture";

const kindOf = (s: StoryPageData) => compareKind({ crops: !!s.crops?.compare, crop: !!s.crops?.after, frames: !!s.frames, text: !!s.beforeAfter });

export type StoryPageData = StoryPageModel & { thumb: Thumb | null; icon?: Pic | null; crops?: StoryEvidence; frames?: { before: Frame; after: Frame } | null; series: { key: string; name: string; points: number[] } | null; eventIds?: number[]; lead?: LeadPlan | null };
const day = (iso: string) => iso.slice(0, 10);

/** Longer headlines drop one step so a palette list can't fill the screen. */
const LONG_HEADLINE = 48;

/** The cover's one object, in the same order as the evidence: crops, the redrawn layout, the typographic pair, else the trail. */
/** U1 · a story's written body is set exactly as a study's opening paragraph and the Digest's argument (ed-body, 68ch). */
const BODY_MEASURE = { maxWidth: "68ch" } as const;
export function coverObject(s: StoryPageData): CoverObject {
  const note = s.facts.find(f => /\d/.test(f.text) && f.text.length <= 48)?.text ?? `Captured ${day(s.at)}`;
  const kind = kindOf(s);
  if (kind === "crops") return { kind: "crop", crop: s.crops!.compare!.after, note };
  if (kind === "crop") return { kind: "crop", crop: s.crops!.after!, note };
  if (kind === "frames") return frameObject(s.frames!.after, note);
  if (kind === "text") return { kind: "text", before: s.beforeAfter!.before, after: s.beforeAfter!.after, note };
  if (s.series && s.series.points.length >= 2) return { kind: "trail", name: s.series.name, points: s.series.points.map((y, i) => ({ x: quarterText(("quarters" in s.series! ? (s.series as { quarters?: string[] }).quarters?.[i] : undefined) ?? "") || `${i + 1}`, y })) };
  return null;
}

function Compare({ s }: { s: StoryPageData }) {
  const kind = kindOf(s);
  if (kind === "crops") return <BlockPart title={`Before → after · ${s.crops!.sectionName}`} kicker={s.beforeAfter ? `Before: ${s.beforeAfter.before}. After: ${s.beforeAfter.after}. Two stored captures of this section, either side of the change.` : "Two stored captures of this section, either side of the change."}>
    <BeforeAfter before={s.crops!.compare!.before} after={s.crops!.compare!.after} />
  </BlockPart>;
  if (kind === "crop") return <BlockPart title={`After · ${s.crops!.sectionName}`} kicker={s.beforeAfter ? `Before: ${s.beforeAfter.before}. After: ${s.beforeAfter.after}.` : undefined}>
    <div className="max-w-[640px]" data-story-after=""><CropFigure crop={s.crops!.after!} label={`After · ${day(s.crops!.after!.captured_at)}`} sizes="(min-width: 768px) 640px, 100vw" /></div>
  </BlockPart>;
  if (kind === "frames") return <BlockPart title="Before → after" kicker={FRAME_LABEL}>
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2" data-story-frames="">{(["before", "after"] as const).map(k => <figure key={k} className="min-w-0">
      <p className="ed-kicker mb-2">{k === "before" ? "Before" : "After"} · {day(s.frames![k].at)}{s.beforeAfter ? ` · ${s.beforeAfter[k]}` : ""}</p>
      <CaptureFrame fr={s.frames![k]} label={`${s.brands[0]?.domain ?? "The brand"}, ${k}, ${day(s.frames![k].at)}`} />
      <figcaption className="ed-caption mt-1">{FRAME_LABEL} · {s.frames![k].source === "live" ? "live crawl" : "Wayback archive"}</figcaption>
    </figure>)}</div>
    <p className="ed-caption mt-3" data-no-capture="">{NO_CAPTURE_LINE}</p>
  </BlockPart>;
  if (kind === "text") return <BlockPart title="Before → after" kicker="Two captures agree on the change; no stored layout to redraw, so the change is set in type.">
    <div className="ed-grid">
      <div className="lg:col-span-6 ed-typo" data-text-compare=""><span className="ed-kicker ed-muted">Before</span><span className="ed-h3 break-words">{s.beforeAfter!.before}</span></div>
      <div className="lg:col-span-6 ed-typo"><span className="ed-kicker ed-muted">After</span><span className="ed-h3 break-words">{s.beforeAfter!.after}</span></div>
    </div>
    {s.crops?.note && !s.crops.grid && <p className="ed-caption mt-3">{s.crops.note}</p>}
  </BlockPart>;
  return null;
}

/** 4 · The picture: real pictures before wireframes. Before and after first-screen crops side by side (stacked on narrow screens), each
 *  with its date; one crop when only one exists; up to four hero crops in a row for a gathered story. Credit, link and "Report this
 *  image" stay on every crop (CropFigure). */
/** I3 · picture kinds of a lead plan that fill this slot (a chart lead stays in the cover's trail; none and marks leave the old chain). */
const PICTURE_KINDS = new Set(["pair", "single", "mosaic", "words", "swatches", "card"]);
const withoutCrops = (s: StoryPageData): StoryPageData => { const { crops: _c, ...rest } = s; return rest; };
const pictureLead = (s: StoryPageData) => (s.lead && PICTURE_KINDS.has(s.lead.kind) ? s.lead : null);
function Picture({ s }: { s: StoryPageData }) {
  const kind = kindOf(s), lead = pictureLead(s);
  if (lead) return <div className="ed-wrap mt-10 md:mt-14" data-story-picture={lead.kind}><LeadPicture plan={lead} /></div>;
  if (s.lead) {
    // The plan found no real picture that passes the lead-quality rule: a redrawn layout or the type pair may stand in, else the marks.
    if (kind === "frames" || kind === "text") return <div className="ed-wrap mt-10 md:mt-14" data-story-picture="drawn"><Compare s={s} /></div>;
    if (s.lead.kind === "marks" && s.brands.length > 1) return <div className="ed-wrap mt-10 md:mt-14" data-story-picture="marks"><LeadPicture plan={s.lead} /></div>;
    return null;
  }
  if (kind === "crops") return <figure className="ed-wrap mt-10 md:mt-14" data-story-picture="pair">
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <CropFigure crop={s.crops!.compare!.before} label={`Before · ${day(s.crops!.compare!.before.captured_at)}`} sizes="(min-width: 768px) 50vw, 100vw" priority />
      <CropFigure crop={s.crops!.compare!.after} label={`After · ${day(s.crops!.compare!.after.captured_at)}`} sizes="(min-width: 768px) 50vw, 100vw" priority />
    </div>
  </figure>;
  if (kind === "crop") return <figure className="ed-wrap mt-10 md:mt-14 max-w-[720px]" data-story-picture="one"><CropFigure crop={s.crops!.after!} label={`${s.crops!.sectionName} · ${day(s.crops!.after!.captured_at)}`} sizes="(min-width: 768px) 720px, 100vw" priority /></figure>;
  if (s.crops?.grid?.length) return <figure className="ed-wrap mt-10 md:mt-14" data-story-picture="grid">
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">{s.crops.grid.slice(0, 4).map(g => <li key={g.domain} className="min-w-0">
      {g.crop ? <CropFigure crop={g.crop} sizes="(min-width: 768px) 25vw, 50vw" /> : <CropFallback domain={g.domain} section="Hero" />}
    </li>)}</ul>
  </figure>;
  if (kind === "frames" || kind === "text") return <div className="ed-wrap mt-10 md:mt-14" data-story-picture="drawn"><Compare s={s} /></div>;
  if (s.thumb && s.brands[0]) return <div className="ed-wrap mt-10 max-w-md md:mt-14" data-story-picture="latest"><SiteCard domain={s.brands[0].domain} name={s.brands[0].name} sector={s.sectorName ?? ""} thumb={s.thumb} lines={["latest capture"]} /></div>;
  return null;
}

/** E3b · the story page's frame (bar, status line, footer), drawn from the story's head before its body is read. */
export function StoryFrame({ id, headline, children }: { id: string; headline: string; children: ReactNode }) {
  return <DigestShell label={headline} section="live">
    {children}
    <ReadFooter terminal={dataHref({ type: "story", id })} />
  </DigestShell>;
}
export function StoryView({ s, related, bare = false }: { s: StoryPageData; related?: ReactNode; bare?: boolean }) {
  // N2 · a story waiting for the desks' review, and one a desk held (with its reason), each say so in one line.
  const notRun = s.state === "held" ? (s.heldReason?.startsWith("awaiting review") ? "This story is waiting for the desk's review." : s.heldByDesk ? `Held by the desk: ${s.heldReason?.replace(/[.\s]+$/, "")}.` : `This story did not run on the front page: ${s.heldReason}.`) : s.state === "killed" ? `Taken down by the editor${s.killReason ? `: ${s.killReason}` : ""}.` : null;
  const seed = s.number ?? s.id, kind = kindOf(s);
  // The cover carries kicker, headline and deck; its object is the signal's trail only when the story has no picture of a page.
  const cover = s.lead
    ? (pictureLead(s) || kind === "frames" || kind === "text" ? null : coverObject(withoutCrops(s)))
    : kind === "none" && !s.crops?.grid?.length && !s.thumb ? coverObject(s) : null;
  const body = <ReceiptContext.Provider value={{ story: { id: s.id, census: !!s.census, eventIds: s.eventIds ?? [] } }}><FiltersScope>
    <ObjectPage kind="story" id="ed-story" quiet blocks={{
      headline: <>
        <StoryCover seed={seed} headline={s.headline} long={s.headline.length > LONG_HEADLINE} deck={s.deck} object={cover} italicDeck
          kicker={<>{s.brands.length === 1 && <BrandMark icon={s.icon} name={s.brands[0]?.name ?? ""} size={32} eager className="mr-2" />}<span>{s.kicker}</span></>}
          left={<>{s.number != null && <Link to="/stories/no/$number" params={{ number: String(s.number) }} className="cover-num block no-underline hover:underline" title="Short link to this story by its number">{numberLabel(s.number)}</Link>}<time dateTime={s.at} className="block">{storyTime(s.at)}</time>{s.correctedAt && <span className="block">Updated {day(s.correctedAt)}</span>}</>}
          right={<>{s.pinnedUntil && <span className="block">Pinned to the front page</span>}</>} />
        {notRun && <p className="ed-wrap ed-small mt-6 border-l-2 border-ed-ink pl-3" role="note">{notRun}</p>}
        {s.corrections?.map((c, i) => <p key={i} className="ed-wrap ed-small mt-6 border-l-2 border-ed-ink pl-3" role="note" data-correction="">{c}</p>)}
        <Picture s={s} />
      </>,
      evidence: <>
        {s.body.length > 0 && <div className="my-10 space-y-5 md:my-14" data-story-body="">{s.body.map((p, i) => <p key={i} className="ed-body" style={BODY_MEASURE}>{p}</p>)}</div>}
        <p className="ed-small max-w-[62ch]" data-how-we-know=""><span className="ed-kicker mr-2">How we know</span>{s.howWeKnow}</p>
        {s.census && <BlockPart title="The lines" kicker={s.census.sectors ? `By sector: ${s.census.sectors}.` : undefined}>
          <ul className="ledger" data-story-lines="">{s.census.lines.map((l, i) => <li key={i} className="ledger-row flex flex-col gap-1 px-2 py-3 md:flex-row md:items-baseline md:gap-4">
            {l.href ? <Link to="/brands/$domain" params={{ domain: decodeURIComponent(l.href.replace(/^\/brands\//, "")) }} className="ed-tap ed-kicker inline-flex min-h-11 shrink-0 items-center md:w-40"><BrandMark icon={null} name={l.name} size={32} className="mr-2" />{l.name}</Link> : <span className="ed-kicker shrink-0 md:w-40">{l.name}</span>}
            <span className="ed-small min-w-0 break-words">{l.line}{l.isNew && <span className="ed-kicker ml-2 whitespace-nowrap" data-census-new="">{CENSUS_NEW_MARK}</span>}</span>
          </li>)}</ul>
        </BlockPart>}
        {/* W1d · a story with nothing to list leaves the section out; it never prints an empty line. */}
        {s.facts.length > 0 && <BlockPart title={s.facts.some(f => f.kind === "member") ? "The changes" : s.facts.some(f => f.kind === "before" || f.kind === "after") ? "The change" : "The numbers"} kicker="Each line links to its receipt.">
          <ul className="ledger" data-story-changes="">{s.facts.map((f, i) => <li key={i} className="ledger-row px-2 py-3">
            <span className="ed-small">{f.href ? <Receipt href={f.href} drawer {...pr(f.href)}>{f.text}</Receipt> : f.text}{f.asOf && <span data-as-of="">{` · ${f.asOf}`}</span>}</span>
          </li>)}</ul>
          {s.numbersUpdate && <p className="ed-small mt-3 px-2" data-numbers-update="">{s.numbersUpdate}</p>}
        </BlockPart>}
      </>,
      "so-what": null,
      related: related ?? <StoryRelated s={s} />,
    }} />
    </FiltersScope></ReceiptContext.Provider>;
  return bare ? body : <StoryFrame id={s.id} headline={s.headline}>{body}</StoryFrame>;
}

/** E2d · a retired story keeps its page: number and date, the headline it ran under, "Retired" with the editor's note, the brand page and
 *  the tape lines it was built from. No body, no picture, no "Next". */
export function RetiredStoryView({ s, tape, note, bare = false }: { s: Pick<StoryPageData, "id" | "number" | "at" | "headline" | "kicker" | "brands">; tape: { id: number; text: string; href: string; confirmed?: boolean }[]; note: string | null; bare?: boolean }) {
  const body = <article className="ed-wrap py-10 md:py-16" data-story-retired="">
      <p className="ed-data flex flex-wrap gap-x-4 gap-y-1">
        {s.number != null && <span>{numberLabel(s.number)}</span>}
        <time dateTime={s.at} className="whitespace-nowrap">{storyTime(s.at)}</time>
        <span>{s.kicker}</span>
      </p>
      <h1 className="ed-h1 mt-4 max-w-[24ch] break-words">{s.headline}</h1>
      <p className="ed-small mt-6 max-w-[62ch] border-l-2 border-ed-ink pl-3" role="note" data-retired-note=""><span className="ed-kicker mr-2">Retired</span>{note ? note.replace(/^Retired:\s*/, "").replace(/^./, c => c.toUpperCase()) : "Taken down by the editor."}</p>
      {s.brands.length > 0 && <p className="ed-data mt-10 flex flex-wrap items-baseline gap-x-5 gap-y-1"><span className="ed-kicker">{s.brands.length === 1 ? "The brand" : "The brands"}</span>{s.brands.map(b => <Link key={b.domain} to="/brands/$domain" params={{ domain: b.domain }} className="ed-tap inline-flex min-h-11 items-center"><BrandMark icon={null} name={b.name} size={32} className="mr-2" />{b.name} →</Link>)}</p>}
      {tape.length > 0 && <BlockPart title="The changes it was built from" kicker={tape.every(t => t.confirmed !== false) ? "They stay on the tape." : "A change marked Seen once, Alternating or Not compared is not on the tape; the rest stay there."}>
        <ul className="ledger" data-retired-tape="">{tape.map(t => <li key={t.id} className="ledger-row px-2 py-3"><span className="ed-small break-words"><Receipt href={t.href} receipt={`change:${t.id}`} {...pr(t.href)}>{t.text}</Receipt></span></li>)}</ul>
      </BlockPart>}
    </article>;
  return bare ? body : <StoryFrame id={s.id} headline={s.headline}>{body}</StoryFrame>;
}

export type StoryWayOn = { next?: Story | null; study?: { href: string; title: string } | null };
/** 8 · A way on: Next (the next story of the day by rank, else the newest earlier one), the study that covers the signal, the brands by
 *  name. Then signals and patterns, earlier stories and the editor's log (P1: streamed after the story on its page). */
export function StoryRelated({ s }: { s: Pick<StoryPageData, "signals" | "patterns" | "evidence" | "earlier" | "edits" | "brands"> & StoryWayOn }) {
  return <>
        {(s.next || s.study || s.brands.length > 0) && <nav aria-label="A way on" className="ed-data flex flex-col gap-3" data-story-way-on="">
          {s.next && <p><span className="ed-kicker mr-2">Next</span><Link to="/stories/$id" params={{ id: s.next.id }} className="ed-tap">{s.next.headline} →</Link></p>}
          {s.study && <p><span className="ed-kicker mr-2">Part of the study</span><Receipt href={s.study.href} className="ed-tap">{s.study.title} →</Receipt></p>}
          {s.brands.length > 0 && <p className="flex flex-wrap items-baseline gap-x-5 gap-y-1"><span className="ed-kicker">{s.brands.length === 1 ? "The brand" : "The brands"}</span>{s.brands.map(b => <Link key={b.domain} to="/brands/$domain" params={{ domain: b.domain }} className="ed-tap"><BrandMark icon={null} name={b.name} size={32} className="mr-2" />{b.name}</Link>)}</p>}
        </nav>}
        {(s.signals.length > 0 || s.patterns.length > 0) && <BlockPart title="Signals and patterns">
          <Ledger small label="Signals and patterns in this story" rows={[...s.signals.map(x => ({ key: `s:${x.key}`, href: x.href, title: x.name, facts: [x.dimension], tags: ["Signal"] })), ...s.patterns.map(p => ({ key: `p:${p.key}`, href: p.href, title: `${p.name} examples`, tags: ["Pattern"] }))]} />
        </BlockPart>}
        <BlockPart title="Earlier stories on the same signal or brand">
          {s.earlier.length ? <Ledger label="Earlier stories" rows={s.earlier.map(x => ({ key: x.id, href: `/stories/${encodeURIComponent(x.id)}`, number: x.number != null ? <StoryNo n={x.number} /> : "·", title: x.headline, line: x.deck, tags: [x.kicker.split(" · ")[0] ?? x.kicker], time: <time dateTime={x.at}>{storyTime(x.at)}</time> }))} />
            : <p className="ed-small">{voiced("read.storyView.2")}</p>}
        </BlockPart>
        {s.edits.length > 0 && <BlockPart title="Editor's log"><ol className="ed-data space-y-1">{s.edits.map((e, i) => <li key={i}><time dateTime={e.at}>{day(e.at)}</time> · {e.action}{e.note ? ` · ${e.note}` : ""}</li>)}</ol></BlockPart>}
  </>;
}
