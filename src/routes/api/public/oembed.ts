import { createFileRoute } from "@tanstack/react-router";
// oEmbed provider for trait explainer and chart pages: GET ?url=<page URL>[&maxwidth&maxheight&format=json]. Public, read-only, no PII.
export const Route = createFileRoute("/api/public/oembed")({ server: { handlers: { GET: async ({ request }) => {
  const { handleOembed } = await import("@/lib/embed/oembed.server");
  return handleOembed(request);
} } } });
