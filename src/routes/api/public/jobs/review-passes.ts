import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// N4c · story review's own scheduled pass (review-pass.ts): at most two stories, picture check, standards, editor in chief. Managed schedule only.
export const Route = createFileRoute("/api/public/jobs/review-passes")({
  server: { handlers: { POST: async ({ request }) => {
    const authFailure = await authenticateCronRequest(request);
    if (authFailure) return authFailure;
    let body: unknown = null; try { body = await request.json(); } catch { /* invalid */ }
    if (!body || typeof body !== "object" || (body as { kind?: unknown }).kind !== "review-passes") return Response.json({ error: "Expected {\"kind\":\"review-passes\"}" }, { status: 400 });
    const [{ supabaseAdmin }, { runReviewPass }] = await Promise.all([import("@/integrations/supabase/client.server"), import("@/lib/newsroom/review-pass.server")]);
    const r = await runReviewPass(supabaseAdmin);
    return Response.json({ ran: r.ran, why: r.why, items: r.items, ms: r.ms }, { headers: { "cache-control": "no-store" } });
  } } },
});
