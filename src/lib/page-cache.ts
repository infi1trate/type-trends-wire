// I1 · Part 0: the server's own copy of public Read pages. The hosting runtime's Cache API is a no-op (every request on the live
// host answered x-read-cache: miss, and the host documents that the standard Cache API does not work there), so pages are kept in
// memory per server instance instead: the same key and never-cache rules as edge-cache.ts, five minutes, at most 60 pages, the
// oldest dropped first. A copy is stored only once its whole body has been read, never a pending stream.
import { READ_CACHE_CONTROL, READ_CACHE_SECONDS, readCacheKey, shareable } from "./edge-cache";

export const PAGE_CACHE_MAX = 60;
export const PAGE_CACHE_MS = READ_CACHE_SECONDS * 1000;
/** A page larger than this is served but not kept, so 60 copies stay a bounded amount of memory (pages budget < 200 KB). */
export const PAGE_CACHE_MAX_CHARS = 512 * 1024;
/** Also sent for shared caches that read it (the host rewrites Cache-Control on page addresses without a file extension). */
export const CDN_CACHE_HEADER = "cdn-cache-control";

type Entry = { at: number; status: number; headers: [string, string][]; body: string };
/** `get`: a copy younger than the time limit. `peek`: the last good copy whatever its age (D1 Part 5: kept until replaced or pushed
 *  out by newer pages, never dropped for age). */
export type PageCache = { get(key: string): Entry | null; peek(key: string): Entry | null; put(key: string, e: Omit<Entry, "at">): void; size(): number; clear(): void };

/** A small LRU with a time limit: reads move an entry to the newest end; a put beyond `max` drops the oldest. */
export function createPageCache(o: { max?: number; ttlMs?: number; now?: () => number } = {}): PageCache {
  const max = o.max ?? PAGE_CACHE_MAX, ttl = o.ttlMs ?? PAGE_CACHE_MS, now = o.now ?? Date.now, m = new Map<string, Entry>();
  return {
    get(key) {
      const e = m.get(key);
      if (!e || now() - e.at >= ttl) return null;
      m.delete(key); m.set(key, e);
      return e;
    },
    peek(key) {
      const e = m.get(key);
      if (!e) return null;
      m.delete(key); m.set(key, e);
      return e;
    },
    put(key, e) {
      if (e.body.length > PAGE_CACHE_MAX_CHARS) return;
      m.delete(key); m.set(key, { ...e, at: now() });
      while (m.size > max) { const oldest = m.keys().next().value; if (oldest === undefined) break; m.delete(oldest); }
    },
    size: () => m.size,
    clear: () => m.clear(),
  };
}

/** The one per-server copy of public Read pages (src/server.ts serves through it; a removal clears it on the server that took it). */
export const SERVER_PAGES = createPageCache();
const HOP = new Set(["content-length", "content-encoding", "transfer-encoding", "connection", "set-cookie", "x-read-cache"]);
/** D1 Part 5 · a stale copy younger than this is sent at once and redrawn behind the reader's back; older ones are redrawn first. */
export const STALE_SERVE_MAX_MS = 60 * 60_000;
/** Pages kept only as a last good copy (never served fresh from the copy): the Terminal, whose first panel must still show when the
 *  database is down. */
const LAST_GOOD_ONLY = ["/terminal"] as const;
export function lastGoodKey(req: Pick<Request, "method" | "url" | "headers">, gateOn: boolean): string | null {
  if (gateOn || req.method !== "GET" || req.headers.has("authorization")) return null;
  const url = new URL(req.url);
  if (!LAST_GOOD_ONLY.some(p => url.pathname === p)) return null;
  const kept = new URLSearchParams([...url.searchParams].filter(([k]) => !k.startsWith("__") && !/^utm_|^fbclid$/.test(k)));
  kept.sort();
  return `lastgood:${url.origin}${url.pathname}${kept.size ? `?${kept}` : ""}`;
}
/** A page whose deferred parts failed while it was drawn (their failed line is in it) is never kept as a last good copy. */
export const hasFailedPart = (body: string) => body.includes("data-later-failed") || body.includes("data-part-failed");
/** The copy's time, for the quiet "this page is from …" line (read after hydration; React skips unknown tags in head). */
export const COPY_META = "slug-copy-at";
function withCopyMeta(body: string, at: number): string {
  const tag = `<meta name="${COPY_META}" content="${new Date(at).toISOString()}">`;
  const i = body.indexOf("</head>");
  return i < 0 ? body : `${body.slice(0, i)}${tag}${body.slice(i)}`;
}
export type ServeOptions = { /** The database is slow or down (or the site is in safe mode): readers get the last good copy. */ degraded?: () => Promise<boolean>; now?: () => number;
  /** DEV rehearsal only: send the last good copy (with its line) even when a fresh one exists. */ preferLastGood?: boolean };

/**
 * Serve one request through the page cache: a fresh copy answers `x-read-cache: hit`; otherwise the page is rendered, streamed to
 * the visitor at once, and (when shareable) kept after its body finishes. Requests that must never be cached pass straight through.
 * D1 Part 5 · readers only (jobs never come through here): with the database slow or down, or a render that fails, the last good copy
 * is sent whatever its age (`x-read-cache: last-good`, with its time for the page's quiet line); a copy past five minutes but under an
 * hour is sent at once and redrawn after the answer (`stale`).
 */
export async function servePage(request: Request, gateOn: boolean, cache: PageCache, render: () => Promise<Response>, waitUntil?: (p: Promise<unknown>) => void, o: ServeOptions = {}): Promise<Response> {
  const readKey = readCacheKey(request, gateOn), key = readKey ?? lastGoodKey(request, gateOn);
  if (!key) return render();
  const now = o.now ?? Date.now, lastGoodOnly = !readKey;
  const copy = (e: Entry, kind: "hit" | "stale" | "last-good") => {
    const h = new Headers(e.headers);
    if (!lastGoodOnly) { h.set("cache-control", READ_CACHE_CONTROL); h.set(CDN_CACHE_HEADER, READ_CACHE_CONTROL); } else h.set("cache-control", "no-store");
    h.set("x-read-cache", kind);
    h.set("age", String(Math.max(0, Math.floor((now() - e.at) / 1000))));
    return new Response(kind === "last-good" ? withCopyMeta(e.body, e.at) : e.body, { status: e.status, headers: h });
  };
  if (o.preferLastGood) { const e = cache.peek(key); if (e) return copy(e, "last-good"); }
  const hit = lastGoodOnly ? null : cache.get(key);
  if (hit) return copy(hit, "hit");
  const old = cache.peek(key);
  const keep = (out: Response): Response => {
    if (!shareable(out)) return out;
    const headers = new Headers(out.headers);
    if (!lastGoodOnly) { headers.set("cache-control", READ_CACHE_CONTROL); headers.set(CDN_CACHE_HEADER, READ_CACHE_CONTROL); headers.set("x-read-cache", "miss"); }
    if (!out.body) return new Response(null, { status: out.status, headers });
    const [mine, kept] = out.body.tee();
    const stored = [...headers.entries()].filter(([k]) => !HOP.has(k.toLowerCase()));
    const p = new Response(kept).text().then(body => { if (!hasFailedPart(body)) cache.put(key, { status: out.status, headers: stored, body }); }).catch(() => undefined);
    if (waitUntil) waitUntil(p);
    return new Response(mine, { status: out.status, headers });
  };
  // A copy past its five minutes but under an hour: sent now, redrawn after the answer (only when the host keeps that work alive).
  if (old && !lastGoodOnly && waitUntil && now() - old.at < STALE_SERVE_MAX_MS) {
    waitUntil(render().then(r => { const k = keep(r); return k.body ? new Response(k.body).arrayBuffer() : null; }).catch(() => undefined));
    return copy(old, "stale");
  }
  // Only a page about to be drawn now asks whether the database is answering (a fresh or stale copy never does).
  if (old && o.degraded && await o.degraded().catch(() => false)) return copy(old, "last-good");
  let out: Response | null = null;
  try { out = await render(); } catch { out = null; }
  if ((!out || out.status >= 500) && old) return copy(old, "last-good");
  if (!out) throw new Error("render failed");
  return keep(out);
}
