import { describe, it, expect } from 'vitest';
import { buildTerms, countTerms, dailyCountRows, discourseSignal, isFatigueTurn, weeklyBuckets, traitTermMap, termsVersion, MAX_TERMS, TOTAL_TERM, type Week } from './discourse';

describe('discourse vocabulary', () => {
  const terms = buildTerms({ fonts: [{ family: 'Geist', sites: 26 }, { family: 'Rare Face', sites: 2 }], hues: ['amber', 'lime-green'] });
  it('includes human phrasing, fonts on ≥3 sites, hues and tech; caps at 600', () => {
    const names = terms.map(t => t.term);
    expect(names).toEqual(expect.arrayContaining(['brutalism', 'glassmorphism', 'bento grid', 'dark mode', 'variable font', 'gradient', 'serif', 'monospace', 'framer', 'webflow', 'tailwind', 'Geist', 'amber', 'lime green']));
    expect(names).not.toContain('Rare Face'); expect(terms.find(t => t.term === 'bento grid')?.trait).toBe('components:bento_grid');
    expect(buildTerms({ fonts: Array.from({ length: 900 }, (_, i) => ({ family: `Font ${i}`, sites: 5 })), hues: [] })).toHaveLength(MAX_TERMS);
  });
  it('has a stable version', () => expect(termsVersion(terms)).toBe(termsVersion([...terms].reverse())));
});

describe('term counting', () => {
  const terms = [{ term: 'Inter', kind: 'font' as const }, { term: 'bento grid', kind: 'layout' as const }];
  it('counts once per text, fonts case-sensitively, with fatigue', () => {
    expect(countTerms(['Bento grid everywhere, bento grid again', 'inter-agency memo', 'Tired of Inter and bento grid', 'Inter is fine'], terms))
      .toEqual({ 'bento grid': { n: 2, fatigue: 1 }, Inter: { n: 2, fatigue: 1 } });
  });
  it('buckets wire items by UTC day with a total row', () => {
    const rows = dailyCountRows('rss', [{ text: 'A bento grid', published_at: '2026-11-12T23:00:00Z' }, { text: 'Nothing', published_at: '2026-11-12T01:00:00Z' }], terms);
    expect(rows).toEqual([
      { source: 'rss', window_start: '2026-11-12T00:00:00.000Z', window_end: '2026-11-13T00:00:00.000Z', sampled_posts: 2, design_posts: 2, term: TOTAL_TERM, n: 2, fatigue: 0 },
      { source: 'rss', window_start: '2026-11-12T00:00:00.000Z', window_end: '2026-11-13T00:00:00.000Z', sampled_posts: 2, design_posts: 2, term: 'bento grid', n: 1, fatigue: 0 }]);
  });
});

describe('weekly discourse signal', () => {
  const now = Date.parse('2026-11-14T00:00:00Z'), day = 864e5;
  const w = (n: number, sampled = 10000, fatigue = 0): Week => ({ n, fatigue, sampled });
  it('buckets by 7-day age and term set, case-insensitively', () => {
    const weeks = weeklyBuckets([{ window_start: new Date(now - day).toISOString(), term: 'Bento Grid', n: 4, fatigue: 1, sampled_posts: 0 }, { window_start: new Date(now - 8 * day).toISOString(), term: TOTAL_TERM, n: 9, fatigue: 0, sampled_posts: 500 }], new Set(['bento grid']), now);
    expect(weeks[0]).toEqual({ n: 4, fatigue: 1, sampled: 0 }); expect(weeks[1]).toEqual({ n: 0, fatigue: 0, sampled: 500 });
  });
  it('z-scores this week against the prior 8 weekly rates', () => {
    const s = discourseSignal([w(20), w(10), w(12), w(8), w(10), w(10), w(12), w(8), w(10)]);
    expect(s.rate_per_10k).toBe(20); expect(s.baseline_weeks).toBe(8); expect(s.z).toBe(5);
    expect(discourseSignal([w(12), w(10), w(12), w(8), w(10), w(10), w(12), w(8), w(10)]).z).toBe(1.41);
  });
  it('needs four baseline weeks', () => expect(discourseSignal([w(20), w(10), w(10), w(10), w(0, 0), w(0, 0), w(0, 0), w(0, 0), w(0, 0)]).z).toBeNull());
  it('flags praise turning to fatigue above 0.15 with n ≥ 20, rising', () => {
    expect(isFatigueTurn(20, 0.2, 0.1)).toBe(true); expect(isFatigueTurn(19, 0.5, 0)).toBe(false); expect(isFatigueTurn(40, 0.15, 0)).toBe(false); expect(isFatigueTurn(40, 0.2, 0.25)).toBe(false); expect(isFatigueTurn(40, 0.2, null)).toBe(true);
    expect(discourseSignal([w(10, 10000, 2), w(5, 10000, 1), w(5, 10000, 1), w(5, 10000, 1), w(10), w(10), w(10), w(10), w(10)]).fatigue_flag).toBe(true);
  });
  it('spikes at ≥3× the 8-week median rate with n ≥ 15', () => {
    expect(discourseSignal([w(15), w(5), w(5), w(5), w(5), w(4), w(6), w(5), w(5)]).spike).toBe(true);
    expect(discourseSignal([w(14), w(2), w(2), w(2), w(2), w(2), w(2), w(2), w(2)]).spike).toBe(false);
    expect(discourseSignal([w(15), w(6), w(6), w(6), w(6), w(6), w(6), w(6), w(6)]).spike).toBe(false);
  });
  it('maps traits to their phrases', () => expect([...traitTermMap().get('aesthetic:glassmorphism')!]).toEqual(['glassmorphism']));
});
