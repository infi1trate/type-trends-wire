import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { glossaryEntry, stageId, dimensionId } from "@/lib/glossary";
import { stageName, type Dimension } from "@/lib/labels";

const W = 280, GAP = 6, EDGE = 8;

/** Where the card goes: below the button, flipped above when there is no room, shifted to stay inside the viewport. Pure. */
export function placeCard(btn: { left: number; top: number; bottom: number }, card: { width: number; height: number }, vw: number, vh: number) {
  const width = Math.min(W, vw - EDGE * 2);
  const left = Math.max(EDGE, Math.min(btn.left, vw - width - EDGE));
  const below = btn.bottom + GAP, above = btn.top - GAP - card.height;
  const top = below + card.height <= vh - EDGE || above < EDGE ? below : above;
  return { left, top, width };
}

/** Methodology link: on the terminal it only changes the hash (keeps the open panel); elsewhere it goes to the terminal. */
export function methodLink(anchor: string) {
  return { href: `/#${anchor}`, onClick: (ev: React.MouseEvent) => { if (window.location.pathname === "/") { ev.preventDefault(); window.location.hash = anchor; } } };
}

/** Small (i) button that opens a non-modal glossary card on hover, focus or tap. Esc or a tap outside closes it. */
export function Info({ g, className = "" }: { g: string; className?: string }) {
  const e = glossaryEntry(g);
  const id = useId(), btn = useRef<HTMLButtonElement>(null), card = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false), [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const openedAt = useRef(0), hideT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback(() => { if (hideT.current) clearTimeout(hideT.current); setOpen(o => { if (!o) openedAt.current = Date.now(); return true; }); }, []);
  const hideSoon = useCallback(() => { if (hideT.current) clearTimeout(hideT.current); hideT.current = setTimeout(() => setOpen(false), 120); }, []);
  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const place = () => { const r = btn.current!.getBoundingClientRect(), c = card.current?.getBoundingClientRect(); setPos(placeCard(r, { width: c?.width ?? W, height: c?.height ?? 120 }, window.innerWidth, window.innerHeight)); };
    place(); const raf = requestAnimationFrame(place);
    window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const key = (ev: KeyboardEvent) => { if (ev.key === "Escape") { ev.stopPropagation(); setOpen(false); btn.current?.focus(); } };
    const down = (ev: PointerEvent) => { const t = ev.target as Node; if (!btn.current?.contains(t) && !card.current?.contains(t)) setOpen(false); };
    window.addEventListener("keydown", key, true); document.addEventListener("pointerdown", down);
    return () => { window.removeEventListener("keydown", key, true); document.removeEventListener("pointerdown", down); };
  }, [open]);
  useEffect(() => () => { if (hideT.current) clearTimeout(hideT.current); }, []);
  if (!e) return null;
  return (
    <>
      <button ref={btn} type="button" aria-label={`About ${e.term}`} aria-describedby={open ? id : undefined} aria-expanded={open}
        onPointerEnter={ev => { if (ev.pointerType === "mouse") show(); }} onPointerLeave={ev => { if (ev.pointerType === "mouse") hideSoon(); }}
        onFocus={show} onBlur={ev => { if (!card.current?.contains(ev.relatedTarget as Node)) hideSoon(); }}
        onClick={ev => { ev.stopPropagation(); setOpen(o => (Date.now() - openedAt.current < 400 ? true : !o)); }}
        className={`info-btn relative ml-1 inline-flex h-[14px] w-[14px] shrink-0 items-center justify-center border border-g500 align-middle text-label font-normal normal-case leading-none text-g500 hover:border-ink hover:text-ink focus-visible:border-ink focus-visible:text-ink focus-visible:outline-none ${open ? "border-ink text-ink" : ""} ${className}`}>
        i
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div ref={card} id={id} role="tooltip" onPointerEnter={show} onPointerLeave={ev => { if (ev.pointerType === "mouse") hideSoon(); }}
          style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: pos?.width ?? W }}
          className="fixed z-[70] border border-ink bg-void p-2 text-left normal-case">
          <p className="label font-semibold text-ink">{e.term}</p>
          <p className="t-say mt-1 text-ink">{e.measures}</p>
          <p className="t-say mt-1 text-g500">{e.howToRead}</p>
          <a {...methodLink(e.methodologyAnchor)} onClickCapture={() => setOpen(false)} onBlur={hideSoon} className="label mt-1 inline-block text-ink underline underline-offset-2">Methodology →</a>
        </div>, document.body)}
    </>
  );
}

/** Heading text followed by its (i). */
export function Term({ children, g }: { children: React.ReactNode; g: string }) {
  return <span className="inline-flex items-center whitespace-nowrap">{children}<Info g={g} /></span>;
}

/** Outlined word badge for one of the five stages; no fill and no color. */
export function StageBadge({ stage, info = false }: { stage: string | null | undefined; info?: boolean }) {
  const s = stageName(stage);
  if (!s) return <span className="label text-g500">Not staged yet</span>;
  return <span className="inline-flex items-center"><span className="tk-chip inline-block border px-1" data-stage={s.toLowerCase()}>{s}</span>{info && <Info g={stageId(s)} />}</span>;
}

export function DimTag({ d, info = false }: { d: Dimension; info?: boolean }) {
  return <span className="label inline-flex items-center text-g500">[{d}]{info && <Info g={dimensionId(d)} />}</span>;
}
