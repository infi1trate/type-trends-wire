// One row that scrolls sideways (sub-navigation on phones): never wraps, scrolls the current item (aria-current) into view on load,
// and shows a cue at the edge while more items sit off-screen. Without JavaScript it is still one scrollable row.
import { useEffect, useRef, useState, type ReactNode } from "react";

export function ScrollRow({ children, className = "", label }: { children: ReactNode; className?: string; label?: string }) {
  const ref = useRef<HTMLDivElement>(null), [more, setMore] = useState<{ start: boolean; end: boolean }>({ start: false, end: false });
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const cur = el.querySelector<HTMLElement>("[aria-current]");
    if (cur && el.scrollWidth > el.clientWidth) el.scrollLeft = Math.max(0, cur.offsetLeft - el.offsetLeft - (el.clientWidth - cur.offsetWidth) / 2);
    const read = () => setMore({ start: el.scrollLeft > 2, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
    read();
    el.addEventListener("scroll", read, { passive: true });
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(read); ro?.observe(el);
    return () => { el.removeEventListener("scroll", read); ro?.disconnect(); };
  }, []);
  return <div className="scroll-row-wrap" data-more-start={more.start ? "" : undefined} data-more-end={more.end ? "" : undefined}>
    <div ref={ref} className={`scroll-row ${className}`.trim()} data-scroll-row="" {...(label ? { role: "group", "aria-label": label } : {})}>{children}</div>
    <span className="scroll-cue scroll-cue-start" aria-hidden="true">←</span>
    <span className="scroll-cue scroll-cue-end" aria-hidden="true">→</span>
  </div>;
}
