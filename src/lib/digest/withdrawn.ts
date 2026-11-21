// E5 · which retirements withdraw a reported change (the Digest's corrections and the terminal's brief line). Pure. A story retired
// because the change did not hold on a second look (it rotated, reversed, was seasonal, failed the integrity rule, was only an AI
// estimate, was not a rebrand) withdraws its brand's change. A story retired while its change stays on the record (now a tape line,
// folded into one story, held for the desk or the weekly roundup, a Brief table row) withdraws nothing.
import { E0_RETIRE, E2_RETIRE, E2B_REPLAN } from "../stories/retire";

/** Retirements that keep the change on the record: the story's form changed, not the fact. */
export const KEPT_ON_RECORD: readonly string[] = [E2_RETIRE.tape, E2_RETIRE.folded, E2_RETIRE.desk, E2_RETIRE.brief, E2_RETIRE.firstSeen, E2_RETIRE.whiteSpace, E0_RETIRE.counter, E0_RETIRE.news, E0_RETIRE.bluesky, E2B_REPLAN.cap, E2B_REPLAN.against];
/** Story kinds that report a change at one brand. */
export const CHANGE_KINDS: ReadonlySet<string> = new Set(["move", "counter_move", "rebrand"]);
const norm = (s: string) => s.replace(/^Retired:\s*/i, "").trim().toLowerCase();
/** True when a retired story withdrew a change at its brand. */
export function withdrewChange(s: { type: string; domains: readonly string[]; killReason: string | null }): boolean {
  if (!CHANGE_KINDS.has(s.type) || s.domains.length !== 1) return false;
  const r = norm(s.killReason ?? "");
  return !!r && !KEPT_ON_RECORD.some(k => norm(k) === r || r.startsWith(norm(k)));
}
