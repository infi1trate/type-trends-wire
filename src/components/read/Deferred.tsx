// Draws its children only when they come near the screen (or the page is printed); until then a placeholder of the same size holds the
// space, so nothing moves when it draws. The server and the first client render both send the placeholder, so hydration matches.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

export const DEFER_MARGIN = "800px";
/** `noscript` is shown inside the placeholder only when scripts are off (e.g. a link to a view that draws everything on the server). */
export function Deferred({ children, eager = false, style, label, noscript }: { children: ReactNode; eager?: boolean; style?: CSSProperties; label?: string; noscript?: ReactNode }) {
  const [on, setOn] = useState(eager), ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (on) return;
    const show = () => setOn(true), mq = window.matchMedia?.("print");
    window.addEventListener("beforeprint", show); mq?.addEventListener?.("change", show);
    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver === "undefined") show();
    else if (ref.current) { io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) show(); }, { rootMargin: DEFER_MARGIN }); io.observe(ref.current); }
    return () => { io?.disconnect(); window.removeEventListener("beforeprint", show); mq?.removeEventListener?.("change", show); };
  }, [on]);
  return on ? <>{children}</> : <span ref={ref} className="block w-full" style={style} data-deferred="" role={label && !noscript ? "img" : undefined} aria-label={noscript ? undefined : label}>{noscript && <noscript>{noscript}</noscript>}</span>;
}
