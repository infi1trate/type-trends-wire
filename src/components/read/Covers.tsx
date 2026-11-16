// Covers (brand/README.md, "Layout moves"): one object in the middle, tilted and bleeding off one edge, captions pinned to the
// left and right edges at mid-height, reading text never on a picture. Each cover carries at most one illustration, so it is the
// one filtered picture in its viewport. Pictures come only from stored data: a crop printed in one ink (<Treated>), a capture
// redrawn from its stored layout, the stored series as a trail, or a number as a soft object.
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { Frame } from "@/lib/data-stories/types";
import type { Crop } from "@/lib/crops";
import type { LeadFigure as LeadFigureModel } from "@/lib/front/front";
import { FRAME_LABEL } from "@/lib/stories/frames";
import { CutAndPaste, HeadlineStrips, SoftObject, Trail } from "@/components/brand/Illustration";
import { Sticker } from "@/components/brand/Containers";
import { CaptureFrame } from "@/components/data/Figures";
import { Count } from "@/components/brand/Motion";
import { Treated } from "./Treated";

const pctFmt = (v: number) => `${(v * 100).toFixed(1)}%`;

/** The lead plate's evidence slot: the number in Figure type with unit and date, the trail at the slot's full height ending in a
 * gumball, the coverage caption pinned to the bottom. With no series, the number alone, bottom-aligned. */
export function LeadFigureSlot({ f }: { f: LeadFigureModel }) {
  return <figure className="lead-fig flex h-full min-h-[18rem] flex-col" data-evidence="" data-lead-figure={f.trail ? "trail" : "number"}>
    <p className="ed-kicker">{f.name}</p>
    <div className={`flex flex-1 flex-col ${f.trail ? "" : "justify-end"}`}>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-3"><span className="ed-figure-num"><Count text={f.value} /></span><span className="ed-data">{f.unit}{f.date ? ` · ${f.date}` : ""}</span></p>
      {f.trail && <div className="lead-trail relative mt-2 min-h-[10rem] flex-1"><Trail points={f.trail} label={`${f.name}: share of tracked homepages by quarter`} format={pctFmt} w={520} h={300} sticker={false} className="absolute inset-0" seed={f.key} /></div>}
    </div>
    <figcaption className="ed-caption mt-3">{f.caption} <Link to="/signals/$key" params={{ key: f.key }} className="ed-tap">Full chart →</Link></figcaption>
  </figure>;
}

// ——— STORY COVER ———————————————————————————————————————————————————————————————————————————————————
export type CoverObject =
  | { kind: "crop"; crop: Crop; note: string | null }
  | { kind: "frame"; frame: Frame; label: string; note: string | null }
  | { kind: "text"; before: string; after: string; note: string | null }
  | { kind: "trail"; name: string; points: { x: string; y: number }[] }
  | null;
/** The story cover: an ink slab the full width; the headline in Display crossing the one object; number and date pinned left,
 * sector and type pinned right at mid-height; the deck on its own ink backing. */
export function StoryCover({ seed, headline, long, deck, left, right, object, kicker }: { seed: number | string; headline: string; long: boolean; deck: string | null | undefined; left: ReactNode; right: ReactNode; object: CoverObject; kicker: ReactNode }) {
  const picture = object?.kind === "crop" ? <Treated crop={object.crop} treatment="print-ink" />
    : object?.kind === "frame" ? <CaptureFrame fr={object.frame} label={object.label} />
    : object?.kind === "text" ? <div className="ed-typo cover-typo" role="img" aria-label={`Before: ${object.before}. After: ${object.after}.`}><span className="ed-kicker">Before</span><span className="ed-h3 break-words">{object.before}</span><span className="ed-kicker">After</span><span className="ed-h3 break-words">{object.after}</span></div>
    : null;
  return <header className="cover c-slab" data-container="slab" data-cover="story">
    <div className="ed-wrap cover-grid" data-has-object={object ? "" : undefined}>
      <p className="cover-kicker ed-kicker">{kicker}</p>
      <p className="cover-pin cover-pin-l ed-data" data-pin="left">{left}</p>
      <p className="cover-pin cover-pin-r ed-data" data-pin="right">{right}</p>
      {object && <div className="cover-object">
        {object.kind === "trail" ? <div className="cover-trail"><Trail points={object.points} label={`${object.name}: share of tracked homepages by quarter`} format={pctFmt} w={760} h={420} seed={seed} /></div>
          : <CutAndPaste seed={seed} picture={picture} note={object.note} />}
      </div>}
      <h1 id="ed-story-title" className={`cover-head ${long ? "ed-h1" : "ed-cover"} break-words`}><HeadlineStrips text={headline} seed={seed} /></h1>
      {deck && <p className="cover-deck ed-standfirst"><span>{deck}</span></p>}
    </div>
  </header>;
}
export const frameObject = (frame: Frame, note: string | null): CoverObject => ({ kind: "frame", frame, label: FRAME_LABEL, note });

// ——— EDITION COVER (Digest issue, Morning Line, sector report) ————————————————————————————————————————
/** A cover on a two-ink print: ONE soft object in the middle (the issue number or the day's key figure), the title in Display,
 * captions pinned left and right, an optional yellow "New" sticker. The figure is also set in type in the left caption. */
export function EditionCover({ seed, object, objectLabel, kicker, title, titleId, left, right, isNew, deck, ink = "pink", children }: { seed: number | string; object: string; objectLabel: string; kicker: ReactNode; title: ReactNode; titleId: string; left: ReactNode; right: ReactNode; isNew?: boolean; deck?: ReactNode; ink?: "pink" | "green" | "yellow"; children?: ReactNode }) {
  return <header className="ed-cover-sheet" data-cover="edition" data-block="headline">
    <div className="ed-wrap ecover-grid">
      <p className="cover-kicker ed-kicker">{kicker}</p>
      <p className="cover-pin cover-pin-l ed-data" data-pin="left">{left}</p>
      <p className="cover-pin cover-pin-r ed-data" data-pin="right">{right}</p>
      <div className="ecover-object no-print"><SoftObject text={object} seed={seed} ink={ink} print={ink === "pink" ? "yellow" : "pink"} label={objectLabel} />{isNew && <Sticker className="ecover-new" data-pop="">New</Sticker>}</div>
      <h1 id={titleId} className="ecover-title ed-cover break-words">{title}</h1>
      {deck && <div className="ecover-deck">{deck}</div>}
      {children}
    </div>
  </header>;
}
