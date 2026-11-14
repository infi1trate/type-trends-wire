import { createFileRoute } from "@tanstack/react-router";

// Crawler-secret discourse vocabulary for the Bluesky Jetstream sampler.
export const Route = createFileRoute("/api/public/discourse-terms")({
  server: { handlers: { GET: async ({ request }) => { const { handleDiscourseTerms } = await import("@/lib/wire-ingest.server"); return handleDiscourseTerms(request); } } },
});
