// I3b · the brands tracked now (library_sites.active), read anonymously. Shares, history and signal pages already read only active
// brands through their views; the latest changes, story candidates, rebrands, studies and lead pictures filter through this set.
import { supabaseAnon } from "./mcp/supabase";
import { memo } from "./memo";

export const activeDomains = memo(60_000, async (): Promise<ReadonlySet<string>> => {
  const db = supabaseAnon(), out = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("library_sites").select("domain").eq("active", true).order("domain").range(from, from + 999);
    if (error) throw error;
    for (const r of data ?? []) out.add(r.domain);
    if (!data || data.length < 1000) break;
  }
  return out;
});

/** R2a · the panel: active brands with panel_since. Latest changes, the story queue, briefs and RSS read only these. */
export const panelDomains = memo(60_000, async (): Promise<ReadonlySet<string>> => {
  const { panelDomainSet } = await import("./history.server");
  return panelDomainSet(supabaseAnon());
});

/** R2a-2 · library_event_feed and library_redesigns join library_sites without an active filter: every reader of them keeps panel rows only. */
export async function panelRowsOnly<T extends { domain?: string | null }>(rows: readonly T[]): Promise<T[]> {
  const p = await panelDomains();
  return rows.filter(r => !!r.domain && p.has(r.domain));
}

/** Rows of brands in the library only. Pictures, crops, thumbnails and stored records exist for every brand the crawler reads,
 *  including brands still onboarding and brands no longer tracked; a list that spans brands must show none of those. */
export async function activeRowsOnly<T extends { domain: string }>(rows: readonly T[]): Promise<T[]> {
  const active = await activeDomains();
  return rows.filter(r => active.has(r.domain));
}
