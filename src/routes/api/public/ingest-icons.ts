import { createFileRoute } from "@tanstack/react-router";
// W3d · App Store chart icons as measured colours only, one category per post (crawler secret; see src/lib/icons/contract.ts).
export const Route = createFileRoute("/api/public/ingest-icons")({
  server: { handlers: { POST: async ({ request }) => {
    const { handleIconIngest } = await import("@/lib/icons/ingest.server");
    return handleIconIngest(request);
  } } },
});
