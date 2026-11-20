// The page behind a wireframe (I1): wherever a drawn capture stands for a brand's page and a hero crop exists, intent shows the real
// crop over the drawing. Pointer: fades in after ~120 ms (so sweeping across a wall does not flicker), out on leave. Keyboard: the
// thumbnail is focusable; Enter or Space shows it, Escape hides it. Touch: the first tap shows it, the second follows the link.
// Reduced motion: the swap is instant. The crop is requested only on that first intent, fills the drawing's box (cover, top
// aligned) so nothing moves, and carries its credit on the picture; assistive technology hears that a real capture is available.
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { REVEAL_HINT, type Reveal } from "@/lib/pictures";

export const REVEAL_DELAY_MS = 120;
export const REVEAL_FADE_MS = 160;
const reducedMotion = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && !!window.matchMedia("(prefers-reduced-motion: reduce)")?.matches;

/** State and handlers for one revealable thumbnail. `link`: the thumbnail is a link (Enter or a second tap while shown follows it). */
export function useReveal(reveal: Reveal | null | undefined, { link = false }: { link?: boolean } = {}) {
  const [requested, setRequested] = useState(false), [shown, setShown] = useState(false), [reduced, setReduced] = useState(false);
  const timer = useRef<number | null>(null), pointer = useRef<string>("mouse");
  useEffect(() => {
    setReduced(reducedMotion());
    const mq = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    const on = () => setReduced(reducedMotion());
    mq?.addEventListener?.("change", on);
    return () => { mq?.removeEventListener?.("change", on); if (timer.current != null) window.clearTimeout(timer.current); };
  }, []);
  const cancel = () => { if (timer.current != null) { window.clearTimeout(timer.current); timer.current = null; } };
  const show = () => { cancel(); setRequested(true); setShown(true); };
  const hide = () => { cancel(); setShown(false); };
  if (!reveal) return { active: false as const, shown: false, requested: false, reduced, handlers: {} };
  const handlers = {
    onPointerEnter: (e: PointerEvent) => { pointer.current = e.pointerType; if (e.pointerType === "touch") return; cancel(); timer.current = window.setTimeout(show, reduced ? 0 : REVEAL_DELAY_MS); },
    onPointerLeave: (e: PointerEvent) => { if (e.pointerType !== "touch") hide(); },
    onPointerDown: (e: PointerEvent) => { pointer.current = e.pointerType; },
    onClick: (e: MouseEvent) => {
      if (pointer.current === "touch") { if (!shown) { e.preventDefault(); show(); } else if (!link) hide(); return; }
      if (!link) { e.preventDefault(); if (shown) hide(); else show(); }
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (shown) { e.preventDefault(); e.stopPropagation(); hide(); } return; }
      if (e.key === " " || e.key === "Spacebar") { e.preventDefault(); if (shown) hide(); else show(); return; }
      if (e.key === "Enter") { if (!shown) { e.preventDefault(); show(); } else if (!link) { e.preventDefault(); hide(); } }
    },
    onBlur: () => hide(),
  };
  return { active: true as const, shown, requested, reduced, handlers };
}

/** The real crop laid over the drawing, filling its box. Rendered (and so requested) only after the first intent. */
/** `top`: over a tall drawing (a whole page), the crop covers only the drawing's top, at the crop's own ratio (the hero it shows). */
export function RevealLayer({ reveal, shown, requested, reduced, top = false }: { reveal: Reveal; shown: boolean; requested: boolean; reduced: boolean; top?: boolean }) {
  return <>
    <span aria-hidden="true" className="reveal-layer" data-reveal-layer={shown ? "shown" : "hidden"}
      style={{ opacity: shown ? 1 : 0, transition: reduced ? "none" : `opacity ${REVEAL_FADE_MS}ms linear`, ...(top ? { bottom: "auto", aspectRatio: `${reveal.width} / ${reveal.height}` } : {}) }}>
      {requested && <img src={reveal.src} width={reveal.width} height={reveal.height} alt="" decoding="async" className="reveal-img" />}
      {requested && <span className="reveal-credit">{reveal.credit}</span>}
    </span>
    <span className="sr-only" aria-live="polite">{shown ? `Showing the real capture: ${reveal.credit}` : ""}</span>
  </>;
}

/** A drawing that is not already a link: a focusable toggle around it. Without a crop, the drawing renders exactly as before. */
export function RevealBox({ reveal, label, children, className = "", top = false }: { reveal: Reveal | null | undefined; label: string; children: ReactNode; className?: string; top?: boolean }) {
  if (!reveal) return <>{children}</>;
  return <RevealToggle reveal={reveal} label={label} className={className} top={top}>{children}</RevealToggle>;
}
function RevealToggle({ reveal, label, children, className, top }: { reveal: Reveal; label: string; children: ReactNode; className: string; top: boolean }) {
  const r = useReveal(reveal);
  return <div role="button" tabIndex={0} aria-pressed={r.shown} aria-label={`${label}. ${REVEAL_HINT}: ${reveal.credit}`} className={`reveal-box ${className}`.trim()} data-reveal="" {...r.handlers}>
    <div aria-hidden="true">{children}</div>
    <RevealLayer reveal={reveal} shown={r.shown} requested={r.requested} reduced={r.reduced} top={top} />
  </div>;
}
