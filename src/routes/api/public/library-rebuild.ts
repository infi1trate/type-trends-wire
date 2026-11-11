import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
export const Route = createFileRoute("/api/public/library-rebuild")({
  server: { handlers: { POST: async ({ request }) => {
    const denied = await authenticateCronRequest(request);
    if (denied) return denied;
    if (await request.text() !== "{}") return Response.json({ error: "Expected empty JSON object" }, { status: 400 });
    const { rebuildLibraryHistory } = await import("@/lib/library-replay.server");
    return rebuildLibraryHistory();
  } } },
});