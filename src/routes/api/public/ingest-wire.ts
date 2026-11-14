import { createFileRoute } from "@tanstack/react-router";

// Two callers: the managed 15-minute schedule (cron credential, `{}` → RSS/HN poll) and the
// Jetstream sampler (crawler secret, `{kind:'items'|'mentions'}`); see README / methodology.
export const Route = createFileRoute("/api/public/ingest-wire")({
  server: { handlers: { POST: async ({ request }) => {
    const { handleIngestWire } = await import("@/lib/wire-ingest.server");
    return handleIngestWire(request);
  } } },
});
