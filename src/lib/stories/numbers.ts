// STORY NUMBERS — permanent public numbers ("No. 47"). Pure. Stored insert-only in `story_numbers`, written only by the story build.
// Numbers follow first publication; within one assignment pass, by happened_at then id. They are never reused or changed: a killed
// story keeps its number, which is simply not shown anywhere.
export type NumberRow = { story_id: string; number: number };

/** New rows for published stories without a number, continuing after the highest number ever assigned. */
export function assignNumbers(published: { id: string; happened_at: string }[], existing: NumberRow[]): NumberRow[] {
  const have = new Set(existing.map(r => r.story_id));
  let next = existing.reduce((m, r) => Math.max(m, r.number), 0);
  return published.filter(s => !have.has(s.id)).sort((a, b) => a.happened_at.localeCompare(b.happened_at) || a.id.localeCompare(b.id))
    .filter((s, i, a) => i === 0 || a[i - 1]!.id !== s.id)
    .map(s => ({ story_id: s.id, number: ++next }));
}
/** Attach each story's number, shown only while it is published (killed and held stories show none). */
export function withNumbers<T extends { id: string; state: string }>(rows: T[], numbers: NumberRow[]): (T & { number: number | null })[] {
  const by = new Map(numbers.map(r => [r.story_id, r.number]));
  return rows.map(s => ({ ...s, number: s.state === "published" ? by.get(s.id) ?? null : null }));
}
/** /stories/no/<n>: the story a number points at, only while that story is published. */
export function storyIdForNumber(n: number, numbers: NumberRow[], stateOf: (id: string) => string | null): string | null {
  const row = numbers.find(r => r.number === n);
  return row && stateOf(row.story_id) === "published" ? row.story_id : null;
}
export const numberLabel = (n: number) => `No. ${n}`;
export const numberPath = (n: number) => `/stories/no/${n}`;
