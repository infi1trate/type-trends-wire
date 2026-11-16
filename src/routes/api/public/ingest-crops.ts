import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/ingest-crops")({
  server: { handlers: { POST: async ({ request }) => {
    const { handleCropIngest } = await import("@/lib/crops-ingest.server");
    return handleCropIngest(request);
  } } },
});
