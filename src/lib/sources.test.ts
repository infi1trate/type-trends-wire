import { describe, it, expect } from 'vitest';
import { ARENA_ENABLED, PH_QUERY, PH_QUERY_NO_TOPICS, arenaRows, cleanWebsite, pacificDay, parsePhPosts, phDayWindow, phRefused, phRows, pickArenaChannels, seedCandidates, seedDomain } from './sources';
import recorded from './ph-day.fixture.json';

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
    expect(r).toMatchObject({ title: 'Glyphs — Type tool', source_kind: 'producthunt', link: 'https://glyphs.app/', excerpt: '120 upvotes · glyphs.app', votes: 120, topics: null });
  });
});
// PH1 · a recorded answer for the Pacific day 22 Nov 2026 (five of its posts, read 23 Nov; no token, no network).
describe('Product Hunt · the finished day', () => {
  it('asks for one day by votes, with topic names and slugs', () => {
    expect(PH_QUERY).toMatch(/order: VOTES/); expect(PH_QUERY).toMatch(/postedAfter: \$after, postedBefore: \$before/);
    expect(PH_QUERY).toMatch(/topics\(first: 10\) \{ edges \{ node \{ name slug \} \} \}/); expect(PH_QUERY_NO_TOPICS).not.toMatch(/topics/);
  });
  it('the window is the Pacific day before, on a winter day', () => {
    expect(phDayWindow(Date.parse('2026-11-23T08:37:00Z'))).toEqual({ day: '2026-11-22', after: '2026-11-22T08:00:00.000Z', before: '2026-11-23T08:00:00.000Z' });
    // Just before midnight Pacific it is still the 22nd there, so the finished day is the 21st.
    expect(phDayWindow(Date.parse('2026-11-23T07:59:00Z')).day).toBe('2026-11-21');
  });
  it('the window spans 25 hours on the day clocks go back (1 Nov 2026) and is right either side', () => {
    expect(phDayWindow(Date.parse('2026-11-02T08:37:00Z'))).toEqual({ day: '2026-11-01', after: '2026-11-01T07:00:00.000Z', before: '2026-11-02T08:00:00.000Z' });
    expect(phDayWindow(Date.parse('2026-11-01T08:37:00Z'))).toEqual({ day: '2026-10-31', after: '2026-10-31T07:00:00.000Z', before: '2026-11-01T07:00:00.000Z' });
  });
  it('the window spans 23 hours on the day clocks go forward (8 Mar 2026) and is right either side', () => {
    expect(phDayWindow(Date.parse('2026-03-09T08:37:00Z'))).toEqual({ day: '2026-03-08', after: '2026-03-08T08:00:00.000Z', before: '2026-03-09T07:00:00.000Z' });
    expect(phDayWindow(Date.parse('2026-03-10T08:37:00Z'))).toEqual({ day: '2026-03-09', after: '2026-03-09T07:00:00.000Z', before: '2026-03-10T07:00:00.000Z' });
    expect(pacificDay(Date.parse('2026-03-09T06:59:00Z'))).toBe('2026-03-08');
  });
  it('parses the recorded answer most votes first, with topics', () => {
    const shuffled = { data: { posts: { edges: [...recorded.data.posts.edges].reverse() } } };
    const posts = parsePhPosts(shuffled);
    expect(posts.map(p => [p.name, p.votes])).toEqual([['Yoroll', 355], ['Rankhog', 340], ['Polylane Swarms', 101], ['Ulika', 93], ['Mockreel', 89]]);
    expect(posts[0]!.topics).toEqual(['artificial-intelligence', 'games', 'no-code']);
    expect(posts[0]!.topic_names).toEqual(['Artificial Intelligence', 'Games', 'No-Code']);
  });
  it('a post with no topics has an empty list; an answer without the topics field has none read', () => {
    const node = { ...recorded.data.posts.edges[0]!.node, topics: { edges: [] } };
    expect(parsePhPosts({ data: { posts: { edges: [{ node }] } } })[0]!.topics).toEqual([]);
    const { topics: _t, ...bare } = recorded.data.posts.edges[0]!.node;
    expect(parsePhPosts({ data: { posts: { edges: [{ node: bare }] } } })[0]!.topics).toBeNull();
  });
  it('rows keep votes and topics and drop a post made at the instant the next day starts', () => {
    const w = phDayWindow(Date.parse('2026-11-23T08:37:00Z')), posts = parsePhPosts(recorded);
    const rows = phRows(posts, new Map(), w);
    expect(rows.map(r => r.title.split(' — ')[0])).toEqual(['Yoroll', 'Rankhog', 'Ulika', 'Mockreel']);
    expect(rows[0]).toMatchObject({ votes: 355, topics: ['artificial-intelligence', 'games', 'no-code'], published_at: '2026-11-22T08:01:00.000Z', excerpt: '355 upvotes' });
  });
  it('a refused query (errors, no posts) is told apart from an empty day', () => {
    expect(phRefused({ errors: [{ message: 'x' }] })).toBe(true);
    expect(phRefused({ data: { posts: { edges: [] } } })).toBe(false);
  });
});
describe('seed candidates', () => {
  it('returns registrable domains and excludes social, hosting and app stores', () => {
    expect(seedDomain('https://shop.studio.co.uk/a')).toBe('studio.co.uk');
    for (const u of ['https://x.com/a', 'https://me.github.io/', 'https://apps.apple.com/app', 'https://play.google.com/x', 'https://site.vercel.app', 'https://foo.framer.website', 'http://10.0.0.1/']) expect(seedDomain(u)).toBeNull();
  });
  it('merges sources per domain with the first sighting', () => {
    expect(seedCandidates([{ link: 'https://a.studio/x', source_kind: 'arena', fetched_at: '2026-11-10T00:00:00Z' }, { link: 'https://www.a.studio/', source_kind: 'producthunt', fetched_at: '2026-11-08T00:00:00Z' }, { link: 'https://instagram.com/p', source_kind: 'arena', fetched_at: '2026-11-09T00:00:00Z' }]))
      .toEqual([{ domain: 'a.studio', sources: ['producthunt'], first_seen: '2026-11-08T00:00:00.000Z' }]);
  });
  it('Are.na is hard-off and never seeds domains', () => {
    expect(ARENA_ENABLED).toBe(false);
    expect(seedCandidates([{ link: 'https://only-arena.studio/', source_kind: 'arena', fetched_at: '2026-11-10T00:00:00Z' }])).toEqual([]);
  });
});
