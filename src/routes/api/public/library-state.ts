import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/library-state")({
  server: { handlers: { GET: async ({ request }) => {
    const { handleLibraryState } = await import("@/lib/crawl-ingest.server");
    return handleLibraryState(request);
  } } },
});