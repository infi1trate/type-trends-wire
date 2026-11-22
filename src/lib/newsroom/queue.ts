// N4 · THE BUILD QUEUE's rules (pure): one list for every product change, each item's status history, and the order an item may move
// in. The door enforces these for `queue_move` and `gate_result`: only the listed order; `briefed` and `live` for anything but a bug or a
// label need the linked proposal accepted by the owner; `live` needs the newest gate result to be a pass; a decline needs a reason.
export const QUEUE_KINDS = ["bug", "label", "design move", "layout", "feature", "phase"] as const;
export type QueueKind = (typeof QUEUE_KINDS)[number];
/** What a reader should see when the item ships; the gate holds the item to it. */
export const EXPECTS = ["no visible change", "small", "layout"] as const;
export type Expects = (typeof EXPECTS)[number];
export const SOURCE_KINDS = ["proposal", "finding", "breach", "none"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];
export const QUEUE_STATUSES = ["queued", "briefed", "built", "gate passed", "gate failed", "live", "declined"] as const;
export type QueueStatus = (typeof QUEUE_STATUSES)[number];
/** Bug fixes and label fixes ship alone (N1 levels); every other kind needs the owner's accepted proposal before it is briefed or live. */
export const SHIPS_ALONE_KINDS: readonly QueueKind[] = ["bug", "label"];
/** L2 · a roadmap phase the owner approved in a brief is its own kind: it needs no proposal (the brief is the approval), it names its
 *  phase, and it passes the gate like any other item. */
export const NO_PROPOSAL_KINDS: readonly QueueKind[] = [...SHIPS_ALONE_KINDS, "phase"];
export const needsProposal = (k: string) => !(NO_PROPOSAL_KINDS as readonly string[]).includes(k);
export const PHASE_MIN = 2, PHASE_MAX = 12;
/** Why a queue_add's kind and phase do not go together, or null: a phase item names its phase (2 to 12 characters, e.g. "L2"); no
 *  other kind carries one. */
export function phaseProblem(kind: string, phase: string | null | undefined): string | null {
  const p = phase?.trim() ?? "";
  if (kind === "phase") return p.length < PHASE_MIN || p.length > PHASE_MAX ? `A phase item names its phase in ${PHASE_MIN} to ${PHASE_MAX} characters (for example "L2").` : null;
  return p ? `Only a phase item names a phase (this one is ${kind}).` : null;
}
/** The order. `gate passed` and `gate failed` are set only by a gate result; a failed gate goes back to a new build. */
export const NEXT: Readonly<Record<QueueStatus, readonly QueueStatus[]>> = {
  queued: ["briefed"], briefed: ["built"], built: [], "gate failed": ["built"], "gate passed": ["live"], live: [], declined: [],
};
/** A gate result is recorded for an item that has been built (or re-checked after an earlier result). */
export const GATE_FROM: readonly QueueStatus[] = ["built", "gate passed", "gate failed"];
export const isOpenStatus = (s: QueueStatus) => s !== "live" && s !== "declined";
export const NO_LONGER_FOUND = "no longer found";
export type QueueMove = { status: QueueStatus; actor: string; reason: string | null; at: string };
/** An item's status: its newest move (an item starts queued). */
export const statusOf = (moves: readonly QueueMove[]): QueueStatus => (moves.length ? [...moves].sort((a, b) => a.at.localeCompare(b.at))[moves.length - 1]!.status : "queued");
export type MoveCheck = { kind: string; status: QueueStatus; to: string; actor: string; reason: string | null; proposal: "open" | "accepted" | "declined" | null; gatePass: boolean | null };
/** Whether a queue_move may happen, and why not. */
export function moveDecision(c: MoveCheck): { ok: true } | { ok: false; reason: string } {
  const no = (reason: string) => ({ ok: false as const, reason });
  if (!(QUEUE_STATUSES as readonly string[]).includes(c.to)) return no(`“${c.to}” is not a queue status.`);
  const to = c.to as QueueStatus;
  if (to === "queued") return no("An item starts queued; it cannot be moved back to queued.");
  if (to === "gate passed" || to === "gate failed") return no("Only a gate result sets gate passed or gate failed (gate_result).");
  if (!isOpenStatus(c.status)) return no(`The item is ${c.status}; it cannot move again.`);
  if (to === "declined") {
    if (c.actor !== "engineering" && c.actor !== "owner") return no("Only the engineering desk or the owner declines an item.");
    if (!c.reason || c.reason.trim().length < 3) return no("A decline needs a reason.");
    return { ok: true };
  }
  if (c.actor !== "engineering") return no(c.actor === "owner" ? "The owner may decline an item; the engineering desk moves it along." : "Only the engineering desk moves an item along.");
  if (!NEXT[c.status].includes(to)) return no(`An item that is ${c.status} cannot move to ${to}; next is ${NEXT[c.status].join(" or ") || "a gate result"}.`);
  if ((to === "briefed" || to === "live") && needsProposal(c.kind) && c.proposal !== "accepted")
    return no(`A ${c.kind} item needs its proposal accepted by the owner before it is ${to}${c.proposal ? ` (the proposal is ${c.proposal})` : " (no proposal is linked)"}.`);
  if (to === "live" && c.gatePass !== true) return no(c.gatePass === false ? "The newest gate result for this item is a fail." : "No gate result has passed this item.");
  return { ok: true };
}
