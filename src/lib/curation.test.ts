import { describe, it, expect } from 'vitest';
import { crawlSiteTraits, traitCuration, galleryMix, isCrossover, curationLead, MIN_INDEX_SITES } from './curation';
import { crawlPayload } from './crawl-payload';

const site = (index_name: string, o: { dark?: boolean; serif?: boolean; galleries?: string[] } = {}) => ({ index_name, galleries: o.galleries ?? null,
  color: { theme: o.dark ? 'dark' : 'light' }, type: { rendered: { h1: { family: o.serif ? 'Fraunces' : 'Inter', webfont: true } }, declared: { h1: { letter_spacing_em: -0.03 } } },
  layout: { hero_media: 'video' }, tech: { tailwind: true, next: false } });
const many = (n: number, index: string, o: Parameters<typeof site>[1] = {}) => Array.from({ length: n }, () => site(index, o));

describe('curated index payload', () => {
  const base = { kind: 'sites', run_id: 'r1', sites: [{ run_id: 'r1', domain: 'a.com', index: 'curated', crawled_at: '2026-11-13T00:00:00Z', ok: true, galleries: ['godly', 'awwwards'] }] };
  it('accepts curated sites with known gallery slugs', () => expect(crawlPayload.safeParse(base).success).toBe(true));
  it('rejects unknown galleries and more than 10', () => {
    expect(crawlPayload.safeParse({ ...base, sites: [{ ...base.sites[0], galleries: ['dribbble'] }] }).success).toBe(false);
    expect(crawlPayload.safeParse({ ...base, sites: [{ ...base.sites[0], galleries: Array(11).fill('godly') }] }).success).toBe(false);
  });
  it('still rejects unknown indexes', () => expect(crawlPayload.safeParse({ ...base, sites: [{ ...base.sites[0], index: 'gallery' }] }).success).toBe(false));
});

describe('crawl site traits', () => {
  it('maps crawl signals onto forecast traits', () => {
    expect(crawlSiteTraits(site('curated', { dark: true, serif: true })).sort()).toEqual(['font:webfont', 'framework:tailwind', 'headline:serif', 'hero_media:video', 'theme:dark', 'tracking:tight']);
  });
});

describe('curation lead', () => {
  it('is curated share minus mainstream share in points', () => {
    const sites = [...many(10, 'curated', { dark: true }), ...many(10, 'curated'), ...many(5, 'mainstream', { dark: true }), ...many(15, 'mainstream'), ...many(10, 'vanguard', { dark: true })];
    const dark = traitCuration(sites).get('theme:dark')!;
    expect(dark.indexes.curated).toEqual({ n: 20, hits: 10, share: 0.5 });
    expect(dark.curation_lead_pts).toBe(25);
    expect(dark.vanguard_spread_pts).toBe(75);
  });
  it(`needs at least ${MIN_INDEX_SITES} sites in an index`, () => {
    const lead = traitCuration([...many(9, 'curated', { dark: true }), ...many(20, 'mainstream')]).get('theme:dark')!;
    expect(lead.indexes.curated.share).toBeNull(); expect(lead.curation_lead_pts).toBeNull();
  });
  it('rounds to one decimal and handles nulls', () => { expect(curationLead(0.3333, 0.1)).toBe(23.3); expect(curationLead(null, 0.1)).toBeNull(); });
  it('counts the gallery mix once per curated site', () => {
    expect(galleryMix([site('curated', { galleries: ['godly', 'godly', 'awwwards'] }), site('curated', { galleries: ['godly'] }), site('mainstream', { galleries: ['godly'] })])).toEqual({ godly: 2, awwwards: 1 });
  });
  it('flags a crossover only on a sign flip of at least 5 pts', () => {
    expect(isCrossover(-3, 4)).toBe(true); expect(isCrossover(-2, 2)).toBe(false); expect(isCrossover(3, 9)).toBe(false); expect(isCrossover(null, 9)).toBe(false);
  });
});
