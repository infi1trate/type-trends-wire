// The one place the product's name is drawn: the outlined mark from the owner's kit (brand/logo/svg, inlined in mark.gen.ts).
// It is a drawing, never type. The cut follows the rendered height; the fill is always brand ink; on ink or an image it sits on a slab.
import { BRAND_NAME } from "@/lib/brand";
import { MARK_PATHS } from "./mark.gen";
import { MARK_INK, cutFor, markSize, slabFill, slabPad, type Ground } from "./mark";
import type { MarkCut } from "./mark-files";

type Props = {
  /** Rendered height of the mark in CSS px (the letters, without the slab). Picks the cut: 96+ display, 32–95 standard, under 32 micro. */
  height?: number;
  /** What the mark sits on. Ink and images get the slab (pink on ink, paper on an image); "auto" uses the mode's mark ground. */
  ground?: Ground;
  className?: string;
  /** Decorative when a parent already names it (a link labelled "slug, the front page"). */
  decorative?: boolean;
};
function Drawn({ cut, height, ground = "paper", className = "", decorative = false }: Props & { cut: MarkCut; height: number }) {
  const p = MARK_PATHS[cut], { w } = markSize(cut, height), fill = slabFill(ground), pad = fill ? slabPad(height) : 0;
  const a11y = decorative ? { "aria-hidden": true as const } : { role: "img" as const, "aria-label": BRAND_NAME };
  return <span className={`wordmark ${className}`.trim()} data-wordmark="" data-cut={cut} data-ground={ground} style={fill ? { background: fill, padding: `${pad}px` } : undefined}>
    <svg width={w} height={height} viewBox={`0 0 ${p.w} ${p.h}`} {...a11y} focusable="false"><path d={p.d} fill={MARK_INK} /></svg>
  </span>;
}
export function Wordmark({ height = 24, ...rest }: Props) {
  return <Drawn cut={cutFor(height)} height={height} {...rest} />;
}
/** The s monogram: where four letters will not fit (avatars, small places). */
export function Monogram({ height = 24, ...rest }: Props) {
  return <Drawn cut="s" height={height} {...rest} />;
}
