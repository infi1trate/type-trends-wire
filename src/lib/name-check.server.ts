// I3b · loads the brand-name check (name-check.ts) for the health payload: active brands, then each one's newest live desktop home
// capture within NAME_CHECK_DAYS (title and headline paths only). Anonymous SELECT-only; computed at most every six hours per instance.
import { supabaseAnon } from "./mcp/supabase";
import { memo } from "./memo";
import { brandName } from "./brand-names";
import { nameCheck, NAME_CHECK_DAYS, type NameCheck, type NameCheckSite } from "./name-check";

export const brandNameCheck = memo(6 * 3600_000, async (): Promise<NameCheck> => {
  const db = supabaseAnon(), now = new Date(), since = new Date(now.getTime() - NAME_CHECK_DAYS * 864e5).toISOString();
  const sites: { domain: string; name: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("library_sites").select("domain,name").eq("active", true).order("domain").range(from, from + 999);
    if (error) throw error;
    sites.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const latest = new Map<string, { title: string | null; h1: string | null; captured_at: string }>();
  for (let from = 0; ; from += 500) {
    const { data, error } = await db.from("library_snapshots").select("domain,captured_at,title:signals->>title,h1:signals->lexicon->>h1").eq("page_type", "home").eq("viewport", "desktop").eq("source", "live").gte("captured_at", since).order("id", { ascending: false }).range(from, from + 499);
    if (error) throw error;
    for (const r of (data ?? []) as unknown as { domain: string; captured_at: string; title: string | null; h1: string | null }[]) if (!latest.has(r.domain)) latest.set(r.domain, r);
    if (!data || data.length < 500) break;
  }
  const rows: NameCheckSite[] = sites.map(s => { const l = latest.get(s.domain); return { domain: s.domain, names: [s.name, brandName(s.domain)], title: l?.title ?? null, h1: l?.h1 ?? null, captured_at: l?.captured_at ?? null }; });
  return nameCheck(rows, now);
});
