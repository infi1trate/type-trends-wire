import { describe, it, expect } from 'vitest';
import { arenaRows, cleanWebsite, parsePhPosts, phRows, pickArenaChannels, seedCandidates, seedDomain } from './sources';

const now = Date.parse('2026-11-14T00:00:00Z');
describe('Are.na', () => {
  it('picks top public channels by followers', () => {
    expect(pickArenaChannels({ channels: [{ slug: 'a', title: 'A', follower_count: 5 }, { slug: 'b', title: 'B', follower_count: 50 }, { slug: 'p', title: 'P', follower_count: 900, status: 'private' }, { slug: 'c', title: 'C', follower_count: 10 }] }).map(c => c.slug)).toEqual(['b', 'c']);
  });
  it('keeps recent Link/Image blocks with a public source; never image URLs', () => {
    const ch = { slug: 'type', title: 'Typography', followers: 1, updated_at: null };
    const rows = arenaRows({ data: [
      { type: 'Link', title: 'Specimen', visibility: 'public', source: { url: 'https://foundry.example/specimen', title: 'x' }, connection: { connected_at: '2026-11-12T00:00:00Z' }, image: { src: 'https://img/1.jpg' } },
      { type: 'Image', title: 'IMG_1.jpg', visibility: 'public', source: { url: 'https://studio.example/work', title: 'Studio work' }, created_at: '2026-11-13T00:00:00Z' },
      { type: 'Image', title: 'Old', visibility: 'public', source: { url: 'https://old.example/' }, connection: { connected_at: '2026-10-01T00:00:00Z' } },
      { type: 'Text', title: 'Note', visibility: 'public', source: null, created_at: '2026-11-13T00:00:00Z' },
      { type: 'Image', title: 'search', visibility: 'public', source: { url: 'https://www.google.com/search?q=x' }, created_at: '2026-11-13T00:00:00Z' },
    ] }, ch, now);
    expect(rows.map(r => [r.url, r.title, r.source, r.source_kind])).toEqual([['https://foundry.example/specimen', 'Specimen', 'Are.na · Typography', 'arena'], ['https://studio.example/work', 'Studio work', 'Are.na · Typography', 'arena']]);
    expect(JSON.stringify(rows)).not.toContain('img/1.jpg');
  });
});
describe('Product Hunt', () => {
  it('parses top posts and strips tracking from resolved websites', () => {
    const posts = parsePhPosts({ data: { posts: { edges: [{ node: { name: 'Glyphs', tagline: 'Type tool', url: 'https://www.producthunt.com/posts/glyphs', website: 'https://www.producthunt.com/r/abc', votesCount: 120, createdAt: '2026-11-13T08:00:00Z' } }] } } });
    expect(cleanWebsite('https://glyphs.app/pricing?ref=producthunt')).toBe('https://glyphs.app/pricing');
    expect(cleanWebsite('https://www.producthunt.com/r/abc')).toBeNull();
    const [r] = phRows(posts, new Map([[posts[0]!.url, 'https://glyphs.app/']]));
    expect(r).toMatchObject({ title: 'Glyphs — Type tool', source_kind: 'producthunt', link: 'https://glyphs.app/', excerpt: '120 upvotes · glyphs.app' });
  });
});
describe('seed candidates', () => {
  it('returns registrable domains and excludes social, hosting and app stores', () => {
    expect(seedDomain('https://shop.studio.co.uk/a')).toBe('studio.co.uk');
    for (const u of ['https://x.com/a', 'https://me.github.io/', 'https://apps.apple.com/app', 'https://play.google.com/x', 'https://site.vercel.app', 'https://foo.framer.website', 'http://10.0.0.1/']) expect(seedDomain(u)).toBeNull();
  });
  it('merges sources per domain with the first sighting', () => {
    expect(seedCandidates([{ link: 'https://a.studio/x', source_kind: 'arena', fetched_at: '2026-11-10T00:00:00Z' }, { link: 'https://www.a.studio/', source_kind: 'producthunt', fetched_at: '2026-11-08T00:00:00Z' }, { link: 'https://instagram.com/p', source_kind: 'arena', fetched_at: '2026-11-09T00:00:00Z' }]))
      .toEqual([{ domain: 'a.studio', sources: ['arena', 'producthunt'], first_seen: '2026-11-08T00:00:00.000Z' }]);
  });
});
