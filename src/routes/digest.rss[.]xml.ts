import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/digest/rss.xml")({ server: { handlers: { GET: async () => {
  const { feedResponse } = await import("@/lib/digest/feed.server");
  return feedResponse();
} } } });
