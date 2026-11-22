// W3a Part E · the data desk's findings for AI-read fields whose reading was not steady in a sector between two forecast runs. Pure; kept
// out of datadesk.ts because that file is part of the standards checklist's fingerprint.
import type { Finding } from "./datadesk";
import { STEADY_MIN_BOTH } from "../stories/steady";

// W3a PART E · READINGS THAT ARE NOT STEADY -----------------------------------------------------------------------------------------------
/** At most this many homepages are named in one steadiness finding. */
export const STEADY_FINDING_HOMES = 10;
/** One finding per AI-read field and sector whose reading was not steady between the two runs (stable key per field, sector and run
 *  pair; a `detector:` key, so it is closed by hand, as every detector finding is). */
export function steadyFindings(xs: readonly import("../stories/steady").Steadiness[], runs: { early: number; late: number }): Finding[] {
  return xs.filter(x => !x.steady).map(x => ({ kind: "detector" as const, key: `detector:steady:${x.field}:${x.scope}:${runs.early}-${runs.late}`, subject: `${x.field} in ${x.scope}`, measure: null,
    expected: `At most a quarter of the homepages read in both forecast runs ${runs.early} and ${runs.late} change their ${x.field} reading (at least ${STEADY_MIN_BOTH} read in both)`,
    found: `${x.changed} of ${x.both} homepages changed their ${x.field} reading between forecast runs ${runs.early} and ${runs.late}: ${x.homes.slice(0, STEADY_FINDING_HOMES).map(h => `${h.domain} ${h.before} (${h.beforeAt.slice(0, 10)}) to ${h.after} (${h.afterAt.slice(0, 10)})`).join("; ")}`,
    receipt: { field: x.field, sector: x.scope, runs, changed: x.changed, both: x.both, homes: x.homes.slice(0, STEADY_FINDING_HOMES) } }));
}
