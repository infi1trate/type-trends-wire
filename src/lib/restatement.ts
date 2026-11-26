/** R2b · restatement runs. Pure: the one rule for whether two forecast runs may be compared.
 *  A run computed after a panel step reads a larger panel, so any change against a run before the step is the panel growing, not design. */
export type PanelRef = { id: number; step?: number | null };
/** Runs before R2b carry no step and read as panel 300. */
export const LEGACY_PANEL_SIZE = 300;
/** Days after a step that reader pages carry the restatement line. */
export const RESTATED_LINE_DAYS = 14;

/** Two runs may be compared only when they were computed over the same panel step. */
export const comparable = (a: PanelRef, b: PanelRef): boolean => (a.step ?? null) === (b.step ?? null);
/** A restatement run: its panel step differs from the run before it. */
export const isRestatement = (cur: PanelRef, prev: PanelRef | null | undefined): boolean => !!prev && !comparable(cur, prev);
/** Earlier runs that may be compared with `cur`, in the order given. */
export const samePanel = <R extends PanelRef>(cur: PanelRef, earlier: readonly R[]): R[] => earlier.filter(r => comparable(cur, r));

/**
 * Which run judges tiers (the one-week hold). Runs oldest first. Normally the newest run, with up to two earlier same-panel runs for
 * its stage history. On a restatement run (the run before it is on another panel) tiers do not move: the previous run judges them,
 * with its own same-panel history. The next run on the new panel has the restatement run as its history, which confirms a new stage.
 */
export function tierBasis<R extends PanelRef>(runs: readonly R[]): { basis: R | null; prior: R[]; held: boolean } {
  const cur = runs.at(-1) ?? null;
  if (!cur) return { basis: null, prior: [], held: false };
  const before = runs.slice(0, -1), prev = before.at(-1);
  if (isRestatement(cur, prev)) return { basis: prev!, prior: samePanel(prev!, before.slice(0, -1)).slice(-2).reverse(), held: true };
  return { basis: cur, prior: samePanel(cur, before).slice(-2).reverse(), held: false };
}

export type StepFacts = { at: string; brands_before: number; brands_after: number };
const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const longDate = (iso: string) => { const d = new Date(iso); return `${d.getUTCDate()} ${MONTH[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
/** The one reader line, for RESTATED_LINE_DAYS after a step; null otherwise. */
export function restatedLine(step: StepFacts | null | undefined, now: number): string | null {
  if (!step) return null;
  const t = Date.parse(step.at);
  if (!Number.isFinite(t) || now < t || now - t > RESTATED_LINE_DAYS * 864e5) return null;
  return `Restated on ${longDate(step.at)}: slug now reads ${step.brands_after} homepages, up from ${step.brands_before}. Every quarter was recomputed, so this week's movement is not compared with last week's.`;
}

/** Alert kinds that read movement against earlier runs or quarters restated by the step; a restatement run raises none of them. */
export const CROSS_RUN_ALERT_KINDS: readonly string[] = ["breakout", "crossover", "saturation"];
export const alertAllowed = (kind: string, restated: boolean) => !restated || !CROSS_RUN_ALERT_KINDS.includes(kind);
/** Whether run `id` (in `runs`, any order) is a restatement run against the run before it. */
export const restatedIn = <R extends PanelRef>(runs: readonly R[], id: number) => {
  const sorted = [...runs].sort((a, b) => a.id - b.id), i = sorted.findIndex(r => r.id === id);
  return i > 0 && isRestatement(sorted[i]!, sorted[i - 1]);
};
