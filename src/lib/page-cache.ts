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
export type PageCache = { get(key: string): Entry | null; put(key: string, e: Omit<Entry, "at">): void; size(): number; clear(): void };

/** A small LRU with a time limit: reads move an entry to the newest end; a put beyond `max` drops the oldest. */
export function createPageCache(o: { max?: number; ttlMs?: number; now?: () => number } = {}): PageCache {
  const max = o.max ?? PAGE_CACHE_MAX, ttl = o.ttlMs ?? PAGE_CACHE_MS, now = o.now ?? Date.now, m = new Map<string, Entry>();
  return {
    get(key) {
      const e = m.get(key);
      if (!e) return null;
      if (now() - e.at >= ttl) { m.delete(key); return null; }
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

const HOP = new Set(["content-length", "content-encoding", "transfer-encoding", "connection", "set-cookie", "x-read-cache"]);
/**
 * Serve one request through the page cache: a fresh copy answers `x-read-cache: hit`; otherwise the page is rendered, streamed to
 * the visitor at once, and (when shareable) kept after its body finishes. Requests that must never be cached pass straight through.
 */
export async function servePage(request: Request, gateOn: boolean, cache: PageCache, render: () => Promise<Response>, waitUntil?: (p: Promise<unknown>) => void): Promise<Response> {
  const key = readCacheKey(request, gateOn);
  if (!key) return render();
  const hit = cache.get(key);
  if (hit) {
    const h = new Headers(hit.headers);
    h.set("cache-control", READ_CACHE_CONTROL); h.set(CDN_CACHE_HEADER, READ_CACHE_CONTROL); h.set("x-read-cache", "hit");
    h.set("age", String(Math.max(0, Math.floor((Date.now() - hit.at) / 1000))));
    return new Response(hit.body, { status: hit.status, headers: h });
  }
  const out = await render();
  if (!shareable(out)) return out;
  const headers = new Headers(out.headers);
  headers.set("cache-control", READ_CACHE_CONTROL); headers.set(CDN_CACHE_HEADER, READ_CACHE_CONTROL); headers.set("x-read-cache", "miss");
  if (!out.body) return new Response(null, { status: out.status, headers });
  const [mine, kept] = out.body.tee();
  const stored = [...headers.entries()].filter(([k]) => !HOP.has(k.toLowerCase()));
  const keep = new Response(kept).text().then(body => { cache.put(key, { status: out.status, headers: stored, body }); }).catch(() => undefined);
  if (waitUntil) waitUntil(keep);
  return new Response(mine, { status: out.status, headers });
}
