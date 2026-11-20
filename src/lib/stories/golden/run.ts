// The golden fixture through the engine exactly as a build runs it, with no stored stories (pure; used by golden.test.ts).
import fixture from "./__fixtures__/golden.json";
import checks from "./__fixtures__/checks.json";
import type { Check } from "../../integrity";
import { canonical } from "../../labels";
import { allCandidates } from "../editor";
import type { BuildInput } from "../candidates";
import { planStories, type Planned } from "../score";

/** E2e · the integrity verdicts for the fixtures' changes, judged against the stored live captures (scripts/build-integrity-fixture.ts). */
export const goldenChecks = checks as unknown as Record<number, Check>;
/** The golden fixture as a build sees it: with the integrity verdicts. */
export const goldenInput = () => ({ ...(fixture as unknown as BuildInput), checks: goldenChecks });
export function runGolden(input: BuildInput = goldenInput()): { plan: Planned[]; all: ReturnType<typeof allCandidates> } {
  const all = allCandidates(input), { ctx } = all, tracked = new Set(input.sites.map(s => s.domain));
  const plan = planStories(all.candidates, [], { tierOf: k => ctx.tiers.get(canonical(k)) ?? null, rankOf: d => ctx.rank.get(d) ?? null, tracked: d => tracked.has(d), covered: ctx.covered, shareOf: k => ctx.row(ctx.cur, canonical(k))?.current_share ?? null });
  return { plan, all };
}
