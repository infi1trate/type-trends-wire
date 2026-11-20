// Precomputed public page inputs (Phase P1): which records exist, how old each may be when a page reads it, and when a job should
// rewrite it. Pure and dependency-free; `store.server.ts` reads and writes the `read_records` table, `refresh.server.ts` computes.
// A record is only ever a copy of something a public page could already compute from public rows, so serving it changes no numbers.

export type RecordRow<T = unknown> = { key: string; body: T; computed_at: string };
export type RecordMeta = { key: string; kind: string; computed_at: string };

const MIN = 60_000, HOUR = 60 * MIN;
/** Shared inputs: one record each. `maxAge`: older than this, a page computes live instead; `every`: the sweeper rewrites it this often. */
export const SHARED = {
  "site-index": { maxAge: 3 * HOUR, every: 15 * MIN },
  signals: { maxAge: 3 * HOUR, every: 15 * MIN },
  rebrands: { maxAge: 3 * HOUR, every: 15 * MIN },
  "moving-runs": { maxAge: 6 * HOUR, every: 30 * MIN },
  "quarter-series": { maxAge: 6 * HOUR, every: 30 * MIN },
  /** E3b · the front page's tape block and its Also today card pictures (no story text: kills and new stories never wait on them).
   *  Written by the story build right after it runs; the sweeper rewrites them when older than `every`. */
  "front-tape": { maxAge: 2 * HOUR, every: 15 * MIN },
  "front-cards": { maxAge: 2 * HOUR, every: 15 * MIN },
} as const;
export type SharedKey = keyof typeof SHARED;
/** Per-brand records (one row per tracked domain) and their ages. Cards are also rewritten whenever a new capture of the brand lands. */
export const PER_BRAND = {
  "brand-card": { maxAge: 48 * HOUR, every: 6 * HOUR },
  "brand-similar": { maxAge: 48 * HOUR, every: 30 * MIN },
  "brand-sector": { maxAge: 48 * HOUR, every: 30 * MIN },
} as const;
export type BrandKind = keyof typeof PER_BRAND;
/** Whole page models whose inputs change only when a job runs (no stories inside, so a kill never waits on them). */
export const PAGES = {
  "data-story": { maxAge: 6 * HOUR, every: 30 * MIN },
  "data-index": { maxAge: 6 * HOUR, every: 30 * MIN },
  collections: { maxAge: 6 * HOUR, every: 30 * MIN },
  collection: { maxAge: 6 * HOUR, every: 30 * MIN },
  gallery: { maxAge: 6 * HOUR, every: 30 * MIN },
  /** Digest issues of finished weeks: immutable once the week ends, so they live a week and are rechecked daily. */
  digest: { maxAge: 7 * 24 * HOUR, every: 24 * HOUR },
  "brands-index": { maxAge: 3 * HOUR, every: 15 * MIN },
} as const;
export type PageKind = keyof typeof PAGES;
export type RecordKind = SharedKey | BrandKind | PageKind;
const AGES: Record<RecordKind, { maxAge: number; every: number }> = { ...SHARED, ...PER_BRAND, ...PAGES };

export const kindOf = (key: string): string => key.split(":")[0] ?? key;
export const brandKey = (kind: BrandKind, domain: string) => `${kind}:${domain.toLowerCase()}`;
export const pageKey = (kind: PageKind, ...parts: (string | number)[]) => [kind, ...parts.map(String)].join(":");
export const maxAgeOf = (key: string): number => AGES[kindOf(key) as RecordKind]?.maxAge ?? 0;
export const everyOf = (key: string): number => AGES[kindOf(key) as RecordKind]?.every ?? HOUR;

/** A page may serve a record when it exists and is younger than its kind's max age (otherwise it computes live and stays correct). */
export function usable(row: Pick<RecordRow, "key" | "computed_at"> | null | undefined, now: number, maxAge = row ? maxAgeOf(row.key) : 0): boolean {
  if (!row) return false;
  const at = Date.parse(row.computed_at);
  return Number.isFinite(at) && now - at < maxAge && at <= now + 60_000;
}
/** The sweeper rewrites a record when it is missing, older than its kind's interval, or older than the change that dirtied it. */
export function due(meta: Pick<RecordMeta, "key" | "computed_at"> | undefined, now: number, dirtySince?: string | null, every = meta ? everyOf(meta.key) : 0): boolean {
  if (!meta) return true;
  const at = Date.parse(meta.computed_at);
  if (!Number.isFinite(at) || now - at >= every) return true;
  return !!dirtySince && Date.parse(dirtySince) > at;
}
/** Brands whose card should be rewritten, most out of date first (missing, then dirtied by a newer capture, then oldest). */
export function cardsDue(sites: { domain: string; last_snapshot_at: string | null }[], metas: Map<string, string>, now: number, also: string | null = null): string[] {
  const score = (s: { domain: string; last_snapshot_at: string | null }) => {
    const at = metas.get(brandKey("brand-card", s.domain));
    if (!at) return 0;
    const dirty = [s.last_snapshot_at, also].filter((x): x is string => !!x).some(x => Date.parse(x) > Date.parse(at));
    if (dirty) return 1;
    return now - Date.parse(at) >= PER_BRAND["brand-card"].every ? 2 : 3;
  };
  return sites.map(s => ({ d: s.domain, k: score(s), at: metas.get(brandKey("brand-card", s.domain)) ?? "" }))
    .filter(x => x.k < 3).sort((a, b) => a.k - b.k || a.at.localeCompare(b.at) || a.d.localeCompare(b.d)).map(x => x.d);
}
/** Bytes a body takes as JSON (recorded beside each row so /status can show what the pages read). */
export const bodyBytes = (body: unknown) => new TextEncoder().encode(JSON.stringify(body ?? null)).length;
