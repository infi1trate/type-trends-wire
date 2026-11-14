import { describe, it, expect } from 'vitest';
import { gfAdditions, isFlooding, supplyValue } from './supply';

const now = Date.parse('2026-11-14T00:00:00Z');
const d = (daysAgo: number) => new Date(now - daysAgo * 864e5).toISOString().slice(0, 10);
describe('supply', () => {
  it('counts first-seen families after the first snapshot; prior window needs 180 days', () => {
    const short = gfAdditions([{ family: 'Old', category: 'serif', first_seen: d(4) }, { family: 'New', category: 'serif', first_seen: d(1) }, { family: 'Sans', category: 'sans-serif', first_seen: d(1) }], 'serif', now);
    expect(short).toMatchObject({ last90: 1, prior90: null, history_days: 4 });
    const long = gfAdditions([{ family: 'Seed', category: 'serif', first_seen: d(200) }, { family: 'A', category: 'serif', first_seen: d(10) }, { family: 'B', category: 'serif', first_seen: d(20) }, { family: 'C', category: 'serif', first_seen: d(120) }], 'serif', now);
    expect(long).toMatchObject({ last90: 2, prior90: 1 });
    expect(supplyValue(long, 3)).toBe(4);
  });
  it('is null when nothing is measurable', () => { expect(supplyValue({ category: 'serif', last90: 3, prior90: null, history_start: null, history_days: 4, note: '' }, null)).toBeNull(); expect(supplyValue(null, 2)).toBe(2); });
  it('flags flooding when supply surges while momentum flattens', () => {
    const gf = { category: 'serif', last90: 6, prior90: 2, history_start: null, history_days: 200, note: null };
    expect(isFlooding(gf, 0, 'flat', 0.1)).toBe(true); expect(isFlooding(gf, 0, 'accelerating', 2)).toBe(false); expect(isFlooding(null, 5, 'accelerating', 0.2)).toBe(true);
  });
});
