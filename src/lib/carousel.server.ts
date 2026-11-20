// Carousel flags per snapshot (carousel.ts), read anonymously from the public signals column. Failures read as "no carousel", so a page
// never breaks on the label (the engine then judges the change as before).
import type { supabaseAnon } from "./mcp/supabase";
import { carouselEventIds } from "./carousel";

type Db = ReturnType<typeof supabaseAnon>;
/** Snapshot ids whose signals say the first screen is a carousel, 200 ids a request. */
export async function carouselSnapshots(db: Db, ids: (number | null | undefined)[]): Promise<Set<number>> {
  const want = [...new Set(ids.filter((x): x is number => typeof x === "number"))], out = new Set<number>();
  for (let i = 0; i < want.length; i += 200) {
    const { data, error } = await db.from("library_snapshots").select("id,hc:signals->layout->hero_carousel").in("id", want.slice(i, i + 200));
    if (error) throw error;
    for (const r of (data ?? []) as unknown as { id: number; hc?: unknown }[]) if (r.hc === true) out.add(r.id);
  }
  return out;
}
/** Event ids whose change is a carousel rotation. Never throws. */
export async function carouselIds(db: Db, events: { id: number; type: string; before?: unknown; after?: unknown; snapshot_id?: number | null; prev_snapshot_id?: number | null }[]): Promise<number[]> {
  try { return [...carouselEventIds(events, await carouselSnapshots(db, events.flatMap(e => [e.snapshot_id, e.prev_snapshot_id])))]; } catch { return []; }
}
