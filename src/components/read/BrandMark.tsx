// A1 · one fixed tile for every brand; a neutral initial is not a replacement logo.
import { useState } from "react";
import type { Pic } from "@/lib/pictures";

export const MARK_SIZES = [20, 28, 32, 48, 56, 72] as const;
export type MarkSize = (typeof MARK_SIZES)[number];
/** The pixel floor applies to both dimensions; vector marks stay sharp at any scale. */
export function usableMark(icon: Pic | null | undefined, size: MarkSize): icon is Pic {
  return !!icon && (/\.svg(?:[?#]|$)/i.test(icon.src) || Math.min(icon.width, icon.height) >= size * 2 / 3);
}
export function BrandMark({ icon, name = "", size = 32, mobileSize, reserve: _reserve, eager = false, standalone = false, className = "" }: {
  icon: Pic | null | undefined; name?: string; size?: MarkSize; mobileSize?: MarkSize; reserve?: boolean;
  eager?: boolean; standalone?: boolean; className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const show = usableMark(icon, size) && failed !== icon.src;
  const letter = Array.from(name.trim())[0]?.toLocaleUpperCase() ?? "";
  return <span className={`brand-mark brand-mark-${size} ${mobileSize ? `brand-mark-mobile-${mobileSize}` : ""} ${className}`.trim()}
    data-brand-mark="" data-mark-fallback={show ? undefined : ""} aria-hidden={standalone ? undefined : true}
    role={standalone && !show ? "img" : undefined} aria-label={standalone && !show ? name : undefined}>
    {show ? <img src={icon.src} width={size} height={size} alt={standalone ? name : ""} loading={eager ? "eager" : "lazy"} decoding="async" onError={() => setFailed(icon.src)} />
      : <span className="brand-mark-initial">{letter}</span>}
  </span>;
}
export function MarkedName({ icon, name, size = 32, reserve, children }: { icon: Pic | null | undefined; name?: string; size?: MarkSize; reserve?: boolean; children: React.ReactNode }) {
  const label = name ?? (typeof children === "string" ? children : "");
  return <span className="inline-flex max-w-full items-center gap-2 align-bottom"><BrandMark icon={icon} name={label} size={size} {...(reserve === undefined ? {} : { reserve })} /><span className="min-w-0">{children}</span></span>;
}
