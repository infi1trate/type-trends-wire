import { createFileRoute } from "@tanstack/react-router";

// Crawler-secret curated-index seed domains discovered via Product Hunt (Are.na is not used) (last 30 days).
export const Route = createFileRoute("/api/public/seed-candidates")({
  server: { handlers: { GET: async ({ request }) => { const { handleSeedCandidates } = await import("@/lib/wire-ingest.server"); return handleSeedCandidates(request); } } },
});
