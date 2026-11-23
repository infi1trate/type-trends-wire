import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { gate, GATE_ENABLED } from "./lib/gate";
import { createPageCache, servePage } from "./lib/page-cache";
import { retryLater } from "./lib/unavailable";
import { movedObjectHref } from "./lib/ia";

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

type WaitUntil = (p: Promise<unknown>) => void;
/** The host's waitUntil, wherever this runtime puts it: the worker context argument, or (behind the Nitro Cloudflare handler, which
 *  calls the entry with the request only) the `waitUntil` / `runtime.cloudflare.context` it attaches to the request. */
function hostWaitUntil(request: Request, ctx: { waitUntil?: WaitUntil } | undefined): WaitUntil | undefined {
  if (typeof ctx?.waitUntil === "function") return p => ctx.waitUntil!(p);
  const r = request as Request & { waitUntil?: WaitUntil; runtime?: { cloudflare?: { context?: { waitUntil?: WaitUntil } } } };
  if (typeof r.waitUntil === "function") return p => r.waitUntil!(p);
  const cf = r.runtime?.cloudflare?.context;
  if (typeof cf?.waitUntil === "function") return p => cf.waitUntil!(p);
  return undefined;
}

/** Public Read pages kept in memory for five minutes per server instance (page-cache.ts: the host's Cache API is a no-op). */
const pages = createPageCache();

// Hosting compresses every response at the edge. Never compress a body (gzip, brotli,
// CompressionStream) or set content-encoding here or in a server route: the body gets encoded
// twice and renders garbled.
export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      // Shared-password gate runs before any SSR so locked visitors get no page data or meta.
      const gated = await gate(request);
      if (gated) return gated;
      // U1: old object addresses move to the object's one address (Data view) in a single permanent redirect, keeping every parameter.
      if (request.method === "GET") {
        const u = new URL(request.url), moved = movedObjectHref(u.pathname, Object.fromEntries(u.searchParams));
        if (moved) return new Response(null, { status: 301, headers: { location: moved } });
      }
      if (new URL(request.url).pathname === "/api/public/mcp") {
        const { handleMcp } = await import("./lib/mcp/server.server");
        return await handleMcp(request);
      }
      const c = ctx as { waitUntil?: (p: Promise<unknown>) => void } | undefined;
      // The crawl intake answers as soon as a batch is stored and runs its card refresh after the response when the host offers
      // waitUntil (crawl-ingest.server.ts); the route file stays as the inline fallback.
      if (request.method === "POST" && new URL(request.url).pathname === "/api/public/ingest-crawl") {
        const { handleCrawlIngest } = await import("./lib/crawl-ingest.server");
        const waitUntil = hostWaitUntil(request, c);
        return await handleCrawlIngest(request, waitUntil ? { waitUntil } : {});
      }
      // T1 · the wire follow-ups pass answers its scheduled caller at once (which gives up after five seconds) and finishes its work
      // after the answer through waitUntil; the route file stays as the inline fallback.
      if (request.method === "POST" && new URL(request.url).pathname === "/api/public/jobs/wire-followups") {
        const waitUntil = hostWaitUntil(request, c);
        if (waitUntil) {
          const { handleWireFollowups } = await import("./lib/jobs/wire-followups.server");
          return await handleWireFollowups(request, { waitUntil });
        }
      }
      // T1 · DEV ONLY: `?__cold=1` empties every per-instance memo first, so the page is drawn the way a fresh instance draws it.
      if (import.meta.env.DEV && request.method === "GET" && new URL(request.url).searchParams.get("__cold") === "1") (await import("./lib/memo")).clearAllMemosForDev();
      // P1/I1: public Read pages are the same for every visitor; serve a copy drawn in the last five minutes when there is one.
      // The dev server skips the copy (code changes between requests would serve stale pages); the live host keeps it.
      return await servePage(request, GATE_ENABLED || import.meta.env.DEV, pages, async () => {
        const handler = await getServerEntry();
        const response = await handler.fetch(request, env, ctx);
        // A page whose stored-data read gave up (Retry-After set by the read) answers 503, not 500.
        return retryLater(await normalizeCatastrophicSsrResponse(response));
      }, typeof c?.waitUntil === "function" ? p => c.waitUntil!(p) : undefined);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
