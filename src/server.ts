import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { gate, GATE_ENABLED } from "./lib/gate";
import { SERVER_PAGES, servePage } from "./lib/page-cache";
import { retryLater } from "./lib/unavailable";
import { movedObjectHref } from "./lib/ia";
import { instanceClock, withInstanceHeaders } from "./lib/instance";
import { startFirstPaint } from "./lib/first-paint.server";

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
const pages = SERVER_PAGES;

// Hosting compresses every response at the edge. Never compress a body (gzip, brotli,
// CompressionStream) or set content-encoding here or in a server route: the body gets encoded
// twice and renders garbled.
/** C1 Part 1 · this instance's age and request count, sent on every response (instance.ts). */
const clock = instanceClock();

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const seen = clock.seen();
    return withInstanceHeaders(await answer(request, env, ctx), seen);
  },
};
async function answer(request: Request, env: unknown, ctx: unknown): Promise<Response> {
    try {
      // Shared-password gate runs before any SSR so locked visitors get no page data or meta.
      const gated = await gate(request);
      if (gated) return gated;
      // U1: old object addresses move to the object's one address (Data view) in a single permanent redirect, keeping every parameter.
      if (request.method === "GET") {
        const u = new URL(request.url), moved = movedObjectHref(u.pathname, Object.fromEntries(u.searchParams));
        if (moved) return new Response(null, { status: 301, headers: { location: moved } });
      }
      // C1b Part 2 · pictures are answered here, before any page code or database client loads (pictures-serve.server.ts); the route
      // files stay as the fallback for anything else (HEAD, other methods).
      if (request.method === "GET") {
        const p = new URL(request.url).pathname, route = p.startsWith("/thumbs/") ? "thumbs" : p.startsWith("/crops/") ? "crops" : null;
        if (route) {
          let path: string | null = null;
          try { path = decodeURIComponent(p.slice(route.length + 2)); } catch { path = null; }
          const { servePicture } = await import("./lib/pictures-serve.server");
          return await servePicture(route, path ?? "");
        }
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
      // D1 Part 5 · DEV ONLY: `?__copy=1` turns the copy on for the rehearsal of readers on last good copies, `&__dbdown=1` makes the
      // database read as down for that request.
      const rehearse = import.meta.env.DEV && new URL(request.url).searchParams.get("__copy") === "1";
      const waitUntil = hostWaitUntil(request, c);
      return await servePage(request, GATE_ENABLED || (import.meta.env.DEV && !rehearse), pages, async () => {
        // C1b · the page's announced picture (first-paint.server.ts) starts reading now, while the page code loads, so the first flush
        // can name it without waiting.
        if (request.method === "GET") startFirstPaint(new URL(request.url));
        const handler = await getServerEntry();
        const response = await handler.fetch(request, env, ctx);
        // A page whose stored-data read gave up (Retry-After set by the read) answers 503, not 500.
        return retryLater(await normalizeCatastrophicSsrResponse(response));
      }, waitUntil, { preferLastGood: rehearse && new URL(request.url).searchParams.get("__dbdown") === "1", degraded: async () => {
        if (rehearse) return new URL(request.url).searchParams.get("__dbdown") === "1";
        if (!(await (await import("./lib/db-probe.server")).probeDb()).ok) return true;
        return (await (await import("./lib/safe-mode.server")).safeModeOn()).on;
      } });
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
}
