import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/thumbs/$")({
  server: { handlers: { GET: async ({ params }) => {
    const { serveThumb } = await import("@/lib/thumbs-ingest.server");
    return serveThumb(params._splat ?? "");
  } } },
});
