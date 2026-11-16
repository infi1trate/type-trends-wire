import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/morning/rss.xml")({ server: { handlers: { GET: async () => {
  const { morningFeedResponse } = await import("@/lib/editions/editions.server");
  return morningFeedResponse();
} } } });
