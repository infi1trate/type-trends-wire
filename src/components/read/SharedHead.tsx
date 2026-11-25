// A4 · shared-element transition: a story row, brand card or study card that opens its own page morphs into that page's headline.
// One delegated click listener (no observers, nothing on first load): the clicked link takes the shared name and the old page's own
// headline drops it, so exactly one element carries it on each side; the destination headline carries it through \`.vt-head\`.
import { useEffect } from "react";

export const SHARED_HEAD = "shared-head";
export const SHARED_PATHS = /^\/(stories|brands|studies)\/[^/?#]+\/?$/;

export function SharedHead() {
  useEffect(() => {
    if (typeof document === "undefined" || !("startViewTransition" in document)) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(a instanceof HTMLAnchorElement) || a.origin !== location.origin || !SHARED_PATHS.test(a.pathname) || a.pathname === location.pathname) return;
      document.querySelectorAll<HTMLElement>(".vt-head").forEach(h => { h.style.viewTransitionName = "none"; });
      document.querySelectorAll<HTMLElement>("[data-vt-on]").forEach(h => { h.style.viewTransitionName = ""; h.removeAttribute("data-vt-on"); });
      const t = a.querySelector<HTMLElement>("[data-vt-title]") ?? a;
      t.style.viewTransitionName = SHARED_HEAD; t.setAttribute("data-vt-on", "");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
