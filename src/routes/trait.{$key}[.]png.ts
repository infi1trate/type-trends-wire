import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/trait/{$key}.png")({ server: { handlers: { GET: async ({ params }) => {
  const { traitImage } = await import("@/lib/digest/og.server");
  return traitImage(decodeURIComponent(params.key), "png");
} } } });
