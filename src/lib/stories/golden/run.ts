// The golden fixture through the engine exactly as a build runs it, with no stored stories (pure; used by golden.test.ts).
import fixture from "./__fixtures__/golden.json";
import { canonical } from "../../labels";
import { allCandidates } from "../editor";
import type { BuildInput } from "../candidates";
import { planStories, type Planned } from "../score";

export const goldenInput = () => fixture as unknown as BuildInput;
export function runGolden(input: BuildInput = goldenInput()): { plan: Planned[]; all: ReturnType<typeof allCandidates> } {
  const all = allCandidates(input), { ctx } = all, tracked = new Set(input.sites.map(s => s.domain));
  const plan = planStories(all.candidates, [], { tierOf: k => ctx.tiers.get(canonical(k)) ?? null, rankOf: d => ctx.rank.get(d) ?? null, tracked: d => tracked.has(d), covered: ctx.covered, shareOf: k => ctx.row(ctx.cur, canonical(k))?.current_share ?? null });
  return { plan, all };
}
