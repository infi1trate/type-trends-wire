// W1b · W1c · "Surfaces" on the brand page: a compact, table-like list with one row per page we read for the brand (home, product, about,
// pricing, changelog): its measured headline typeface, its accent colour as a small swatch with the colour's name, whether it matches
// the homepage, the capture date and a link to the live page (the page's name); one plain line above says how many other pages match. No pictures until
// the crawler sends first screens of those pages; then the row shows a small one in a fixed box (explicit size, lazy, no layout shift),
// credited by the row itself (page, brand, date), linked to the live page, with "Report this image".
import { useSuspenseQuery } from "@tanstack/react-query";
import { brandSurfacesQuery } from "@/lib/data";
import { longDay } from "@/lib/pictures";
import type { BrandSurfaces, SurfaceListRow } from "@/lib/surfaces";
import { pr } from "@/components/digest/Editorial";

export const SURFACES_TITLE = "Surfaces";
const MATCH_WORD = { yes: "yes", no: "no", "not comparable": "not comparable" } as const;
const match = (r: SurfaceListRow) => <span className="surface-match ed-caption">{r.match === "this is home" ? "The homepage" : <>Matches home: {MATCH_WORD[r.match]}</>}</span>;
export function SurfacesBlock({ s }: { s: BrandSurfaces }) {
  if (!s.show || !s.list.length) return null;
  const pics = s.list.some(r => r.pic);
  return <div className="mt-8" data-surfaces-block="">
    <h3 className="ed-kicker" id="ed-surfaces-title">{SURFACES_TITLE}</h3>
    {s.matchLine && <p className="ed-caption mt-1 max-w-[68ch]" data-match-line="">{s.matchLine}</p>}
    <ul className="surface-rows mt-2" aria-labelledby="ed-surfaces-title" data-surfaces="" data-pics={pics ? "" : undefined}>
      {s.list.map(r => <li key={r.key} className="surface-row" data-surface={r.key}>
        {pics && <span className="surface-thumb-cell">{r.pic && <a href={r.live} target="_blank" rel="noopener" className="surface-thumb" aria-label={`Open the live ${r.page.toLowerCase()} of ${s.domain}`} {...pr(r.live)}>
          <img src={r.pic.src} width={r.pic.width} height={r.pic.height} alt={r.pic.alt} loading="lazy" decoding="async" />
        </a>}</span>}
        {/* Phones: two short lines (a row with a picture puts "Report this image" on the first, beside the page's link). From 768 px the
            lines dissolve into one grid row with fixed column order (styles.css). */}
        <span className="surface-line surface-line-1">
          <a href={r.live} target="_blank" rel="noopener" className="surface-page ed-data ed-tap" aria-label={`${r.page} of ${s.domain}, live page`} {...pr(r.live)}>{r.page} ↗</a>
          {r.pic ? <a href={r.report} className="surface-report ed-caption ed-tap">Report this image</a> : match(r)}
        </span>
        <span className="surface-line">
          <span className="surface-type ed-caption"><span className="sr-only">Headline typeface: </span>{r.typeface}</span>
          <span className="surface-accent ed-caption"><span className="sr-only">Accent colour: </span>{r.accent && <span className="surface-swatch" style={{ background: r.accent.hex }} aria-hidden="true" />}{r.accentText}</span>
          {r.pic && match(r)}
          <span className="surface-at ed-caption"><span className="sr-only">Captured </span><time dateTime={r.at}>{longDay(r.at)}</time></span>
        </span>
      </li>)}
    </ul>
  </div>;
}
/** Suspends inside the identity card's slot, so the block arrives with the card and nothing below it moves. */
export function SurfacesPart({ domain }: { domain: string }) {
  const { data } = useSuspenseQuery(brandSurfacesQuery(domain));
  return <SurfacesBlock s={data} />;
}
