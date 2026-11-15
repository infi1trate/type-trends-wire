import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/ingest-thumbs")({
  server: { handlers: { POST: async ({ request }) => {
    const { handleThumbIngest } = await import("@/lib/thumbs-ingest.server");
    return handleThumbIngest(request);
  } } },
});
