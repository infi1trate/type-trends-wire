// Sector lens + mode switch hooks shared by the Read shell and the terminal chrome.
import { useCallback, useEffect } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { resolveSector, sectorStore } from "@/lib/sector-lens";
import { toggleHref } from "@/lib/ia";

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
/** Read ⇄ Terminal for the current page: same object or section in the other mode. */
export function useModeToggle() {
  const router = useRouter(), loc = useLocationParts();
  const href = toggleHref(loc.pathname, loc.search);
  const go = useCallback(() => { void router.navigate({ href }); }, [router, href]);
  return { href, go };
}
