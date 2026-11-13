import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
export const Route = createFileRoute("/api/public/forecast-run")({ server: { handlers: { POST: async ({ request }) => {
  const denied = await authenticateCronRequest(request); if (denied) return denied;
  const body = await request.text(); if (body !== "{}" && body !== '{"kind":"weekly"}') return Response.json({ ok: false, code: "invalid_input" }, { status: 400 });
  try { const { runForecast } = await import("@/lib/forecast.server"); return Response.json(await runForecast()); }
  catch { return Response.json({ ok: false, code: "forecast_failed" }, { status: 500 }); }
} } } });
