// The one place the product's name is drawn as a mark (mastheads, logos, share-card previews).
// Today it sets the word in the current mode's wordmark type role (display face, lowercase) in the current foreground colour.
// When the drawn wordmark lands, only the inside of this component changes; callers keep passing `size`.
import { BRAND_NAME } from "@/lib/brand";

type Props = { /** Cap height driver in CSS px; the mark scales from it. */ size?: number; className?: string; /** Line height override in px, so a mark can sit in an existing row without changing its height. */ leading?: number };
export function Wordmark({ size = 16, className = "", leading }: Props) {
  return <span className={`wordmark ${className}`.trim()} style={{ fontSize: `${size}px`, ...(leading !== undefined ? { lineHeight: `${leading}px` } : {}) }} data-wordmark="">{BRAND_NAME}</span>;
}
