import { createFileRoute } from "@tanstack/react-router";
import { createRateLimiter } from "@/lib/mcp/rate-limit";
// Per-watchlist RSS. Open (capability URL): RSS readers can't pass the site password; an unguessable, rotatable token protects it.
const allowed = createRateLimiter(60, 60_000);
export const Route = createFileRoute("/api/public/watch-feed/{$token}.xml")({ server: { handlers: { GET: async ({ params, request }) => {
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!allowed(ip)) return new Response("Rate limited", { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  const m = await import("@/lib/agency/watch.server");
  return m.handleWatchFeed(params.token, await m.prodDeps("check"));
} } } });
