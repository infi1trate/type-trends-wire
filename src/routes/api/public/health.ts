import { createFileRoute } from "@tanstack/react-router";
// Public job health for the GitHub Actions watchdog: no secret, cached 60 s, timestamps/statuses only. N5: plus `build`, the short
// commit of the running build (nothing else about the response changes).
export const Route = createFileRoute("/api/public/health")({
  server: { handlers: { GET: async () => {
    const [{ healthWithin }, { BUILD }] = await Promise.all([import("@/lib/health.server"), import("@/lib/build-stamp")]);
    // S1 · answered within HEALTH_DEADLINE_MS whatever the database does: a slow database gets its own line (and the last answer, if any).
    const { body, slow } = await healthWithin();
    return Response.json({ ...body, build: BUILD }, { headers: { "Cache-Control": slow ? "no-store" : "public, max-age=60", "Access-Control-Allow-Origin": "*" } });
  } } },
});
