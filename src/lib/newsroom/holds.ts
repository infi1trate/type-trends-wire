// N5 · A HOLD MUST STAY HELD, AND OUT OF TIME IS NOT A REASON TO PUBLISH (pure).
//   1. A story held through the door from outside a review pass (a `hold` by any desk session or the owner) is never offered to a
//      review pass; only a `restore` through the door releases it (the editor in chief or the owner; standards for a hold of its own).
//   2. A hold the editor in chief made in its own placement call stands until the next UTC day; it is offered again once on each of the
//      next two days, and held a third time it stays held unless its facts change (chief.ts `offerAgain`).
//   3. "No decision to make" never applies to a story the editor in chief has held (review.ts: it stays held without a call).
//   4. A story whose picture check, second reader or placement did not run because the pass ran out of time waits for the next pass,
//      up to six passes; only after six does it take the fallback, and its history says so.
export const PASS_HOLD = "review pass";
/** A hold edit is the review pass's own when a review row of the same desk with a hold verdict was written this close before it. */
export const PASS_MATCH_MS = 120_000;
export const WAIT_PASSES_MAX = 6;
export const AFTER_WAITS = "after waiting six passes";

type EditLike = { id?: number; action: string; payload: Record<string, unknown> | null; note: string | null; at: string };
type ReviewHold = { desk: string; verdict: string; at: string };
const isHold = (e: EditLike) => e.action === "kill" && (e.payload?.["hold"] === true || !!e.note?.startsWith("Held:"));
/** The hold edit in force (nothing released or took the story down after it), or null. */
export function holdInForce<E extends EditLike>(edits: readonly E[]): E | null {
  let h: E | null = null;
  for (const e of [...edits].sort((a, b) => a.at.localeCompare(b.at) || (a.id ?? 0) - (b.id ?? 0))) {
    if (isHold(e)) h = e;
    else if (e.action === "restore" || e.action === "pin" || e.action === "kill") h = null;
  }
  return h;
}
/** The desk a hold edit names (null: an engine hold from before N2). */
export const holdDesk = (e: EditLike | null) => (e && typeof e.payload?.["desk"] === "string" ? String(e.payload["desk"]) : null);
/** Made by a review pass's own verdict (its checklist, second reader or placement call), not through the door from outside. Holds
 *  from before N5 carry no marker: they count as the pass's when the same desk's hold review was written just before the edit. */
export function passMade(e: EditLike, reviews: readonly ReviewHold[]): boolean {
  if (e.payload?.["pass"] === PASS_HOLD) return true;
  const desk = holdDesk(e), t = Date.parse(e.at);
  return !!desk && reviews.some(r => r.desk === desk && r.verdict === "hold" && t - Date.parse(r.at) >= -5_000 && t - Date.parse(r.at) <= PASS_MATCH_MS);
}
/** Held through the door from outside a review pass (by a desk session or the owner): never offered to a review pass. */
export function doorHeld(edits: readonly EditLike[], reviews: readonly ReviewHold[]): boolean {
  const h = holdInForce(edits);
  return !!h && holdDesk(h) != null && !passMade(h, reviews);
}
/** The story's hold in force is the review pass's own, made by `desk` (the only holds a pass may offer again). */
export function passHeldBy(edits: readonly EditLike[], reviews: readonly ReviewHold[], desk: string): boolean {
  const h = holdInForce(edits);
  return !!h && holdDesk(h) === desk && passMade(h, reviews);
}
/** How many earlier review passes left this story waiting (their finish rows name it), since `since` when given. */
export function waitsOf(finishes: readonly { at: string; waiting: readonly string[] }[], id: string, since?: string | null): number {
  return finishes.filter(f => (!since || f.at > since) && f.waiting.includes(id)).length;
}
