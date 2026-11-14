import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
// On-demand (re)generation of the latest brief's Chart of the Week. Managed cron credential only.
export const Route = createFileRoute("/api/public/chart-card")({ server: { handlers: { POST: async ({ request }) => {
  const denied = await authenticateCronRequest(request); if (denied) return denied;
  const body = await request.text(); if (body !== "{}") return Response.json({ ok: false, code: "invalid_input" }, { status: 400 });
  try { const { generateChartCard } = await import("@/lib/chart/chart.server"); return Response.json(await generateChartCard()); }
  catch { return Response.json({ ok: false, code: "chart_failed" }, { status: 500 }); }
} } } });
