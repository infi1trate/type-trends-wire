import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// L2 · the wire job's former tail (story build, then the records sweep) in its own scheduled pass. Managed schedule only.
export const Route = createFileRoute("/api/public/jobs/wire-followups")({
  server: { handlers: { POST: async ({ request }) => {
    const authFailure = await authenticateCronRequest(request);
    if (authFailure) return authFailure;
    let body: unknown = null; try { body = await request.json(); } catch { /* invalid */ }
    if (!body || typeof body !== "object" || (body as { kind?: unknown }).kind !== "wire-followups") return Response.json({ error: "Expected {\"kind\":\"wire-followups\"}" }, { status: 400 });
    const [{ supabaseAdmin }, { runWireFollowups }] = await Promise.all([import("@/integrations/supabase/client.server"), import("@/lib/jobs/wire-followups.server")]);
    const r = await runWireFollowups(supabaseAdmin);
    return Response.json({ ran: r.ran, why: r.why, ms: r.ms }, { headers: { "cache-control": "no-store" } });
  } } },
});
