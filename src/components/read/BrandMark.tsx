// BrandMark (I1): the brand's own site icon beside its name, as the brand published it (no ink treatment, no recolouring, no circle
// crop), on a neutral tile. Fixed size with explicit width and height, alt="" because the name always follows, lazy so a long list
// only loads the icons on or near the screen. Without a stored icon it draws nothing (or, in a list where most rows have one, an
// invisible spacer of the same width so names line up).
import type { Pic } from "@/lib/pictures";

export type MarkSize = 16 | 20 | 24 | 32;
export function BrandMark({ icon, size = 20, reserve = false, eager = false, className = "" }: { icon: Pic | null | undefined; size?: MarkSize; reserve?: boolean; eager?: boolean; className?: string }) {
  const box = { width: size, height: size, flex: `0 0 ${size}px` } as const;
  if (!icon) return reserve ? <span aria-hidden="true" className={`inline-block align-middle ${className}`.trim()} style={box} data-brand-mark-space="" /> : null;
  return <span className={`brand-mark ${className}`.trim()} style={box} data-brand-mark="">
    <img src={icon.src} width={size} height={size} alt="" loading={eager ? "eager" : "lazy"} decoding="async" />
  </span>;
}
/** A brand's name led by its icon: the icon and a small gap, then the name, on one baseline. */
export function MarkedName({ icon, size = 20, reserve = false, children }: { icon: Pic | null | undefined; size?: MarkSize; reserve?: boolean; children: React.ReactNode }) {
  if (!icon && !reserve) return <>{children}</>;
  return <span className="inline-flex max-w-full items-center gap-2 align-bottom"><BrandMark icon={icon} size={size} reserve={reserve} /><span className="min-w-0">{children}</span></span>;
}
