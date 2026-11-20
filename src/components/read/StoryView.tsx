import { line as voiced } from "@/lib/voice";
// STORY object page (/stories/<id>), Quiet density: a cover (an ink slab the full width, the headline in Display crossing ONE
// tilted object, number and date pinned left, sector and type pinned right, the deck on its own ink backing), then the off-centre
// column: Evidence, So what (the quote role), Related as a Ledger. The editor's edits are applied before this renders.
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { StoryPageModel } from "@/lib/stories/view";
import type { Thumb } from "@/lib/thumbs";
import type { Frame } from "@/lib/data-stories/types";
import { storyTime } from "@/lib/stories";
import { BasisWord, DigestShell, SiteCard, pr } from "@/components/digest/Editorial";
import { Ledger, StoryNo } from "@/components/brand/Ledger";
import { FiltersScope } from "@/components/brand/Illustration";
import { CaptureFrame } from "@/components/data/Figures";
import { ObjectPage, BlockPart } from "./ObjectPage";
import { ReadFooter } from "./Bits";
import { Receipt } from "./StoryCard";
import { BeforeAfter, CropFallback, CropFigure } from "./Evidence";
import { StoryCover, frameObject, type CoverObject } from "./Covers";
import type { StoryEvidence } from "@/lib/stories/evidence";
import { numberLabel } from "@/lib/stories/numbers";
import { FRAME_LABEL, compareKind } from "@/lib/stories/frames";
import { NO_CAPTURE_LINE } from "@/lib/crops";
import type { Pic } from "@/lib/pictures";
import { BrandMark } from "./BrandMark";

const kindOf = (s: StoryPageData) => compareKind({ crops: !!s.crops?.compare, crop: !!s.crops?.after, frames: !!s.frames, text: !!s.beforeAfter });

export type StoryPageData = StoryPageModel & { thumb: Thumb | null; icon?: Pic | null; crops?: StoryEvidence; frames?: { before: Frame; after: Frame } | null; series: { key: string; name: string; points: number[] } | null };
const day = (iso: string) => iso.slice(0, 10);

/** Longer headlines drop one step so a palette list can't fill the screen. */
const LONG_HEADLINE = 48;

/** The cover's one object, in the same order as the evidence: crops, the redrawn layout, the typographic pair, else the trail. */
export function coverObject(s: StoryPageData): CoverObject {
  const note = s.facts.find(f => /\d/.test(f.text) && f.text.length <= 48)?.text ?? `Captured ${day(s.at)}`;
  const kind = kindOf(s);
  if (kind === "crops") return { kind: "crop", crop: s.crops!.compare!.after, note };
  if (kind === "crop") return { kind: "crop", crop: s.crops!.after!, note };
  if (kind === "frames") return frameObject(s.frames!.after, note);
  if (kind === "text") return { kind: "text", before: s.beforeAfter!.before, after: s.beforeAfter!.after, note };
  if (s.series && s.series.points.length >= 2) return { kind: "trail", name: s.series.name, points: s.series.points.map((y, i) => ({ x: `Quarter ${i + 1}`, y })) };
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

export function StoryView({ s, related }: { s: StoryPageData; related?: ReactNode }) {
  const notRun = s.state === "held" ? `This story did not run on the front page: ${s.heldReason}.` : s.state === "killed" ? `Taken down by the editor${s.killReason ? `: ${s.killReason}` : ""}.` : null;
  const seed = s.number ?? s.id, kind = kindOf(s);
  return <DigestShell label={s.headline} section="live">
    <FiltersScope>
    <ObjectPage kind="story" id="ed-story" quiet blocks={{
      headline: <>
        <StoryCover seed={seed} headline={s.headline} long={s.headline.length > LONG_HEADLINE} deck={s.deck} object={coverObject(s)}
          kicker={<>{s.icon && <BrandMark icon={s.icon} size={24} eager className="mr-2" />}<span>{s.kicker}</span>{s.basis && <> <BasisWord b={s.basis} /></>}</>}
          left={<>{s.number != null && <Link to="/stories/no/$number" params={{ number: String(s.number) }} className="cover-num block no-underline hover:underline" title="Short link to this story by its number">{numberLabel(s.number)}</Link>}<time dateTime={s.at} className="block">{storyTime(s.at)}</time>{s.correctedAt && <span className="block">Corrected {day(s.correctedAt)}</span>}</>}
          right={<>{s.sectorName && <span className="block">{s.sectorName}</span>}<span className="block">{s.typeName}</span>{s.pinnedUntil && <span className="block">Pinned to the front page</span>}</>} />
        {notRun && <p className="ed-wrap ed-small mt-6 border-l-2 border-ed-ink pl-3" role="note">{notRun}</p>}
      </>,
      evidence: <>
        <Compare s={s} />
        {s.crops?.grid && <BlockPart title="The brands in this roundup · hero" kicker={s.crops.note ?? "Each brand's current hero, credited and linked."}>
          <ul className="grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-2">{s.crops.grid.map(g => <li key={g.domain}>
            {g.crop ? <CropFigure crop={g.crop} sizes="(min-width: 768px) 33vw, 100vw" /> : <CropFallback domain={g.domain} section="Hero" />}
            <p className="ed-data mt-1"><Link to="/brands/$domain" params={{ domain: g.domain }} className="ed-tap">Brand page →</Link></p>
          </li>)}</ul>
        </BlockPart>}
        {kind === "none" && s.crops?.note && !s.crops.grid && <p className="ed-caption">{s.crops.note}</p>}
        {kind === "none" && s.thumb && s.brands[0] && <BlockPart title="Latest capture"><div className="max-w-md"><SiteCard domain={s.brands[0].domain} name={null} sector={s.sectorName ?? ""} thumb={s.thumb} lines={["latest capture"]} /></div></BlockPart>}
        <BlockPart title="Facts" kicker="Every line links to its receipt.">
          {s.facts.length ? <ul className="ledger">{s.facts.map((f, i) => <li key={i} className="ledger-row flex flex-wrap items-baseline gap-x-3 px-2 py-3">
            <span className="ed-small">{f.href ? <Receipt href={f.href} {...pr(f.href)}>{f.text}</Receipt> : f.text}</span>{f.basis && <BasisWord b={f.basis} />}
          </li>)}</ul> : <p className="ed-small">{voiced("read.storyView.1")}</p>}
        </BlockPart>
        {s.series && s.series.points.length > 0 && <BlockPart title={`${s.series.name}: share by quarter`} kicker="Usable quarters only (15+ sites, 25% coverage), library-wide.">
          <p className="ed-data"><span className="ed-figure-num">{(s.series.points.at(-1)! * 100).toFixed(1)}%</span> <span>of tracked homepages, latest quarter</span> · <Link to="/signals/$key" params={{ key: s.series.key }} className="ed-tap">Full chart →</Link></p>
        </BlockPart>}
        {s.brands.length > 0 && <BlockPart title="Brands named">
          <ul className="flex flex-wrap gap-x-6 gap-y-1">{s.brands.map(b => <li key={b.domain}><Link to="/brands/$domain" params={{ domain: b.domain }} className="ed-tap ed-code">{b.domain}</Link></li>)}</ul>
        </BlockPart>}
      </>,
      // Reader pages carry no machinery: only an AI line that says something about the story (reader.ts) gets the block.
      "so-what": s.soWhat ? <>
        <p className="ed-pull max-w-[44ch]">{s.soWhat.text}</p>
        <p className="ed-data mt-3 flex flex-wrap items-center gap-2"><BasisWord b={s.soWhat.basis} /></p>
      </> : null,
      related: related ?? <StoryRelated s={s} />,
    }} />
    </FiltersScope>
    <ReadFooter terminal={`/terminal?panel=today&story=${encodeURIComponent(s.id)}`} />
  </DigestShell>;
}

/** Related: signals and patterns, receipts, earlier stories and the editor's log (P1: streamed after the story on its page). */
export function StoryRelated({ s }: { s: Pick<StoryPageData, "signals" | "patterns" | "evidence" | "earlier" | "edits"> }) {
  return <>
        {(s.signals.length > 0 || s.patterns.length > 0) && <BlockPart title="Signals and patterns">
          <Ledger small label="Signals and patterns in this story" rows={[...s.signals.map(x => ({ key: `s:${x.key}`, href: x.href, title: x.name, facts: [x.dimension], tags: ["Signal"] })), ...s.patterns.map(p => ({ key: `p:${p.key}`, href: p.href, title: `${p.name} examples`, tags: ["Pattern"] }))]} />
        </BlockPart>}
        {s.evidence.length > 0 && <BlockPart title="Receipts"><Ledger small label="Receipts" rows={s.evidence.map(e => ({ key: e.href, href: e.href, title: `${e.label}${e.href.startsWith("/") ? " →" : " ↗"}` }))} /></BlockPart>}
        <BlockPart title="Earlier stories on the same signal or brand">
          {s.earlier.length ? <Ledger label="Earlier stories" rows={s.earlier.map(x => ({ key: x.id, href: `/stories/${encodeURIComponent(x.id)}`, number: x.number != null ? <StoryNo n={x.number} /> : "·", title: x.headline, line: x.deck, tags: [x.kicker.split(" · ")[0] ?? x.kicker], time: <time dateTime={x.at}>{storyTime(x.at)}</time> }))} />
            : <p className="ed-small">{voiced("read.storyView.2")}</p>}
        </BlockPart>
        {s.edits.length > 0 && <BlockPart title="Editor's log"><ol className="ed-data space-y-1">{s.edits.map((e, i) => <li key={i}><time dateTime={e.at}>{day(e.at)}</time> · {e.action}{e.note ? ` · ${e.note}` : ""}</li>)}</ol></BlockPart>}
  </>;
}
