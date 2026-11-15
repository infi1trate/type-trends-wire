import { useQuery } from "@tanstack/react-query";
import { siteThumbQuery } from "@/lib/data";
import { pickThumb, type ThumbRow } from "@/lib/thumbs";
/** Latest stored homepage thumbnail for a library site, captioned and linked; renders nothing until one exists. */
export function SiteThumb({ domain }: { domain: string }) {
  const { data } = useQuery(siteThumbQuery(domain));
  const t = data ? pickThumb(data as ThumbRow[], domain) : null;
  if (!t) return null;
  return <figure className="w-full max-w-[320px] shrink-0">
    <a href={t.live} target="_blank" rel="noopener" aria-label={`Open ${domain} (live site)`}><img src={t.src} srcSet={t.srcSet} sizes="320px" width={t.width} height={t.height} loading="lazy" decoding="async" alt={t.alt} className="site-thumb" /></a>
    <figcaption className="label mt-1 text-compare-muted">{t.caption}</figcaption>
  </figure>;
}
