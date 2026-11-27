import { createFileRoute } from "@tanstack/react-router";

// N4c · story review's own scheduled pass (review-pass.ts): at most two stories, picture check, standards, editor in chief. Managed
// schedule only. Writer pass · src/server.ts answers this address first when the host offers waitUntil, so the story writer's pass can
// run after the answer; this route is the inline fallback and never runs the writer pass (lib/jobs/review-passes.server.ts says why).
export const Route = createFileRoute("/api/public/jobs/review-passes")({
  server: { handlers: { POST: async ({ request }) => {
    const { handleReviewPasses } = await import("@/lib/jobs/review-passes.server");
    return handleReviewPasses(request);
  } } },
});
