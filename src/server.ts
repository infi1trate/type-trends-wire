import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { gate, GATE_ENABLED } from "./lib/gate";
import { createPageCache, servePage } from "./lib/page-cache";
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
      if (new URL(request.url).pathname === "/api/public/mcp") {
        const { handleMcp } = await import("./lib/mcp/server.server");
        return await handleMcp(request);
      }
      // P1/I1: public Read pages are the same for every visitor; serve a copy drawn in the last five minutes when there is one.
      const c = ctx as { waitUntil?: (p: Promise<unknown>) => void } | undefined;
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
