import { createFileRoute } from "@tanstack/react-router";
// Public job health for the GitHub Actions watchdog: no secret, cached 60 s, timestamps/statuses only. N5: plus `build`, the short
// commit of the running build (nothing else about the response changes).
export const Route = createFileRoute("/api/public/health")({
  server: { handlers: { GET: async () => {
    const [{ healthPayload }, { BUILD }] = await Promise.all([import("@/lib/health.server"), import("@/lib/build-stamp")]);
    const body = await healthPayload();
    return Response.json({ ...body, build: BUILD }, { headers: { "Cache-Control": "public, max-age=60", "Access-Control-Allow-Origin": "*" } });
  } } },
});
