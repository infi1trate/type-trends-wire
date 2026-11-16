import { createFileRoute } from "@tanstack/react-router";

// The front page's changeable parts (lead id, live column items, moving now, freshness) for polling; gated like the pages.
export const Route = createFileRoute("/front.json")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        try {
          const [{ loadFrontUpdates }, { updatesResponse }] = await Promise.all([import("@/lib/front/front.server"), import("@/lib/front/updates")]);
          return await updatesResponse(await loadFrontUpdates(url.searchParams.get("sector")?.slice(0, 40), url.searchParams.get("format")?.slice(0, 20)), request.headers.get("if-none-match"));
        } catch {
          return new Response(JSON.stringify({ error: "unavailable" }), { status: 503, headers: { "Content-Type": "application/json; charset=utf-8", "Retry-After": "60", "Cache-Control": "no-store" } });
        }
      },
    },
  },
});
