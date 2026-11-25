// The front page's tape (E3): the last 14 days of live changes from the public change feed, their stored integrity checks, then the
// marks (Seasonal, Carousel, Reversed) for the eight lines shown only. Anonymous SELECT-only. E3b: stored as the `front-tape` record
// by the build that computes the checks; deferred on the page (never in front of the first byte).
import { stored } from "../records/store.server";
import { supabaseAnon } from "../mcp/supabase";
import { confirmedTape, frontTape, withAssetLines, FRONT_TAPE_DAYS, FRONT_TAPE_MAX, type FrontTape, type TapeEvent } from "./tape-block";

const COLS = "id,domain,type,before,after,detected_at,page_type,viewport,summary,source,snapshot_id,prev_snapshot_id";
type Row = TapeEvent & { snapshot_id: number | null; prev_snapshot_id: number | null };
async function load(): Promise<FrontTape> {
  const db = supabaseAnon(), now = Date.now(), since = new Date(now - FRONT_TAPE_DAYS * 864e5).toISOString(), events: Row[] = [];
  for (let from = 0; from < 10000; from += 1000) {
    const { data, error } = await db.from("library_event_feed").select(COLS).eq("source", "live").gte("detected_at", since).order("detected_at", { ascending: false }).order("id", { ascending: false }).range(from, from + 999);
    if (error) throw error;
    for (const e of data ?? []) if (e.id != null && e.domain && e.type && e.detected_at) events.push(e as Row);
    if (!data || data.length < 1000) break;
  }
  // I3b: only brands tracked now (an address that turned out to be another business leaves the latest changes).
  const active = await (await import("../active-sites.server")).activeDomains();
  events.splice(0, events.length, ...events.filter(e => active.has(e.domain)));
  const [{ latestChecks }, { reversalIds }] = await Promise.all([import("../integrity.server"), import("../reversal")]);
  const checks = await latestChecks(db, events.map(e => e.id));
  // Marks are read only for the changes behind the lines shown (each line can stand for several sightings).
  const first = confirmedTape(events, checks, now).rows.slice(0, FRONT_TAPE_MAX), ids = new Set(first.flatMap(r => [r.id, ...r.also]));
  const shown = events.filter(e => ids.has(e.id));
  const [{ seasonalIds }, { carouselIds }, { picturesSafe }, { iconsFor }] = await Promise.all([import("../promo.server"), import("../carousel.server"), import("../pictures.server"), import("../pictures")]);
  const [seasonal, carousel, pics] = await Promise.all([
    seasonalIds(db, shown).then(x => new Set(x)).catch(() => new Set<number>()),
    carouselIds(db, shown).then(x => new Set(x)).catch(() => new Set<number>()),
    picturesSafe(),
  ]);
  const reversed = reversalIds(events.map(e => ({ id: e.id, domain: e.domain, page_type: e.page_type ?? null, viewport: e.viewport ?? null, detected_at: e.detected_at, before: e.before, after: e.after })));
  const tape = frontTape(events, checks, { now, labels: e => ({ seasonal: seasonal.has(e.id), carousel: carousel.has(e.id), reversed: reversed.has(e.id) }), icons: iconsFor(pics, first.map(r => r.domain)) });
  // W1b: confirmed icon and card changes (perceptual, two captures each side) as lines in the latest changes with their old and new pictures.
  const assets = await (await import("../asset-changes.server")).confirmedAssetChanges(FRONT_TAPE_DAYS, now).catch(() => []);
  const [{ assetChangeWhat, assetChangeWhen }, { brandName }, { cropSrc }] = await Promise.all([import("../asset-diff"), import("../brand-names"), import("../crops")]);
  const lines = assets.filter(c => active.has(c.domain)).map(c => ({ name: brandName(c.domain, null), what: assetChangeWhat(c.kind), when: assetChangeWhen(c), marks: [], id: -c.to.id, domain: c.domain, at: c.confirmed_at ?? c.to.last_seen_at,
    href: `/brands/${encodeURIComponent(c.domain)}`, icon: iconsFor(pics, [c.domain])[c.domain] ?? null,
    pair: { kind: c.kind as "icon" | "card", before: { src: cropSrc(c.from.path), w: c.from.width, h: c.from.height }, after: { src: cropSrc(c.to.path), w: c.to.width, h: c.to.height }, alt: `${brandName(c.domain, null)}'s ${c.kind === "icon" ? "site icon" : "social share image"}, before and after` } }));
  return withAssetLines(tape, lines);
}
/** E3b: pages read the stored `front-tape` record (written by the story build right after it runs, and by the records sweeper);
 *  only when the record is missing or too old does a visit compute it live. */
export const frontTapeRecord = stored("front-tape", load, { ttl: 60_000 });
export const loadFrontTape = () => frontTapeRecord();
