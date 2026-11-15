import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/forecast-run")({ server: { handlers: { POST: async ({ request }) => {
  const { handleForecastRun } = await import("@/lib/forecast-run.server");
  return handleForecastRun(request);
} } } });
