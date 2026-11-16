// Reads of the library_site_history view (one sample per brand per quarter, computed from raw captures on every read). The view sorts
// all of its rows before any LIMIT, so each 1000-row page costs about the whole view; a domain filter, by contrast, is pushed down into
// it. Reading by domain range keeps each request to a fraction of the view, well inside the anonymous statement timeout.
import type { supabaseAnon } from "./mcp/supabase";

/** Domain boundaries the history is read between (one request per slice, about 300–650 rows and under a second each today). */
export const HISTORY_SLICES = ["g", "n"] as const;
/** [from, to) domain ranges covering every domain, in order: [start, "g"), ["g", "n"), ["n", end]. */
export const historyRanges = (bounds: readonly string[] = HISTORY_SLICES) => [null, ...bounds].map((from, i) => ({ from, to: bounds[i] ?? null }));

type Db = ReturnType<typeof supabaseAnon>;
/** Every history row with `cols`, ordered by domain then quarter, read one domain slice at a time (paged within a slice past 1000). */
export async function historyRows<T>(db: Db, cols: string, bounds: readonly string[] = HISTORY_SLICES): Promise<T[]> {
  const out: T[] = [];
  for (const r of historyRanges(bounds)) {
    for (let from = 0; ; from += 1000) {
      let q = db.from("library_site_history").select(cols);
      if (r.from != null) q = q.gte("domain", r.from);
      if (r.to != null) q = q.lt("domain", r.to);
      const { data, error } = await q.order("domain").order("quarter").range(from, from + 999);
      if (error) throw error;
      out.push(...((data ?? []) as T[]));
      if (!data || data.length < 1000) break;
    }
  }
  return out;
}
