import { describe, it, expect } from 'vitest';
import { alertCandidates, alertRow, selectAlerts, ticker, MAX_ALERTS, type AlertInput } from './alerts';
import type { DiscourseSignal } from './discourse';

const row = (value: string, o: Partial<AlertInput> = {}): AlertInput => ({ dimension: 'aesthetic', value, scope: 'all', status: 'ok', stage: 'accelerating', momentum: 1, current_share: 0.1, sites: 10, ...o });
const disc = (o: Partial<DiscourseSignal>): DiscourseSignal => ({ rate_per_10k: 5, z: 1, n_week: 20, n_9w: 60, baseline_weeks: 8, fatigue_ratio: 0.1, prev_fatigue_ratio: 0.05, fatigue_flag: false, spike: false, spike_ratio: 1, ...o });
const kinds = (rows: AlertInput[]) => alertCandidates(rows).map(a => `${a.kind}:${a.trait}:${a.scope}`).sort();

describe('alert rules', () => {
  it('breakout = top-decile momentum among ok rows with ≥3 sites', () => {
    const rows = [...Array.from({ length: 9 }, (_, i) => row(`v${i}`, { momentum: i * 0.1 })), row('hot', { momentum: 4.1, scope: 'ai' }), row('thin', { momentum: 5, sites: 2 })];
    const b = alertCandidates(rows).filter(a => a.kind === 'breakout');
    expect(b.map(a => a.trait)).toEqual(['aesthetic:hot']);
    expect(b[0]!.title).toBe('BREAKOUT $HOT +4.1 pts/q in ai');
  });
  it('crossover needs a sign flip of at least 5 pts', () => {
    expect(kinds([row('a', { momentum: null, curation: { lead_pts: 3, prev_lead_pts: -4 } }), row('b', { momentum: null, curation: { lead_pts: 1, prev_lead_pts: -1 } })])).toEqual(['crossover:aesthetic:a:all']);
  });
  it('saturation on crossing 35% or turning peaking', () => {
    expect(kinds([row('a', { momentum: null, current_share: 0.36, prev: { current_share: 0.3, stage: 'accelerating' } }), row('b', { momentum: null, stage: 'peaking', prev: { current_share: 0.5, stage: 'accelerating' } }), row('c', { momentum: null, current_share: 0.4, prev: { current_share: 0.38, stage: 'accelerating' } })]))
      .toEqual(['saturation:aesthetic:a:all', 'saturation:aesthetic:b:all']);
  });
  it('sentiment turn and discourse spike come from the discourse signal', () => {
    expect(kinds([row('a', { momentum: null, discourse: disc({ fatigue_flag: true }) }), row('b', { momentum: null, discourse: disc({ spike: true, spike_ratio: 3.4 }) })])).toEqual(['discourse_spike:aesthetic:b:all', 'sentiment_turn:aesthetic:a:all']);
  });
});

describe('alert selection', () => {
  const c = alertCandidates([row('a', { momentum: null, current_share: 0.36, prev: { current_share: 0.3, stage: null }, discourse: disc({ fatigue_flag: true }) }), row('b', { momentum: null, discourse: disc({ spike: true }) })]);
  it('keeps the highest-priority alert per trait', () => expect(selectAlerts(c, new Set()).map(a => `${a.kind}:${a.trait}`)).toEqual(['sentiment_turn:aesthetic:a', 'discourse_spike:aesthetic:b']));
  it('skips traits alerted in the last 28 days', () => expect(selectAlerts(c, new Set(['aesthetic:a'])).map(a => a.trait)).toEqual(['aesthetic:b']));
  it('caps at 10', () => {
    const many = alertCandidates(Array.from({ length: 15 }, (_, i) => row(`t${i}`, { momentum: null, discourse: disc({ fatigue_flag: true }) })));
    expect(selectAlerts(many, new Set())).toHaveLength(MAX_ALERTS);
  });
  it('rows link to the trait drawer and carry the dedupe key', () => {
    const r = alertRow(c[0]!, 42, new Date('2026-11-15T09:30:00Z'));
    expect(r).toMatchObject({ source_kind: 'alert', ref: 'aesthetic:a', tags: ['alert', 'sentiment_turn'], url: 'https://type-trends-wire.lovable.app/?panel=brief&trait=aesthetic%3Aa&sector=all&alert=42-sentiment_turn' });
    expect(r.excerpt).toContain('run 42');
  });
  it('tickers prefix ambiguous dimensions', () => { expect(ticker('theme', 'dark')).toBe('$THEME-DARK'); expect(ticker('components', 'bento_grid')).toBe('$BENTO-GRID'); });
});
