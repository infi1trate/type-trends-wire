// M2a · App Store listings: the ingest contract (POST /api/public/ingest-listings), per-row checks and the stored-row comparisons. The
// crawler reads each chart app's listing and sends text openings, counts and measured screenshot colours; no picture is ever sent,
// fetched or stored. Pure: no I/O.
import { z } from "zod";
import { ICON_LIMITS, dayProblem, linkOk, oldestKept, weekOfDay } from "../icons/contract";

export { dayProblem, linkOk, oldestKept, weekOfDay };
export const LISTING_LIMITS = { requestBytes: 256 * 1024, maxApps: 25, maxParts: 8, keepWeeks: ICON_LIMITS.keepWeeks, shareSum: ICON_LIMITS.shareSum } as const;
const HEX = /^#[0-9A-Fa-f]{6}$/;
const iso = z.string().datetime({ offset: true });
const palette = z.array(z.object({ hex: z.string().regex(HEX), share: z.number().min(0).max(1) }).strict()).min(1).max(8);
export const listingApp = z.object({
  rank: z.number().int().min(1).max(100),
  app_id: z.string().regex(/^\d{1,20}$/),
  name: z.string().trim().min(1).max(120),
  maker: z.string().trim().min(1).max(120),
  link: z.string().url().max(300),
  genre: z.string().max(60).nullable(),
  price: z.number().min(0).max(9999.99).nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  version: z.string().max(40).nullable(),
  version_at: iso.nullable(),
  first_at: iso.nullable(),
  notes: z.string().max(800).nullable(),
  notes_chars: z.number().int().min(0),
  about: z.string().max(600).nullable(),
  about_chars: z.number().int().min(0),
  about_words: z.number().int().min(0),
  rating: z.number().min(0).max(5).nullable(),
  ratings: z.number().int().min(0).nullable(),
  size_mb: z.number().positive().nullable(),
  min_os: z.string().max(12).nullable(),
  languages: z.number().int().min(0).max(400).nullable(),
  age: z.string().max(8).nullable(),
  site: z.string().max(120).regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/, "bare lower-case host").nullable(),
  shots: z.object({
    phone: z.number().int().min(0).max(40), pad: z.number().int().min(0).max(40), tv: z.number().int().min(0).max(40),
    way: z.enum(["portrait", "landscape", "mixed"]).nullable(),
    palettes: z.array(palette).max(2),
  }).strict(),
}).strict();
export type ListingApp = z.infer<typeof listingApp>;
export const listingPayload = z.object({
  run_id: z.string().min(1).max(120),
  store: z.enum(["us"]),
  chart: z.enum(["top-free"]),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  genre: z.object({ id: z.number().int().min(1).max(2_147_483_647), name: z.string().trim().min(1).max(60) }).strict(),
  part: z.number().int().min(1),
  parts: z.number().int().min(1).max(LISTING_LIMITS.maxParts),
  apps: z.array(z.unknown()).min(1).max(LISTING_LIMITS.maxApps),
}).strict().refine(p => p.parts >= p.part, { message: "parts: must be at least part", path: ["parts"] });
export type ListingPayload = z.infer<typeof listingPayload>;
export type ListingRefusal = "invalid" | "wrong_link_host" | "palette_shares" | "duplicate_app" | "duplicate_rank" | "removed";

export function checkListing(a: ListingApp): { ok: true } | { ok: false; reason: ListingRefusal } {
  if (!linkOk(a.link)) return { ok: false, reason: "wrong_link_host" };
  if (a.shots.palettes.some(p => p.reduce((s, c) => s + c.share, 0) > LISTING_LIMITS.shareSum)) return { ok: false, reason: "palette_shares" };
  return { ok: true };
}

/** Stored row shapes (the fields compared; ids and timestamps the store keeps aside). */
export type ListingRow = { store: string; app_id: string; name: string; maker: string; link: string; genre: string | null; site: string | null; first_at: string | null; about: string | null; about_chars: number; about_words: number; about_changed_at: string | null };
export type VersionRow = { store: string; app_id: string; version: string; version_at: string | null; notes: string | null; notes_chars: number; price: number | null; currency: string | null; size_mb: number | null; min_os: string | null; languages: number | null; age: string | null; shots: ListingApp["shots"] };
export type WeekRow = { week: string; store: string; chart: string; genre_id: number; app_id: string; genre_name: string; day: string; rank: number; rating: number | null; ratings: number | null; version: string };

const t = (s: string | null) => (s ? Date.parse(s) : null);
/** Screenshot facts in one fixed order: the database returns a stored object's keys in its own order (jsonb), so comparing the
 *  objects as text would call every stored version changed and rewrite it each week. */
export const shotsKey = (x: ListingApp["shots"] | null | undefined) => x ? [x.phone ?? 0, x.pad ?? 0, x.tv ?? 0, x.way ?? null, (x.palettes ?? []).map(p => p.map(c => [String(c.hex).toUpperCase(), Number(c.share)]))] : null;
export const listingKey = (r: Omit<ListingRow, "about_changed_at">) => JSON.stringify([r.name, r.maker, r.link, r.genre, r.site, t(r.first_at), r.about, r.about_chars, r.about_words]);
export const versionKey = (r: VersionRow) => JSON.stringify([t(r.version_at), r.notes, r.notes_chars, r.price === null ? null : Number(r.price), r.currency, r.size_mb === null ? null : Number(r.size_mb), r.min_os, r.languages, r.age, shotsKey(r.shots)]);
export const weekKey = (r: WeekRow) => JSON.stringify([r.genre_name, r.day, r.rank, r.rating === null ? null : Number(r.rating), r.ratings, r.version]);

export function rowsFor(a: ListingApp, p: Pick<ListingPayload, "store" | "chart" | "day" | "genre">) {
  const version = a.version ?? "";
  const listing: Omit<ListingRow, "about_changed_at"> = { store: p.store, app_id: a.app_id, name: a.name, maker: a.maker, link: a.link, genre: a.genre, site: a.site, first_at: a.first_at, about: a.about, about_chars: a.about_chars, about_words: a.about_words };
  const ver: VersionRow = { store: p.store, app_id: a.app_id, version, version_at: a.version_at, notes: a.notes, notes_chars: a.notes_chars, price: a.price, currency: a.currency, size_mb: a.size_mb, min_os: a.min_os, languages: a.languages, age: a.age, shots: a.shots };
  const week: WeekRow = { week: weekOfDay(p.day), store: p.store, chart: p.chart, genre_id: p.genre.id, app_id: a.app_id, genre_name: p.genre.name, day: p.day, rank: a.rank, rating: a.rating, ratings: a.ratings, version };
  return { listing, ver, week };
}
