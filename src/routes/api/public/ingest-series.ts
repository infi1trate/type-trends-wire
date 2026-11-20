import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/ingest-series")({
  server: { handlers: { POST: async ({ request }) => {
    const { handleSeriesIngest } = await import("@/lib/indicators/ingest.server");
    return handleSeriesIngest(request);
  } } },
});
