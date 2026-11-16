import { createFileRoute } from "@tanstack/react-router";
// Gated like any page (not in OPEN_PATHS): crop images are shown only to readers inside the gate.
export const Route = createFileRoute("/crops/$")({
  server: { handlers: { GET: async ({ params }) => {
    const { serveCrop } = await import("@/lib/crops-ingest.server");
    return serveCrop(params._splat ?? "");
  } } },
});
