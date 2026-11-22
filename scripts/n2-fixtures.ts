// N2 · Part 6: freeze the standards desk's inputs for ten known stories (four that must hold, six that must pass), each as it stood
// on the live site before any later retirement or correction. Run once: `bun scripts/n2-fixtures.ts`. Reads only.
import { writeFileSync } from "node:fs";
const { supabaseAdmin: db } = await import("../src/integrations/supabase/client.server");
const { dbDeps, BUILD_DAYS, shareBases } = await import("../src/lib/stories/build.server");
const { confirmedInput } = await import("../src/lib/stories/editor");
const { context } = await import("../src/lib/stories/candidates");
const { reviewInput } = await import("../src/lib/newsroom/review.server");
const { checklist } = await import("../src/lib/newsroom/standards");

export const CASES = [
  { number: 77, expect: "hold", asOf: "2026-11-21T14:12:00Z", why: "a news story matched to the wrong brand (Mother Design, not Mother) that said nothing" },
  { number: 92, expect: "hold", asOf: "2026-11-22T01:03:00Z", why: "a one-colour change on one page ran as a story" },
  { number: 91, expect: "hold", asOf: "2026-11-21T14:06:00Z", why: "built on AI re-reads; led the front page with an empty body" },
  { number: 45, expect: "hold", asOf: "2026-11-21T15:44:00Z", why: "named Ragged Edge (ragged-edge.com), a resort, as a studio" },
  { number: 42, expect: "pass", asOf: null, why: "must pass" }, { number: 43, expect: "pass", asOf: null, why: "must pass" }, { number: 44, expect: "pass", asOf: null, why: "must pass" },
  { number: 88, expect: "pass", asOf: null, why: "must pass" }, { number: 89, expect: "pass", asOf: null, why: "must pass" }, { number: 90, expect: "pass", asOf: null, why: "must pass" },
] as const;

const raw = await dbDeps(db as never, false).load({ days: 2 * BUILD_DAYS, allRuns: false, realRunIds: [] });
const input = confirmedInput(raw).input, ctx = context(input);
const { data: ids } = await db.from("story_numbers").select("story_id,number").in("number", CASES.map(c => c.number));
const out = [];
for (const c of CASES) {
  const id = ids?.find(x => x.number === c.number)?.story_id; if (!id) throw new Error(`no story No. ${c.number}`);
  const i = await reviewInput(id, { input, ctx, bases: shareBases }, c.asOf ? { asOf: c.asOf } : {});
  if (!i) throw new Error(`no input for No. ${c.number}`);
  out.push({ ...c, id, input: { ...i, number: c.number } });
  console.log(c.number, c.expect, checklist(i).filter(x => x.result === "fail").map(x => `${x.id}: ${x.detail}`).join(" | ") || "checklist passes");
}
writeFileSync("src/lib/newsroom/__fixtures__/standards-cases.json", JSON.stringify({ frozen_at: new Date().toISOString(), cases: out }, null, 1) + "\n");
process.exit(0);
