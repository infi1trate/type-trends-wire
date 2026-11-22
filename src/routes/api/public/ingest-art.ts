import { createFileRoute } from "@tanstack/react-router";
// W3a · museum works from the crawler's hand-started job (crawler secret; see src/lib/art/contract.ts).
export const Route = createFileRoute("/api/public/ingest-art")({
  server: { handlers: { POST: async ({ request }) => {
    const { handleArtIngest } = await import("@/lib/art/ingest.server");
    return handleArtIngest(request);
  } } },
});
