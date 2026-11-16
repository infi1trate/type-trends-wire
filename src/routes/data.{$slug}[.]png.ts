import { createFileRoute } from "@tanstack/react-router";
// Share image for one live data story. Gated (not in OPEN_PATHS) while DATA_STORIES_PUBLIC is false.
export const Route = createFileRoute("/data/{$slug}.png")({ server: { handlers: { GET: async ({ params }) => {
  const { dataStoryImage } = await import("@/lib/data-stories/share.server");
  return dataStoryImage(params.slug);
} } } });
