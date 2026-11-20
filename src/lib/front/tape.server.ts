// The front page's tape (E3): the last 14 days of live changes from the public change feed, their stored integrity checks, then the
// marks (Seasonal, Carousel, Reversed) for the eight lines shown only. Anonymous SELECT-only; memoised briefly; deferred on the page
// (never part of the critical read).
import { memo } from "../memo";
import { supabaseAnon } from "../mcp/supabase";
import { confirmedTape, frontTape, FRONT_TAPE_DAYS, FRONT_TAPE_MAX, type FrontTape, type TapeEvent } from "./tape-block";

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
  return frontTape(events, checks, { now, labels: e => ({ seasonal: seasonal.has(e.id), carousel: carousel.has(e.id), reversed: reversed.has(e.id) }), icons: iconsFor(pics, first.map(r => r.domain)) });
}
export const loadFrontTape = memo(60_000, load);
