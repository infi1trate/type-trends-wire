import type { AdoptionFig } from '@/lib/data-stories/types';
/** A column owns four squares; its width cannot shrink below the squares plus gutters. */
export function adoptionLayout(f: AdoptionFig) {
  const size = 10, gap = 3, per = 4, column = 64, left = 24, top = 100;
  const columns = f.quarters.map(q => f.adopters.filter(a => a.first === q));
  const height = top + Math.max(1, ...columns.map(c => Math.ceil(c.length / per))) * (size + gap) + 38;
  const width = left * 2 + column * Math.max(1, columns.length);
  const centre = (k: number) => left + k * column + column / 2;
  const cells = columns.flatMap((c, k) => c.map((app, j) => ({ app, quarter: k, x: left + k * column + 7 + (j % per) * (size + gap), y: top + Math.floor(j / per) * (size + gap) })));
  return { size, gap, per, column, left, top, width, height, centre, cells };
}
export const shortQuarter = (q: string) => /^\d{4}Q[1-4]$/.test(q) ? `Q${q.slice(5)} ${q.slice(2, 4)}` : q;
export const quarterLabelVisible = (i: number, count: number, focus: number) => i === 0 || i === count - 1 || i === focus || (i % 2 === 0 && Math.abs(i - focus) > 1 && i < count - 2);
