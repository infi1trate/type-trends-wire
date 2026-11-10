import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/ingest-crawl")({
  server: { handlers: { POST: async ({ request }) => {
    const { handleCrawlIngest } = await import("@/lib/crawl-ingest.server");
    return handleCrawlIngest(request);
  } } },
});