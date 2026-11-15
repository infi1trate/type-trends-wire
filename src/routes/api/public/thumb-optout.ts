import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/thumb-optout")({
  server: { handlers: { POST: async ({ request }) => {
    const { handleThumbOptout } = await import("@/lib/thumbs-ingest.server");
    return handleThumbOptout(request);
  } } },
});
