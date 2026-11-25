// B2 · the measured pixel width of a chart's box (SSR and first paint use `initial`), so the new forms lay out dots and labels at real size.
import { useEffect, useRef, useState } from "react";
export function useChartWidth<T extends HTMLElement>(initial = 720) {
  const ref = useRef<T>(null), [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current; if (!el || typeof ResizeObserver === "undefined") return;
    const o = new ResizeObserver(([e]) => { const n = Math.round(e?.contentRect.width ?? 0); if (n > 0) setW(n); }); o.observe(el); return () => o.disconnect();
  }, []);
  return [ref, w] as const;
}
