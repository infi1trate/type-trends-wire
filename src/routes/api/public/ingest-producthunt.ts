import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { z } from "zod";

export const Route = createFileRoute("/api/public/ingest-producthunt")({
  server: { handlers: { POST: async ({ request }) => {
    const denied = await authenticateCronRequest(request);
    if (denied) return denied;
    // D1 Part 4 · a slow database: stand down at once.
    { const gate = await import("@/lib/jobs/gate.server"); const why = await gate.standDown(null); if (why) return gate.stoodDown(why); }
    const parsed = z.object({}).strict().safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Expected empty JSON object" }, { status: 400 });
    const { ingestProductHunt } = await import("@/lib/sources.server");
    return ingestProductHunt();
  } } },
});
