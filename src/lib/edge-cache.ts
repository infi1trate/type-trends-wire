// P1 · shared cache for public Read pages. Every Read page is identical for every visitor (no accounts; the sector choice is in the
// URL), so a rendered page can be kept for five minutes and served to the next visitor while a fresh one is drawn. Pure rules here;
// src/server.ts applies them. Never cached: staff pages, the terminal, agency pages, /api/*, server functions, anything with an
// Authorization header, any non-200 or non-HTML answer, answers that set cookies, and every page while the site password is on.
/** The header on a cacheable Read page: browsers revalidate, the shared cache keeps it 5 minutes and may serve it stale for a day
 *  while it redraws, so a new story or edit is visible within five minutes. */
export const READ_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=86400";
/** How long the server's own page cache keeps a page (the Cache API honours max-age, not stale-while-revalidate). */
export const READ_CACHE_SECONDS = 300;

const PREFIXES = ["/brands", "/patterns", "/signals", "/stories", "/digest", "/data", "/collections", "/sectors", "/morning", "/editions", "/what-we-show"] as const;
const NEVER = ["/api/", "/_serverFn", "/desk", "/status", "/welcome", "/kit", "/terminal", "/library", "/ambient", "/audit", "/watch", "/embed", "/lock"] as const;
/** The query parameters any Read page reads (each route's validateSearch). Others (utm_*, fbclid…) do not change the page, so they
 *  are left out of the cache key and every variant shares one copy. */
export const READ_PARAMS = ["sector", "format", "all", "section", "q", "sort", "dir", "tab", "tier", "page", "step", "figures", "brand", "pattern", "period", "basis"] as const;

export function isReadPath(pathname: string): boolean {
  if (NEVER.some(p => pathname.startsWith(p))) return false;
  if (pathname === "/") return true;
  return PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`));
}

/** The cache key for a request, or null when the request must not be served from or stored in the shared cache. */
export function readCacheKey(req: Pick<Request, "method" | "url" | "headers">, gateOn: boolean): string | null {
  if (gateOn || req.method !== "GET" || req.headers.has("authorization")) return null;
  const url = new URL(req.url);
  if (!isReadPath(url.pathname)) return null;
  const kept = new URLSearchParams();
  for (const k of READ_PARAMS) { const v = url.searchParams.getAll(k); for (const x of v) kept.append(k, x); }
  kept.sort();
  const qs = kept.toString();
  return `${url.origin}${url.pathname}${qs ? `?${qs}` : ""}`;
}

/** Whether a rendered answer may be shared: 200, HTML, no cookie, and no stricter header of its own. */
export function shareable(res: Pick<Response, "status" | "headers">): boolean {
  if (res.status !== 200 || res.headers.has("set-cookie")) return false;
  if (!(res.headers.get("content-type") ?? "").includes("text/html")) return false;
  const cc = (res.headers.get("cache-control") ?? "").toLowerCase();
  return !/(no-store|private)/.test(cc);
}
