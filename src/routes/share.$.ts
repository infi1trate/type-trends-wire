import { createFileRoute } from "@tanstack/react-router";
// /share/<kind>/<id>.png: 1200×630 share cards for the front page, stories, brands, patterns, collections, the Morning Line and sector
// reports (lib/share). Gated like every page until launch: social crawlers can fetch it only once /share/ is added to OPEN_PATHS.
export const Route = createFileRoute("/share/$")({ server: { handlers: { GET: async ({ params }) => {
  const { parseSharePath } = await import("@/lib/share/scene");
  const p = parseSharePath(params._splat ?? "");
  if (!p) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const { shareImage } = await import("@/lib/share/share.server");
  return shareImage(p.kind, p.id, p.format);
} } } });
