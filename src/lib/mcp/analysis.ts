import { computeBand, pointAtLeast, daysBetween, METHODOLOGY as BAND_RULES } from '../bands';
export type FontRow = { captured_on: string; family: string; category: string; popularity_rank: number; trending_rank: number; is_variable: boolean };
export function analyzeFamily(history: FontRow[]) {
  const sorted = [...history].sort((a,b) => a.captured_on.localeCompare(b.captured_on));
  const first = sorted[0], cur = sorted.at(-1);
  if (!first || !cur) return null;
  const p7 = pointAtLeast(sorted, cur.captured_on, 7), p28 = pointAtLeast(sorted, cur.captured_on, 28);
  const band = computeBand(sorted);
  return { ticker: '$' + cur.family.toUpperCase().replace(/[^A-Z0-9]/g, '-'), family: cur.family, category: cur.category, is_variable: cur.is_variable,
    as_of: cur.captured_on, popularity_rank: cur.popularity_rank, trending_rank: cur.trending_rank,
    change: { popularity_7d: p7 ? p7.popularity_rank-cur.popularity_rank : null, popularity_28d: p28 ? p28.popularity_rank-cur.popularity_rank : null,
      trending_7d: p7 ? p7.trending_rank-cur.trending_rank : null, trending_28d: p28 ? p28.trending_rank-cur.trending_rank : null,
      note: 'Positive = climbed that many places. null = not enough history yet.' },
    band: band.band, band_reason: band.reason, days_of_history: daysBetween(first.captured_on, cur.captured_on),
    history: sorted.map(r => ({ d: r.captured_on, pop: r.popularity_rank, trend: r.trending_rank })) };
}
export function movers(latest: FontRow[], earlier: FontRow[], opts: {direction: 'rising'|'falling'|'trending'; category?: string | undefined; limit: number}) {
  const old = new Map(earlier.map(r => [r.family,r]));
  return latest.filter(r => !opts.category || r.category === opts.category).map(r => ({family:r.family,category:r.category,popularity_rank:r.popularity_rank,trending_rank:r.trending_rank,
    popularity_change: old.has(r.family) ? (old.get(r.family)?.popularity_rank ?? r.popularity_rank)-r.popularity_rank : null}))
    .filter(r => opts.direction === 'trending' || r.popularity_change !== null)
    .sort((a,b) => opts.direction === 'trending' ? a.trending_rank-b.trending_rank : opts.direction === 'rising' ? (b.popularity_change ?? 0)-(a.popularity_change ?? 0) : (a.popularity_change ?? 0)-(b.popularity_change ?? 0)).slice(0,opts.limit);
}
export const METHODOLOGY = [
  'Data: daily Google Fonts Developer API snapshots: popularity and trending ranks only, not raw embed counts.',
  'Wire: 9 design RSS feeds + Hacker News every 15 minutes; keyword-tagged type/color/brand/ui/web/motion/ai.',
  ...BAND_RULES,
  'BASELINE also applies when there is no snapshot at least 28 days older. Rules are evaluated in the order shown.',
  'Crawler: weekly derived design signals, comparing vanguard and mainstream. EN includes English-language successful sites; ALL includes every language. Spread is (vanguard share − mainstream share) × 100.',
  'LIBRARY: 300 active sites in 10 sectors; home, pricing, changelog, product and about pages in desktop/mobile. Daily checks + Saturday full captures. Baseline captures do not create new-surface events; a new page is an event only when the domain has a snapshot more than 24 hours older. Changes compare rendered fonts, palettes, theme, layout, messaging, pricing, stack and navigation. A desktop homepage with at least three distinct change types is a redesign. No screenshots are stored, ever. Raw text stays private; wireframes are derived boxes.',
  'AI TAGGING: closed vocabularies for imagery, aesthetic, components, hero layout, AI positioning, tone and color mood; text extracts pricing, changelog and product themes. Models: google/gemini-3-flash-preview (vision, $0.50/$3.00 per million input/output tokens) and google/gemini-3.1-flash-lite (text, $0.25/$1.50). Monthly budget $50; initial backfill $100 for 21 days. AI results are estimates, not measured facts. Images are sent transiently to the AI gateway for tagging and never stored by this app. Raw page text stays private. Tag and extracted-pricing changes require two consecutive captures.',
  'WAYBACK: desktop homepages sampled roughly twice a year from 2021. Each UTC Jan/Jul bucket uses the last archive capture per site; the current bucket also uses the latest live capture. Archived assets and fonts may be missing or substituted. Coverage is sampled sites / active sites; below 0.30 is flagged, never hidden. Tag shares exclude unreliable captures. Archive type/theme/stack/redesign/imagery/aesthetic changes confirm in one capture, with historical effective dates; live changes retain two-capture confirmation. Sparse archive sampling skips palette/layout/navigation/message/pricing changes. No images or private text are exposed.',
  'Every tool response carries receipts. Headlines and links only; read the original source for full articles.'
].join('\n');
