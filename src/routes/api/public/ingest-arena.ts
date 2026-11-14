import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { z } from "zod";

// Are.na is hard-off (ARENA_ENABLED=false in src/lib/sources.ts, acceptable-use policy); this route refuses to run.
export const Route = createFileRoute("/api/public/ingest-arena")({
  server: { handlers: { POST: async ({ request }) => {
    const denied = await authenticateCronRequest(request);
    if (denied) return denied;
    const parsed = z.object({}).strict().safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Expected empty JSON object" }, { status: 400 });
    const { ingestArena } = await import("@/lib/sources.server");
    return ingestArena();
  } } },
});
