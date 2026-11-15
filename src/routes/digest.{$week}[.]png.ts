import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/digest/{$week}.png")({ server: { handlers: { GET: async ({ params }) => {
  const { issueImage } = await import("@/lib/digest/og.server");
  return issueImage(`${params.week}.png`);
} } } });
