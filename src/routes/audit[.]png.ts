import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/audit.png")({ server: { handlers: { GET: async ({ request }) => {
  const { auditImage } = await import("@/lib/agency/audit.server");
  return auditImage(new URL(request.url));
} } } });
