import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { z } from "zod";

export const Route = createFileRoute("/api/public/ingest-producthunt")({
  server: { handlers: { POST: async ({ request }) => {
    const denied = await authenticateCronRequest(request);
    if (denied) return denied;
    // D1 Part 4 · a slow database: stand down at once.
    { const gate = await import("@/lib/jobs/gate.server"); const why = await gate.standDown("ingest-producthunt"); if (why) return gate.stoodDown(why); }
    const parsed = z.object({}).strict().safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Expected empty JSON object" }, { status: 400 });
    // D1c · a start row and a finish row like every other job: what it fetched, or a plain reason (never the token).
    const [{ ingestProductHunt }, { startRun }, { phReason }] = await Promise.all([import("@/lib/sources.server"), import("@/lib/jobs/runs.server"), import("@/lib/health")]);
    const run = await startRun("ingest-producthunt");
    const res = await ingestProductHunt();
    const body = await res.clone().json().catch(() => null) as { ok?: boolean; dormant?: boolean; reason?: string; seen?: number; rows_written?: number; error?: string } | null;
    if (body?.dormant) await run.finish(false, phReason(body.reason));
    else if (body?.ok) await run.finish(true, `fetched ${body.seen ?? 0} launches, ${body.rows_written ?? 0} new`, { fetched: body.seen ?? 0, written: body.rows_written ?? 0 });
    else await run.finish(false, phReason(body?.error));
    return res;
  } } },
});
