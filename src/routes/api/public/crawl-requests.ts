import { createFileRoute } from "@tanstack/react-router";

// Crawler-secret authenticated LITE render queue; see methodology / README for the contract.
export const Route = createFileRoute("/api/public/crawl-requests")({
  server: { handlers: {
    GET: async ({ request }) => { const { handleCrawlRequestsGet } = await import("@/lib/crawl-requests.server"); return handleCrawlRequestsGet(request); },
    POST: async ({ request }) => { const { handleCrawlRequestsPost } = await import("@/lib/crawl-requests.server"); return handleCrawlRequestsPost(request); },
  } },
});
