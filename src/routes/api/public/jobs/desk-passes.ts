import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// N4b · the graphics desk's share-image and study-chart checks, one small pass per scheduled call (passes.ts). Managed schedule only.
export const Route = createFileRoute("/api/public/jobs/desk-passes")({
  server: { handlers: { POST: async ({ request }) => {
    const authFailure = await authenticateCronRequest(request);
    if (authFailure) return authFailure;
    let body: unknown = null; try { body = await request.json(); } catch { /* invalid */ }
    if (!body || typeof body !== "object" || (body as { kind?: unknown }).kind !== "desk-passes") return Response.json({ error: "Expected {\"kind\":\"desk-passes\"}" }, { status: 400 });
    const [{ supabaseAdmin }, { runDeskPass }] = await Promise.all([import("@/integrations/supabase/client.server"), import("@/lib/newsroom/passes.server")]);
    const r = await runDeskPass(supabaseAdmin);
    return Response.json({ ran: r.ran, why: r.why, check: r.check, pass: r.pass, ms: r.ms }, { headers: { "cache-control": "no-store" } });
  } } },
});
