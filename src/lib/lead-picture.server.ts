// I3 · the one batched, cached picture lookup behind leadPicture(): stored crop quality, fold thumbnails, the pictures index (icons,
// social cards, hero crops) and which brands' first screens rotate. Anonymous SELECT-only, memoised per instance; never throws, so a
// page without its lead picture still renders (the plan falls back down its chain).
import { memo } from "./memo";
import { supabaseAnon } from "./mcp/supabase";
import { heroCrop, type Crop } from "./crops";
import { coverOf } from "./pictures";
import { leadQuality, type LeadPics } from "./lead-picture";
import type { ThumbRow } from "./thumbs";

type QualityRow = { path: string; lead_ok: boolean };
const qualityIndex = memo(10 * 60_000, async () => {
  const out = new Map<string, boolean>();
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await supabaseAnon().from("crop_quality").select("path,lead_ok").order("path").range(from, from + 999);
    if (error) throw error;
    for (const r of (data ?? []) as QualityRow[]) out.set(r.path, r.lead_ok);
    if (!data || data.length < 1000) break;
  }
  return out;
});
/** Brands whose live home page was flagged as a rotating hero in the last three days (index-covered, one read). */
const carouselIndex = memo(10 * 60_000, async () => {
  const since = new Date(Date.now() - 3 * 86_400_000).toISOString(), out = new Set<string>();
  const { data, error } = await supabaseAnon().from("library_snapshot_fields").select("domain").eq("source", "live").eq("hero_carousel", true).gt("captured_at", since).limit(2000);
  if (error) throw error;
  for (const r of (data ?? []) as { domain: string }[]) out.add(r.domain);
  return out;
});

/** Whether a crop may lead: its stored pixel measurement, else the byte-density rule over its stored size. */
export const cropOk = (quality: ReadonlyMap<string, boolean>) => (c: Crop) => {
  const stored = quality.get(c.src.replace(/^\/crops\//, ""));
  return stored ?? leadQuality({ width: c.width, height: c.height, bytes: c.bytes ?? null, domain: c.domain }).ok;
};

export async function leadPics(name: (domain: string) => string = d => d): Promise<LeadPics> {
  const [{ picturesSafe }, read, { pickThumb }] = await Promise.all([import("./pictures.server"), import("./read.server"), import("./thumbs")]);
  const [quality, carousel, pics, thumbs, active] = await Promise.all([
    qualityIndex().catch(() => new Map<string, boolean>()), carouselIndex().catch(() => new Set<string>()), picturesSafe(), read.allThumbs().catch(() => [] as ThumbRow[]),
    import("./active-sites.server").then(m => m.activeDomains()),
  ]);
  // I3b: no picture of a brand that is not tracked now.
  const ok = cropOk(quality);
  return {
    okCrop: c => active.has(c.domain) && ok(c),
    hero: d => { const h = active.has(d) ? pics.get(d)?.hero : null; return h ? heroCrop(d, h) : null; },
    thumb: d => (active.has(d) ? pickThumb(thumbs, d) : null),
    card: d => { const p = active.has(d) ? pics.get(d) : null; return p ? coverOf(d, p) : null; },
    carousel: d => carousel.has(d),
    name,
    icon: d => pics.get(d)?.icon ?? null,
  };
}
/** The lead-quality test alone (cards and rows drop crops that fail it). */
export async function cropOkFn(): Promise<(c: Crop) => boolean> { return cropOk(await qualityIndex().catch(() => new Map<string, boolean>())); }
