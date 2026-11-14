import { createFileRoute } from "@tanstack/react-router";
// Public job health for the GitHub Actions watchdog: no secret, cached 60 s, timestamps/statuses only.
export const Route = createFileRoute("/api/public/health")({
  server: { handlers: { GET: async () => {
    const { healthPayload } = await import("@/lib/health.server");
    const body = await healthPayload();
    return Response.json(body, { headers: { "Cache-Control": "public, max-age=60", "Access-Control-Allow-Origin": "*" } });
  } } },
});
