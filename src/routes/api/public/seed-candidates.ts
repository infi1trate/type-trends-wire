import { createFileRoute } from "@tanstack/react-router";

// Crawler-secret curated-index seed domains discovered via Are.na and Product Hunt (last 30 days).
export const Route = createFileRoute("/api/public/seed-candidates")({
  server: { handlers: { GET: async ({ request }) => { const { handleSeedCandidates } = await import("@/lib/wire-ingest.server"); return handleSeedCandidates(request); } } },
});
