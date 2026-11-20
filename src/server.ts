import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { gate, GATE_ENABLED } from "./lib/gate";
import { READ_CACHE_CONTROL, READ_CACHE_SECONDS, readCacheKey, shareable } from "./lib/edge-cache";
import { retryLater } from "./lib/unavailable";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

/** The server's named page cache (Cache API). Absent in the dev server and wherever the runtime has none: pages then carry only the
 *  shared-cache header. Opened once per instance. */
let cacheP: Promise<Cache | null> | undefined;
function pageCache(): Promise<Cache | null> {
  if (!cacheP) cacheP = typeof caches !== "undefined" && typeof caches.open === "function" ? caches.open("read-pages").catch(() => null) : Promise.resolve(null);
  return cacheP;
}

// Hosting compresses every response at the edge. Never compress a body (gzip, brotli,
// CompressionStream) or set content-encoding here or in a server route: the body gets encoded
// twice and renders garbled.
export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      // Shared-password gate runs before any SSR so locked visitors get no page data or meta.
      const gated = await gate(request);
      if (gated) return gated;
      if (new URL(request.url).pathname === "/api/public/mcp") {
        const { handleMcp } = await import("./lib/mcp/server.server");
        return await handleMcp(request);
      }
      // P1: public Read pages are the same for every visitor; serve a copy drawn in the last five minutes when there is one.
      const key = readCacheKey(request, GATE_ENABLED), cache = key ? await pageCache() : null;
      if (key && cache) {
        const hit = await cache.match(key).catch(() => undefined);
        if (hit) { const h = new Headers(hit.headers); h.set("x-read-cache", "hit"); h.set("cache-control", READ_CACHE_CONTROL); return new Response(hit.body, { status: hit.status, headers: h }); }
      }
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      // A page whose stored-data read gave up (Retry-After set by the read) answers 503, not 500.
      const out = retryLater(await normalizeCatastrophicSsrResponse(response));
      if (!key || !shareable(out)) return out;
      const headers = new Headers(out.headers);
      headers.set("cache-control", READ_CACHE_CONTROL);
      if (!cache || !out.body) return new Response(out.body, { status: out.status, headers });
      // Stream to the visitor and, in the background, keep one copy (the cache's own clock is the five minutes).
      const [mine, kept] = out.body.tee();
      const stored = new Headers(headers); stored.set("cache-control", `public, max-age=${READ_CACHE_SECONDS}`);
      const put = cache.put(key, new Response(kept, { status: 200, headers: stored })).catch(() => undefined);
      const c = ctx as { waitUntil?: (p: Promise<unknown>) => void } | undefined;
      if (typeof c?.waitUntil === "function") c.waitUntil(put);
      headers.set("x-read-cache", "miss");
      return new Response(mine, { status: out.status, headers });
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
