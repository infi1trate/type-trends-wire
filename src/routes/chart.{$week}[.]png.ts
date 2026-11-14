import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/chart/{$week}.png")({ server: { handlers: { GET: async ({ params }) => {
  const { chartImageResponse } = await import("@/lib/chart/http.server");
  return chartImageResponse(params.week, "png");
} } } });
