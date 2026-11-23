import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// L3 · the monthly design reading (first day of each month). Managed schedule only; one reading a month, a second attempt is refused.
export const Route = createFileRoute("/api/public/jobs/living-reading")({
  server: { handlers: { POST: async ({ request }) => {
    const authFailure = await authenticateCronRequest(request);
    if (authFailure) return authFailure;
    let body: unknown = null; try { body = await request.json(); } catch { /* invalid */ }
    if (!body || typeof body !== "object" || (body as { kind?: unknown }).kind !== "living-reading") return Response.json({ error: "Expected {\"kind\":\"living-reading\"}" }, { status: 400 });
    // D1 Part 4 · a slow database: stand down at once ("skipped: database slow"); the monthly reading is tried again next month or by hand.
    const { standDown, stoodDown } = await import("@/lib/jobs/gate.server");
    const why = await standDown("living-reading"); if (why) return stoodDown(why);
    const [{ supabaseAdmin }, { runReading }, { startRun }] = await Promise.all([import("@/integrations/supabase/client.server"), import("@/lib/living/reading.server"), import("@/lib/jobs/runs.server")]);
    const h = await startRun("living-reading");
    try {
      const r = await runReading(supabaseAdmin);
      await h.finish(true, r.ok ? r.reading.note : r.refused);
      return Response.json(r.ok ? { ok: true, month: r.reading.month, ready: r.reading.ready, proposed_edition: r.reading.proposed_edition } : r, { headers: { "cache-control": "no-store" } });
    } catch (e) {
      await h.finish(false, e instanceof Error ? e.name : "error");
      console.error("Design reading failed", e instanceof Error ? e.name : "UnknownError");
      return Response.json({ error: "Internal error" }, { status: 500 });
    }
  } } },
});
