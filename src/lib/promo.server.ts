// Snapshot texts for the seasonal check (promo.ts): headline, sub-headline and button labels, read anonymously from public lexicon fields.
import type { supabaseAnon } from "./mcp/supabase";
import { PROMO_COLS, promoTexts, seasonalEventIds } from "./promo";

type Db = ReturnType<typeof supabaseAnon>;
/** Texts per snapshot id, 200 ids a request. */
export async function snapshotTexts(db: Db, ids: (number | null | undefined)[]): Promise<Map<number, string[]>> {
  const want = [...new Set(ids.filter((x): x is number => typeof x === "number"))], out = new Map<number, string[]>();
  for (let i = 0; i < want.length; i += 200) {
    const { data, error } = await db.from("library_snapshots").select(`id,${PROMO_COLS}`).in("id", want.slice(i, i + 200));
    if (error) throw error;
    for (const r of (data ?? []) as unknown as { id: number; lx_h1?: unknown; lx_h2?: unknown; lx_ctas?: unknown }[]) out.set(r.id, promoTexts(r));
  }
  return out;
}
/** Event ids whose change happened on a seasonal capture. Failures read as "not seasonal" so a page never breaks on the label. */
export async function seasonalIds(db: Db, events: { id: number; snapshot_id?: number | null; prev_snapshot_id?: number | null }[]): Promise<number[]> {
  try { return [...seasonalEventIds(events, await snapshotTexts(db, events.flatMap(e => [e.snapshot_id, e.prev_snapshot_id])))]; } catch { return []; }
}
