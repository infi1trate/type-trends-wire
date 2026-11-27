// N4c · story review's scheduled pass, and (writer pass) the story writer's pass when review is quiet.
//
// The scheduled caller gives up after five seconds (wire-followups.ts, T1) and a handler still working then does not finish: on
// 27 Nov the first two writer passes run inside this handler wrote their start row and never a finish row, with no model call made.
// So the writer pass is never run before the answer. When the host offers waitUntil (src/server.ts hands it in), the review pass
// runs, the route answers, and the writer pass runs after the answer inside the time the host keeps such work alive
// (HOST_AFTER_ANSWER_MS, which writer-pass.ts's HOST_MS equals). Without waitUntil (the route file's fallback, the dev server, tests)
// the writer pass does not run at all: a pass that cannot finish only repeats a heavy load.
import type { JobContext } from "./wire-followups.server";

export type ReviewOut = { ran: boolean; why: string; items: unknown[]; ms: number; drafts?: unknown };
export type ReviewPassesDeps = {
  review: () => Promise<ReviewOut>;
  /** The writer pass, given the time its window starts. Never throws. */
  writer: (t0: number) => Promise<unknown>;
  now: () => number;
};
/** Pure · a quiet review pass: nothing waiting, no drafts call, or review held. Not when the clock was busy or another pass ran. */
export const quietReview = (r: Pick<ReviewOut, "why" | "items" | "drafts">) => !r.items.length && !r.drafts && (r.why === "nothing waiting" || r.why === "held");

/** The pass after authentication: review first (before the answer, as it always ran), then the writer pass handed to the host. */
export async function reviewThenWriter(deps: ReviewPassesDeps, ctx: JobContext = {}): Promise<{ review: ReviewOut; writer: "handed" | "not run: review was busy" | "not run: no waitUntil" }> {
  const review = await deps.review();
  if (!quietReview(review)) return { review, writer: "not run: review was busy" };
  if (typeof ctx.waitUntil !== "function") return { review, writer: "not run: no waitUntil" };
  try { ctx.waitUntil(deps.writer(deps.now()).catch(() => null)); } catch { return { review, writer: "not run: no waitUntil" }; }
  return { review, writer: "handed" };
}

export async function handleReviewPasses(request: Request, ctx: JobContext = {}): Promise<Response> {
  const { authenticateCronRequest } = await import("@/integrations/supabase/cron-auth");
  const authFailure = await authenticateCronRequest(request);
  if (authFailure) return authFailure;
  let body: unknown = null; try { body = await request.json(); } catch { /* invalid */ }
  if (!body || typeof body !== "object" || (body as { kind?: unknown }).kind !== "review-passes") return Response.json({ error: "Expected {\"kind\":\"review-passes\"}" }, { status: 400 });
  // D1 Part 4 · a slow database: stand down at once ("skipped: database slow").
  const { standDown, stoodDown } = await import("./gate.server");
  const why = await standDown("review-passes"); if (why) return stoodDown(why);
  const [{ supabaseAdmin }, { runReviewPass }] = await Promise.all([import("@/integrations/supabase/client.server"), import("@/lib/newsroom/review-pass.server")]);
  const { review: r, writer } = await reviewThenWriter({
    review: () => runReviewPass(supabaseAdmin) as Promise<ReviewOut>,
    writer: async t0 => (await import("@/lib/stories/writer-pass.server")).runWriterPass(supabaseAdmin as never, t0),
    now: Date.now,
  }, ctx);
  return Response.json({ ran: r.ran, why: r.why, items: r.items, ms: r.ms, writer }, { headers: { "cache-control": "no-store" } });
}
