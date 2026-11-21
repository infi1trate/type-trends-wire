// Sector lens + mode switch hooks shared by the Read shell and the terminal chrome.
import { useCallback, useEffect } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { resolveSector, sectorStore } from "@/lib/sector-lens";
import { isDataView, objectOf, toggleHref } from "@/lib/ia";

const withParam = (pathname: string, searchStr: string, hash: string, key: string, value: string | null) => {
  const sp = new URLSearchParams(searchStr.startsWith("?") ? searchStr.slice(1) : searchStr);
  if (value === null) sp.delete(key); else sp.set(key, value);
  if (key === "sector") sp.delete("page");
  const q = sp.toString();
  return `${pathname}${q ? `?${q}` : ""}${hash ? `#${hash}` : ""}`;
};
export function useLocationParts() {
  return useRouterState({ select: s => ({ pathname: s.location.pathname, search: s.location.search as Record<string, unknown>, searchStr: s.location.searchStr, hash: s.location.hash }) });
}
/** The `?sector=` lens: URL first (so SSR and hydration agree), then the device's remembered choice; storage failures read as All. */
export function useSectorLens(): [string, (s: string) => void] {
  const router = useRouter(), loc = useLocationParts(), raw = loc.search["sector"], sector = resolveSector(raw);
  useEffect(() => {
    if (raw !== undefined) return;
    const stored = sectorStore().read();
    if (stored !== "all") void router.navigate({ href: withParam(loc.pathname, loc.searchStr, loc.hash, "sector", stored), replace: true, resetScroll: false });
    // Restore once per page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.pathname]);
  const set = useCallback((v: string) => {
    const s = resolveSector(v); sectorStore().write(s);
    void router.navigate({ href: withParam(loc.pathname, loc.searchStr, loc.hash, "sector", s === "all" ? null : s), resetScroll: false });
  }, [router, loc.pathname, loc.searchStr, loc.hash]);
  return [sector, set];
}
/** The sector lens in a search object, or undefined for All. */
export const lensOfSearch = (s: Record<string, unknown>) => { const v = resolveSector(s["sector"]); return v === "all" ? undefined : v; };
const scrollKey = (path: string) => `slug:read-y:${path}`;
/** U1 · going back from a Data view to its Read view returns to where the reader was; the Read body streams in, so try a few times. */
function restoreReadScroll(path: string) {
  let y = 0;
  try { y = Number(sessionStorage.getItem(scrollKey(path)) ?? 0); } catch { return; }
  if (!(y > 0)) return;
  const tryAt = (ms: number) => window.setTimeout(() => { if (document.documentElement.scrollHeight - window.innerHeight >= y - 4) window.scrollTo({ top: y }); }, ms);
  requestAnimationFrame(() => window.scrollTo({ top: Math.min(y, document.documentElement.scrollHeight) }));
  tryAt(250); tryAt(800);
}
/** Read ⇄ Terminal for the current page: same object or section in the other mode. On an object's address (U1) the switch only adds or
 *  removes `view=data`; the Read view's scroll position is kept for the way back. */
export function useModeToggle() {
  const router = useRouter(), loc = useLocationParts();
  const href = toggleHref(loc.pathname, loc.search);
  const go = useCallback(() => {
    const obj = objectOf(loc.pathname), data = isDataView(loc.pathname, loc.search);
    if (obj && !data) { try { sessionStorage.setItem(scrollKey(loc.pathname), String(Math.round(window.scrollY))); } catch { /* private mode: the way back opens at the top */ } }
    void router.navigate({ href }).then(() => { if (obj && data) restoreReadScroll(loc.pathname); });
  }, [router, href, loc.pathname, loc.search]);
  return { href, go };
}
