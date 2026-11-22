import { createFileRoute } from "@tanstack/react-router";
// Gated like any page (not in OPEN_PATHS): crop images are shown only to readers inside the gate.
export const Route = createFileRoute("/crops/$")({
  server: { handlers: { GET: async ({ params }) => {
    const path = params._splat ?? "";
    // W3a · museum thumbnails share the bucket in their own folder and are served only while their work is not removed.
    if (path.startsWith("art/")) { const { serveArt } = await import("@/lib/art/ingest.server"); return serveArt(path); }
    const { serveCrop } = await import("@/lib/crops-ingest.server");
    return serveCrop(path);
  } } },
});
