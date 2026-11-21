// N1 · the door's decision for one call (pure): who may do what, at which level, and whether the weekly cap stops it.
import { OWNER, isActor } from "./desks";
import { confirmPhrase, type ActionDef } from "./register";

export type Call = { actor: unknown; confirm?: unknown };
export type DoorDecision =
  | { kind: "run" }
  | { kind: "proposal" }
  | { kind: "refused"; reason: string; confirm?: string };
/** Run, record as a proposal, or refuse (with the reason, and the phrase a needs-the-owner call must carry). */
export function decide(def: ActionDef, call: Call, o: { capReached: boolean }): DoorDecision {
  if (!isActor(call.actor)) return { kind: "refused", reason: "Every call names its actor: one of the desks, or owner." };
  if (def.level === "needs the owner") {
    if (call.actor !== OWNER) return { kind: "refused", reason: `${def.id} needs the owner; ${call.actor} cannot do it.` };
    if (call.confirm !== confirmPhrase(def.id)) return { kind: "refused", reason: `${def.id} needs the owner's confirmation phrase.`, confirm: confirmPhrase(def.id) };
  }
  if (def.costs && o.capReached) return { kind: "refused", reason: "The weekly spend cap is reached; actions that cost wait until Monday (Eastern time)." };
  if (def.level === "ships to preview") return { kind: "proposal" };
  return { kind: "run" };
}
