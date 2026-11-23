import { createFileRoute } from "@tanstack/react-router";

// L2 · the wire job's former tail (story build, then the records sweep) in its own scheduled pass. Managed schedule only.
// T1 · src/server.ts answers this address first when the host offers waitUntil (the work runs after the answer); this route is the
// inline fallback. Authentication happens inside the shared handler before the body is read.
export const Route = createFileRoute("/api/public/jobs/wire-followups")({
  server: { handlers: { POST: async ({ request }) => {
    const { handleWireFollowups } = await import("@/lib/jobs/wire-followups.server");
    return handleWireFollowups(request);
  } } },
});
