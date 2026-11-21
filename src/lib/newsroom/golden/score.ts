// N1 · the frozen writing set's scorer (pure, no model). Each approved text is checked against its own frozen facts with the shared
// check the writers use; a text scores 100 when it passes and loses 20 per failure (floor 0). The set's score is the mean.
import { checkText, type WriterFacts, type WrittenText } from "../../stories/writer";
export type FrozenItem = { kind: "story"; id: string; number: number; model: string; written_at: string; facts: WriterFacts; text: WrittenText };
export type WritingSet = { frozen_at: string; known: { stories: string[]; studies: string[] }; items: FrozenItem[] };
export type ItemScore = { id: string; number: number; score: number; failures: string[] };
export type SetScore = { items: ItemScore[]; mean: number; passed: number; total: number };
export const scoreOf = (failures: readonly string[]) => Math.max(0, 100 - 20 * failures.length);
/** Score texts (the frozen ones, or a candidate writer's) against the set's frozen facts. */
export function scoreSet(set: WritingSet, texts: ReadonlyMap<string, WrittenText> = new Map()): SetScore {
  const items = set.items.map(i => {
    const failures = checkText(texts.get(i.id) ?? i.text, i.facts, { names: set.known.stories }, { requireBody: true });
    return { id: i.id, number: i.number, score: scoreOf(failures), failures };
  });
  const mean = items.length ? Math.round((items.reduce((a, x) => a + x.score, 0) / items.length) * 10) / 10 : 0;
  return { items, mean, passed: items.filter(x => !x.failures.length).length, total: items.length };
}
/** A candidate passes the gate when its mean is at least the baseline's and no text that passed in the baseline now fails. */
export function gatePasses(baseline: Pick<SetScore, "items" | "mean">, candidate: Pick<SetScore, "items" | "mean">): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (candidate.mean < baseline.mean) reasons.push(`mean ${candidate.mean} is below the baseline's ${baseline.mean}`);
  const was = new Map(baseline.items.map(i => [i.id, i.failures.length === 0]));
  for (const i of candidate.items) if (was.get(i.id) && i.failures.length) reasons.push(`No. ${i.number} passed in the baseline and now fails: ${i.failures[0]}`);
  for (const id of was.keys()) if (!candidate.items.some(i => i.id === id)) reasons.push(`${id} is missing from the score`);
  return { ok: !reasons.length, reasons };
}
