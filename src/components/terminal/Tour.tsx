import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { availableSteps, tourStore, type TourStep } from "@/lib/tour";

/** Four-step first-visit tour over real elements. No blocking backdrop; → / Enter next, Esc skips. */
export function Tour({ onDone }: { onDone: () => void }) {
  const [steps, setSteps] = useState<TourStep[] | null>(null), [i, setI] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null), [mobile, setMobile] = useState(false);
  const box = useRef<HTMLDivElement>(null), next = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let tries = 0, raf = 0;
    const look = () => { const s = availableSteps(sel => !!document.querySelector(sel)); if (s.length >= 4 || tries++ > 160) setSteps(s); else raf = window.setTimeout(look, 50); };
    look(); return () => clearTimeout(raf);
  }, []);
  const finish = useCallback(() => { tourStore().finish(); onDone(); }, [onDone]);
  const step = steps?.[i];
  const advance = useCallback(() => { if (!steps) return; if (i + 1 >= steps.length) finish(); else setI(i + 1); }, [i, steps, finish]);
  useEffect(() => { if (steps && steps.length === 0) finish(); }, [steps, finish]);
  useLayoutEffect(() => {
    if (!step) return;
    const el = document.querySelector<HTMLElement>(step.target);
    if (!el) { advance(); return; }
    el.classList.add("tour-target");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
    const place = () => {
      const m = window.innerWidth < 768; setMobile(m);
      if (m) return;
      const r = el.getBoundingClientRect(), h = box.current?.offsetHeight ?? 96, w = 320, vw = window.innerWidth, vh = window.innerHeight;
      const left = Math.max(8, Math.min(r.left, vw - w - 8)), below = r.bottom + 8;
      setPos({ left, top: below + h <= vh - 8 ? below : Math.max(8, r.top - 8 - h) });
    };
    place(); const t = setTimeout(place, 350);
    window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    next.current?.focus({ preventScroll: true });
    return () => { clearTimeout(t); el.classList.remove("tour-target"); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [step, advance]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(); }
      else if (e.key === "ArrowRight" || (e.key === "Enter" && !(e.target instanceof HTMLButtonElement))) { e.preventDefault(); e.stopPropagation(); advance(); }
    };
    window.addEventListener("keydown", k, true); return () => window.removeEventListener("keydown", k, true);
  }, [advance, finish]);
  if (!step || !steps) return null;
  return (
    <div ref={box} role="dialog" aria-modal="false" aria-label={`Tour step ${i + 1} of ${steps.length}`} aria-live="polite"
      style={mobile ? undefined : { left: pos?.left ?? 8, top: pos?.top ?? 8, width: 320 }}
      className={`fixed z-[60] border border-ink bg-void p-3 ${mobile ? "inset-x-0 bottom-10 border-x-0" : ""}`}>
      <p className="label text-g500">TOUR · {i + 1} / {steps.length}</p>
      <p className="mt-1 text-ink">{step.caption}</p>
      <div className="mt-2 flex gap-2">
        <button ref={next} type="button" onClick={advance} className="label h-11 border border-ink px-3 text-ink hover:bg-ink hover:text-void md:h-8">{i + 1 >= steps.length ? "DONE" : "NEXT →"}</button>
        <button type="button" onClick={finish} className="label h-11 px-3 text-g500 hover:text-ink md:h-8">SKIP · ESC</button>
      </div>
    </div>
  );
}
