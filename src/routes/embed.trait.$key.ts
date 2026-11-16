import { createFileRoute } from "@tanstack/react-router";
// Open (OPEN_PATHS /embed/): iframe widget for one signal. Self-contained HTML; framing is allowed on /embed/ only.
export const Route = createFileRoute("/embed/trait/$key")({ server: { handlers: { GET: async ({ request, params }) => {
  const [{ embedResponse }, { embedLoaders }] = await Promise.all([import("@/lib/embed/embed"), import("@/lib/embed/embed.server")]);
  return embedResponse(request, { kind: "trait", key: params.key }, embedLoaders);
} } } });
