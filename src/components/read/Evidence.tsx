// Evidence components for Read mode: a credited section crop, a before/after pair, and the honest fallback card. Reused on brand,
// story and pattern pages. Every image carries its credit (section, domain, capture date), a live-site link and "Report this image".
import { useState } from "react";
import { NO_CAPTURE_TEXT, type Crop } from "@/lib/crops";
import { coverBox, longDay as longDayOf, type Cover } from "@/lib/pictures";
import { pr } from "@/components/digest/Editorial";

const day = (iso: string) => iso.slice(0, 10);

/** The crop at its natural ratio (width/height set, lazy), captioned and linked. */
/** `priority`: the page's first-screen picture (a cover) loads at once with high priority; every other crop waits until near view. */
export function CropFigure({ crop, label, sizes = "(min-width: 1024px) 33vw, 100vw", priority = false }: { crop: Crop; label?: string | undefined; sizes?: string; priority?: boolean }) {
  return <figure className="min-w-0" data-crop={crop.section}>
    {label && <p className="ed-kicker mb-2">{label}</p>}
    <a href={crop.live} target="_blank" rel="noopener" aria-label={`Open ${crop.domain} (live site)`} {...pr(crop.live)}>
      <img src={crop.src} width={crop.width} height={crop.height} sizes={sizes} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding="async" alt={crop.alt} className="ed-thumb" />
    </a>
    <figcaption className="ed-caption mt-1">
      <span className="block">{crop.sectionName} · {crop.domain} · captured <time dateTime={crop.captured_at}>{day(crop.captured_at)}</time></span>
      <span className="flex flex-wrap gap-x-4">
        <a href={crop.live} target="_blank" rel="noopener" className="ed-tap" {...pr(crop.live)}>Live site ↗</a>
        <a href={crop.report} className="ed-tap">Report this image</a>
      </span>
    </figcaption>
  </figure>;
}

/** No crop: the typographic card with one honest line. */
export function CropFallback({ domain, section, detail }: { domain: string; section: string; detail?: string | undefined }) {
  return <div className="ed-typo" role="img" aria-label={`${domain}, ${section}: ${NO_CAPTURE_TEXT}`} data-crop-fallback="">
    <span className="ed-kicker ed-muted">{section}</span>
    <span className="ed-h3 break-words">{domain}</span>
    <span className="ed-caption">{NO_CAPTURE_TEXT}{detail ? ` · ${detail}` : ""}</span>
  </div>;
}

/**
 * Two versions of one section: side by side from 768 px, one at a time on phones with a button to flip between them.
 * No drag, no animation; the button is a real button (keyboard reachable, aria-pressed).
 */
export function BeforeAfter({ before, after, sizes = "(min-width: 768px) 50vw, 100vw" }: { before: Crop; after: Crop; sizes?: string }) {
  const [show, setShow] = useState<"before" | "after">("after");
  const other = show === "after" ? "before" : "after";
  return <div data-before-after="">
    <p className="ed-data mb-3 flex flex-wrap items-center gap-x-3 md:hidden">
      <button type="button" aria-pressed={show === "before"} onClick={() => setShow(other)} className="ed-tap cursor-pointer underline">Show {other} ({day(other === "before" ? before.captured_at : after.captured_at)})</button>
      <span className="ed-caption" aria-live="polite">Showing {show}</span>
    </p>
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className={show === "before" ? "" : "max-md:hidden"}><CropFigure crop={before} label={`Before · ${day(before.captured_at)}`} sizes={sizes} /></div>
      <div className={show === "after" ? "" : "max-md:hidden"}><CropFigure crop={after} label={`After · ${day(after.captured_at)}`} sizes={sizes} /></div>
    </div>
  </div>;
}

/** The brand page cover (I1): the brand's latest social card, else its latest hero crop. The first-screen picture (eager, high
 * priority); its box is reserved from the stored size, never upscaled, and capped in height. Credited, linked, reportable. */
export const COVER_CAP_REM = 16;
export function CoverFigure({ c }: { c: Cover }) {
  return <figure className="min-w-0" data-brand-cover={c.kind}>
    <a href={c.live} target="_blank" rel="noopener" aria-label={`Open ${c.domain} (live site)`} className="brand-cover" style={coverBox(c.width, c.height, COVER_CAP_REM)} {...pr(c.live)}>
      <img src={c.src} width={c.width} height={c.height} alt={c.alt} loading="eager" fetchPriority="high" decoding="async" />
    </a>
    <figcaption className="ed-caption mt-1 flex flex-wrap gap-x-1 max-sm:min-h-[3lh]">
      <span>{c.what} · captured <time dateTime={c.at}>{longDayOf(c.at)}</time> ·</span>
      <a href={c.live} target="_blank" rel="noopener" className="ed-tap" {...pr(c.live)}>Live site</a><span aria-hidden="true">·</span>
      <a href={c.report} className="ed-tap">Report this image</a>
    </figcaption>
  </figure>;
}
