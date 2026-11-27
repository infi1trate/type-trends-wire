// Reads of the site history: one sample per brand per quarter. Pages read the stored rows (`library_site_history_rows`, the facade over
// `library_site_history_store`, replaced per brand by the scheduled history job as captures land, U2c) instead of the live `library_site_history` view, which
// recomputed every capture on every page. The stored rows carry the view's exact columns (checked equal on 21 Nov 2026: 1,552 rows,
// same md5 over every column); the live view stays for anything outside the app.
import type { supabaseAnon } from "./mcp/supabase";

/** The one relation the app reads site history from. */
export const SITE_HISTORY = "library_site_history_rows" as const;
/** Rows per request (the API's row cap). */
export const HISTORY_PAGE = 1000;

type Db = ReturnType<typeof supabaseAnon>;
/** PostgREST `or` value: double-quoted so dots and commas in domains stay one value. */
const quote = (v: string) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
/** The keyset filter after (domain, quarter): rows strictly later in (domain, quarter) order. Pure, exported for tests. */
export const afterKey = (k: { domain: string; quarter: string }) => `domain.gt.${quote(k.domain)},and(domain.eq.${quote(k.domain)},quarter.gt.${quote(k.quarter)})`;
/** `cols` plus the keyset columns, so the walk can always continue. */
export const withKeys = (cols: string) => (cols.trim() === "*" ? "*" : [...new Set(["domain", "quarter", ...cols.split(",").map(c => c.trim()).filter(Boolean)])].join(","));

/** Every stored history row with `cols`, in (domain, quarter) order: a keyset walk on the unique (domain, quarter) index, one request
 *  per 1,000 rows (two today), never offset paging. `now`: only the current sample (true) or only earlier quarters (false). */
export async function historyRows<T>(db: Db, cols: string, o: { now?: boolean } = {}): Promise<T[]> {
  const out: T[] = [];
  let last: { domain: string; quarter: string } | null = null;
  for (;;) {
    let q = db.from(SITE_HISTORY).select(withKeys(cols));
    if (o.now !== undefined) q = q.eq("now", o.now);
    if (last) q = q.or(afterKey(last));
    const { data, error } = await q.order("domain").order("quarter").limit(HISTORY_PAGE);
    if (error) throw error;
    const rows = (data ?? []) as unknown as (T & { domain: string; quarter: string })[];
    out.push(...rows);
    if (rows.length < HISTORY_PAGE) break;
    const tail = rows[rows.length - 1]!;
    last = { domain: tail.domain, quarter: tail.quarter };
  }
  return out;
}

/** R2c · when each panel brand joined (domain → panel_since). Readers of changes use it through active-sites.server's panelRowsOnly. */
export async function panelSinceMap(db: Db): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let f = 0; ; f += HISTORY_PAGE) {
    const { data, error } = await db.from("library_sites").select("domain,panel_since").eq("active", true).order("domain").range(f, f + HISTORY_PAGE - 1);
    if (error) throw error;
    for (const r of (data ?? []) as { domain: string; panel_since: string | null }[]) if (r.panel_since != null) out.set(r.domain, r.panel_since);
    if (!data || data.length < HISTORY_PAGE) break;
  }
  return out;
}
/** R2a · the domains in the panel (active, with panel_since). Shares and trends read only these; brand pages read everything. */
export async function panelDomainSet(db: Db): Promise<Set<string>> {
  const out = new Set<string>();
  for (let f = 0; ; f += HISTORY_PAGE) {
    const { data, error } = await db.from("library_sites").select("domain,panel_since").eq("active", true).order("domain").range(f, f + HISTORY_PAGE - 1);
    if (error) throw error;
    for (const r of (data ?? []) as { domain: string; panel_since: string | null }[]) if (r.panel_since != null) out.add(r.domain);
    if (!data || data.length < HISTORY_PAGE) break;
  }
  return out;
}
/** History over the panel only: every share, trend, forecast and story input reads this, so an onboarding brand changes none of them. */
export async function panelHistoryRows<T>(db: Db, cols: string, o: { now?: boolean } = {}): Promise<T[]> {
  const [rows, panel] = await Promise.all([historyRows<T & { domain: string }>(db, cols, o), panelDomainSet(db)]);
  return rows.filter(r => panel.has(r.domain));
}
