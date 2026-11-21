// W1b · "Surfaces" on the brand page: the latest first screen slug holds for the brand plus its site icon and social card, each in a
// fixed 3:2 box (explicit size, lazy, no layout shift) with what it is, the capture date, the live link and "Report"; then one line per
// other page we read (product, about, pricing), with what was measured on it, because the crawler keeps pictures of homepages only.
import { useSuspenseQuery } from "@tanstack/react-query";
import { brandSurfacesQuery } from "@/lib/data";
import { longDay } from "@/lib/pictures";
import type { BrandSurfaces } from "@/lib/surfaces";
import { pr } from "@/components/digest/Editorial";
import { BlockPart } from "./ObjectPage";

export const SURFACES_TITLE = "Surfaces";
export function SurfacesBlock({ s }: { s: BrandSurfaces }) {
  if (!s.show) return null;
  const pics = s.tiles.filter(t => t.pic), pages = s.tiles.filter(t => !t.pic && t.key !== "home");
  return <div className="mt-10" data-surfaces-block=""><BlockPart title={SURFACES_TITLE} kicker="The latest capture of each page we read for this brand. Only the homepage is kept as a picture; for the other pages, what we measured on them.">
    <div data-surfaces="">
      {pics.length > 0 && <ul className="surface-wall">{pics.map(t => <li key={t.key} className="min-w-0" data-surface-key={t.key}>
        <figure className="min-w-0" data-surface={t.key}>
          <a href={t.live} target="_blank" rel="noopener" aria-label={`Open ${s.domain} (live site)`} className="surface-box block" style={{ aspectRatio: "3 / 2" }} data-fit={t.pic!.fit} {...pr(t.live)}>
            <img src={t.pic!.src} width={t.pic!.width} height={t.pic!.height} alt={t.pic!.alt} loading="lazy" decoding="async" />
          </a>
          <figcaption className="ed-caption mt-1">
            <span className="block">{t.what}{t.at && <> · captured <time dateTime={t.at} className="whitespace-nowrap">{longDay(t.at)}</time></>}</span>
            <span className="flex flex-wrap gap-x-4">
              <a href={t.live} target="_blank" rel="noopener" className="ed-tap" {...pr(t.live)}>Live site ↗</a>
              <a href={t.report} className="ed-tap">Report this image</a>
            </span>
          </figcaption>
        </figure>
      </li>)}</ul>}
      {pages.length > 0 && <ul className="surface-list mt-6">{pages.map(t => <li key={t.key} data-surface={t.key}>
        <p className="ed-data flex flex-wrap items-baseline gap-x-3">
          <span>{t.what}</span>
          {t.at && <span className="ed-caption">captured <time dateTime={t.at} className="whitespace-nowrap">{longDay(t.at)}</time></span>}
          <a href={t.live} target="_blank" rel="noopener" className="ed-tap ed-caption" {...pr(t.live)}>Live page ↗</a>
        </p>
        <p className="ed-caption">{t.lines.join(" · ")}</p>
      </li>)}</ul>}
      {s.productLine && <p className="ed-caption mt-4 max-w-[68ch]" data-product-line="">{s.productLine}</p>}
    </div>
  </BlockPart></div>;
}
/** Suspends inside the identity card's slot, so the block arrives with the card and nothing below it moves. */
export function SurfacesPart({ domain }: { domain: string }) {
  const { data } = useSuspenseQuery(brandSurfacesQuery(domain));
  return <SurfacesBlock s={data} />;
}
