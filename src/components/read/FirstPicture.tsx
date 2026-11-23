// C1b Part 1 · announces the page's largest picture during the first render, so React writes its preload into the head's first
// flush (and the route sends the same as a `Link` header). Draws nothing.
import { preload } from "react-dom";
import type { FirstPicture } from "@/lib/first-paint";

export function AnnounceFirst({ p }: { p: FirstPicture | null | undefined }) {
  if (p) preload(p.href, { as: "image", fetchPriority: "high", ...(p.srcSet ? { imageSrcSet: p.srcSet } : {}), ...(p.srcSet && p.sizes ? { imageSizes: p.sizes } : {}), ...(p.media ? { media: p.media } : {}) });
  return null;
}
