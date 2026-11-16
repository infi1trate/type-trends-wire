import { createFileRoute } from "@tanstack/react-router";
// One step of a live data story as a standalone page. Gated (not under /embed/, not in OPEN_PATHS) while DATA_STORIES_PUBLIC is false.
export const Route = createFileRoute("/data/embed/$slug")({ server: { handlers: { GET: async ({ params, request }) => {
  const { dataStoryEmbed } = await import("@/lib/data-stories/share.server");
  return dataStoryEmbed(params.slug, new URL(request.url).searchParams.get("step"));
} } } });
