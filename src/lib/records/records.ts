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
  /** D1c · the Terminal's brand library (F3 Brands and the ticker's change line): built live it took 1.7–3.8 s on a cold server and
   *  past the reader limit the panel failed, so it is a stored copy like the Read pages. */
  library: { maxAge: 3 * HOUR, every: 15 * MIN },
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
  /** E5 · Digest issues of finished weeks hold their week's stories as they stand now (a retirement rebuilds the issue), so they are
   *  rechecked like the other pages. */
  digest: { maxAge: 6 * HOUR, every: 30 * MIN },
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

/** T1 · each stored page's age against its limit, for /api/public/health: one entry per kind (per-brand kinds by their oldest row),
 *  and one line naming every kind past its limit, so a stalled sweep shows within the hour instead of nine hours later. */
export type StoredAge = { kind: string; rows: number; oldest_at: string; age_min: number; limit_min: number; past_limit: boolean; rows_past_limit: number };
/** D1c · `tracked`: the brands still tracked; a per-brand row of a brand no longer tracked is never rewritten, so it is not counted. */
export function storedAges(metas: readonly Pick<RecordMeta, "key" | "computed_at">[], now: number, tracked?: ReadonlySet<string> | null): { line: string; past_limit: number; kinds: StoredAge[] } {
  const by = new Map<string, { rows: number; oldest: number; past: number }>();
  for (const m of metas) {
    const kind = kindOf(m.key), lim = AGES[kind as RecordKind]?.maxAge, at = Date.parse(m.computed_at);
    if (!lim || !Number.isFinite(at)) continue;
    if (tracked && kind in PER_BRAND && !tracked.has(m.key.slice(kind.length + 1))) continue;
    const b = by.get(kind) ?? { rows: 0, oldest: Infinity, past: 0 };
    b.rows++; b.oldest = Math.min(b.oldest, at); if (now - at >= lim) b.past++;
    by.set(kind, b);
  }
  const kinds = (Object.keys(AGES) as RecordKind[]).filter(k => by.has(k)).map(kind => {
    const b = by.get(kind)!, lim = AGES[kind].maxAge;
    return { kind, rows: b.rows, oldest_at: new Date(b.oldest).toISOString(), age_min: Math.max(0, Math.round((now - b.oldest) / 60_000)), limit_min: lim / 60_000, past_limit: b.past > 0, rows_past_limit: b.past };
  });
  const hm = (min: number) => (min < 120 ? `${min} min` : `${Math.round(min / 6) / 10} h`);
  const past = kinds.filter(k => k.past_limit);
  const line = !kinds.length ? "No stored pages." : !past.length ? `All ${kinds.length} kinds of stored page are within their limits (oldest ${hm(Math.max(...kinds.map(k => k.age_min)))} old).`
    : `${past.length} of ${kinds.length} kinds of stored page are past their limit, so fresh instances rebuild them live: ${past.map(k => `${k.kind} ${hm(k.age_min)} (limit ${hm(k.limit_min)}${k.rows > 1 ? `, ${k.rows_past_limit} of ${k.rows} rows` : ""})`).join("; ")}.`;
  return { line, past_limit: past.length, kinds };
}

/** D1c · an unchanged body's time is moved only in the last fifth of its limit: before that the sweep records the check instead (one
 *  small row per page, one per whole per-brand set, in `read_record_checks`), because re-timing 300 to 400 unchanged per-brand pages
 *  every pass took the sweep's whole share and the 9.5 s brands index never got its turn. */
export const RETIME_FRACTION = 0.8;
export function needsRetime(key: string, computedAt: string | null | undefined, now: number): boolean {
  const at = computedAt ? Date.parse(computedAt) : NaN;
  return !Number.isFinite(at) || now - at >= RETIME_FRACTION * maxAgeOf(key);
}
/** When the sweep last looked at a record: the later of its stored time and its last recorded check. */
export function lastLook(computedAt: string | null | undefined, checkedAt: string | null | undefined): string | undefined {
  const a = computedAt ? Date.parse(computedAt) : NaN, b = checkedAt ? Date.parse(checkedAt) : NaN;
  if (!Number.isFinite(a) && !Number.isFinite(b)) return undefined;
  return !Number.isFinite(b) || (Number.isFinite(a) && a >= b) ? computedAt! : checkedAt!;
}
/** D1c · one pass's time: a record past its limit, or that will pass it before the next pass, is urgent (it goes first, whatever it
 *  costs, and the pass gives the sweep up to 20 s). */
export const SWEEP_SOON_MS = 15 * MIN;
export const isUrgent = (age: number, limit: number) => age + SWEEP_SOON_MS >= limit;
/** The single records (shared inputs and page models) that are urgent now, most late first. Per-brand sets are left to the sweep (it
 *  knows which brands are still tracked). */
export function sweepUrgent(metas: readonly Pick<RecordMeta, "key" | "computed_at">[], now: number): string[] {
  return metas.filter(m => { const k = kindOf(m.key); return (k in SHARED || k in PAGES) && isUrgent(now - Date.parse(m.computed_at), maxAgeOf(m.key)); })
    .sort((a, b) => (maxAgeOf(a.key) - (now - Date.parse(a.computed_at))) - (maxAgeOf(b.key) - (now - Date.parse(b.computed_at))) || a.key.localeCompare(b.key)).map(m => m.key);
}
