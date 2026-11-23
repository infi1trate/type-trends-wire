import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { z } from "zod";

export const Route = createFileRoute("/api/public/ingest-gfonts")({
  server: { handlers: { POST: async ({ request }) => {
    const denied = await authenticateCronRequest(request);
    if (denied) return denied;
    // D1 Part 4 · a slow database: stand down at once.
    { const gate = await import("@/lib/jobs/gate.server"); const why = await gate.standDown("ingest-gfonts"); if (why) return gate.stoodDown(why); }
    const parsed = z.object({}).strict().safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Expected empty JSON object" }, { status: 400 });
    // D1c · start and finish rows like every other scheduled job (what it wrote, or the error's first words; no key).
    const [{ ingestFonts }, { startRun }] = await Promise.all([import("@/lib/ingest.server"), import("@/lib/jobs/runs.server")]);
    const run = await startRun("ingest-gfonts");
    const res = await ingestFonts();
    const body = await res.clone().json().catch(() => null) as { ok?: boolean; families?: number; error?: string } | null;
    await run.finish(!!body?.ok, body?.ok ? `${body.families ?? 0} families written` : `failed: ${(body?.error ?? "no reason recorded").slice(0, 80)}`);
    return res;
  } } },
});