// Carousel flags per snapshot (carousel.ts), read anonymously from the public signals column. Failures read as "no carousel", so a page
// never breaks on the label (the engine then judges the change as before).
import type { supabaseAnon } from "./mcp/supabase";
import { carouselEventIds, inheritedCarousel, type FlagCapture } from "./carousel";

type Db = ReturnType<typeof supabaseAnon>;
/** Snapshot ids on a carousel, 200 ids a request. A live capture with no `hero_carousel` key takes the value of the nearest later flagged
 *  capture of the same brand, page and viewport (E2f, inheritedCarousel); archive captures are judged only on their own key. */
export async function carouselSnapshots(db: Db, ids: (number | null | undefined)[]): Promise<Set<number>> {
  const want = [...new Set(ids.filter((x): x is number => typeof x === "number"))];
  type Row = { id: number; domain: string; page_type: string; viewport: string; captured_at: string; source: string; hc?: unknown };
  const rows: Row[] = [];
  const chunks = Array.from({ length: Math.ceil(want.length / 200) }, (_, i) => want.slice(i * 200, i * 200 + 200));
  for (let i = 0; i < chunks.length; i += 6) // at most six requests at once
    for (const { data, error } of await Promise.all(chunks.slice(i, i + 6).map(c => db.from("library_snapshots").select("id,domain,page_type,viewport,captured_at,source,hc:signals->layout->hero_carousel").in("id", c)))) {
      if (error) throw error;
      rows.push(...((data ?? []) as unknown as Row[]));
    }
  const page = (r: Pick<Row, "domain" | "page_type" | "viewport">) => `${r.domain}|${r.page_type}|${r.viewport}`;
  const flag = (r: Row) => (typeof r.hc === "boolean" ? r.hc : null);
  const missing = rows.filter(r => flag(r) === null && r.source === "live");
  const keyed: FlagCapture[] = [];
  if (missing.length) {
    // Inheriting can only make a capture a carousel where the page has a flagged-true capture, so only those brands are read in full.
    const asked = new Set(missing.map(r => r.domain)), from = missing.map(r => r.captured_at).sort()[0]!, flagged = new Set<string>();
    for (let off = 0; ; off += 1000) {
      const { data, error } = await db.from("library_snapshots").select("domain").eq("source", "live").gt("captured_at", from).eq("signals->layout->hero_carousel", true).order("id").range(off, off + 999);
      if (error) throw error;
      for (const r of (data ?? []) as { domain: string }[]) if (asked.has(r.domain)) flagged.add(r.domain);
      if (!data || data.length < 1000) break;
    }
    const domains = [...flagged];
    for (let i = 0; i < domains.length; i += 25) {
      for (let off = 0; ; off += 1000) {
        const { data, error } = await db.from("library_snapshots").select("id,domain,page_type,viewport,captured_at,source,hc:signals->layout->hero_carousel")
          .in("domain", domains.slice(i, i + 25)).eq("source", "live").gt("captured_at", from).not("signals->layout->hero_carousel", "is", null).order("id").range(off, off + 999);
        if (error) throw error;
        for (const r of (data ?? []) as unknown as Row[]) keyed.push({ id: r.id, page: page(r), at: r.captured_at, flag: flag(r) });
        if (!data || data.length < 1000) break;
      }
    }
  }
  // Archive captures never inherit (their page key is their own id).
  return inheritedCarousel(rows.map(r => ({ id: r.id, page: r.source === "live" ? page(r) : `archive|${r.id}`, at: r.captured_at, flag: flag(r) })), keyed);
}
/** Event ids whose change is a carousel rotation. Never throws. */
export async function carouselIds(db: Db, events: { id: number; type: string; before?: unknown; after?: unknown; snapshot_id?: number | null; prev_snapshot_id?: number | null }[]): Promise<number[]> {
  try { return [...carouselEventIds(events, await carouselSnapshots(db, events.flatMap(e => [e.snapshot_id, e.prev_snapshot_id])))]; } catch { return []; }
}
