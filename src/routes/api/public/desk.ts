import { createFileRoute } from "@tanstack/react-router";
// Editor's desk (queue, pin, kill, correct, restore). Crawler shared-secret auth runs before the body is read; writes go to story_edits only.
export const Route = createFileRoute("/api/public/desk")({ server: { handlers: { POST: async ({ request }) => {
  const { handleDesk } = await import("@/lib/stories/desk.server");
  try { return await handleDesk(request); } catch { return Response.json({ error: "internal_error" }, { status: 500, headers: { "cache-control": "no-store" } }); }
} } } });
