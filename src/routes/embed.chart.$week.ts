import { createFileRoute } from "@tanstack/react-router";
// Open (OPEN_PATHS /embed/): iframe widget for one Chart of the Week. Stored cards are immutable.
export const Route = createFileRoute("/embed/chart/$week")({ server: { handlers: { GET: async ({ request, params }) => {
  const [{ embedResponse }, { embedLoaders }] = await Promise.all([import("@/lib/embed/embed"), import("@/lib/embed/embed.server")]);
  return embedResponse(request, { kind: "chart", week: params.week }, embedLoaders);
} } } });
