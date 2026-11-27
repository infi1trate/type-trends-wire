import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// N4c · story review's own scheduled pass (and, when it is quiet, the story writer's pass) (review-pass.ts): at most two stories, picture check, standards, editor in chief. Managed schedule only.
export const Route = createFileRoute("/api/public/jobs/review-passes")({
  server: { handlers: { POST: async ({ request }) => {
    const authFailure = await authenticateCronRequest(request);
    if (authFailure) return authFailure;
    let body: unknown = null; try { body = await request.json(); } catch { /* invalid */ }
    if (!body || typeof body !== "object" || (body as { kind?: unknown }).kind !== "review-passes") return Response.json({ error: "Expected {\"kind\":\"review-passes\"}" }, { status: 400 });
    // D1 Part 4 · a slow database: stand down at once ("skipped: database slow").
    const { standDown, stoodDown } = await import("@/lib/jobs/gate.server");
    const why = await standDown("review-passes"); if (why) return stoodDown(why);
    const [{ supabaseAdmin }, { runReviewPass }] = await Promise.all([import("@/integrations/supabase/client.server"), import("@/lib/newsroom/review-pass.server")]);
    const t0 = Date.now(), r = await runReviewPass(supabaseAdmin);
    // Writer pass · a quiet review pass (nothing waiting, no drafts call, or review held) gives its idle time to the story writer: the
    // first story of the writer's queue, inside this handler's time (writer-pass.ts). Not when the clock was busy or another pass ran.
    const quiet = !r.items.length && !r.drafts && (r.why === "nothing waiting" || r.why === "held");
    const writer = quiet ? await (await import("@/lib/stories/writer-pass.server")).runWriterPass(supabaseAdmin as never, t0) : null;
    return Response.json({ ran: r.ran, why: r.why, items: r.items, ms: r.ms, writer: writer ? { ran: writer.ran, note: writer.note, story: writer.story } : null }, { headers: { "cache-control": "no-store" } });
  } } },
});
