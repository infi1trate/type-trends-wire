import { createFileRoute } from "@tanstack/react-router";
// M2a · App Store listings, stored only (crawler secret; see src/lib/listings/contract.ts). No page reads these tables yet.
export const Route = createFileRoute("/api/public/ingest-listings")({
  server: { handlers: { POST: async ({ request }) => {
    const { handleListingIngest } = await import("@/lib/listings/ingest.server");
    return handleListingIngest(request);
  } } },
});
