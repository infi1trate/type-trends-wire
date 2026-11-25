/** R2a-2 · archive gaps: upsert on (domain, quarter); domains not in library_sites are skipped and counted. */
import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
export type Gap = { domain: string; quarter: string; reason: "no_capture" | "unreadable" };
export async function storeArchiveGaps(run_id: string, gaps: readonly Gap[]): Promise<{ written: number; skipped_unknown: number }> {
  const domains = [...new Set(gaps.map(g => g.domain))], known = new Set<string>();
  for (let i = 0; i < domains.length; i += 200) {
    const { data, error } = await db.from("library_sites").select("domain").in("domain", domains.slice(i, i + 200)).range(0, 999);
    if (error) throw new Error("Archive gap site lookup failed");
    for (const r of data ?? []) known.add(r.domain);
  }
  // Last entry wins for a repeated (domain, quarter) inside one post.
  const rows = [...new Map(gaps.filter(g => known.has(g.domain)).map(g => [`${g.domain}|${g.quarter}`, { ...g, run_id, noted_at: new Date().toISOString() }])).values()];
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from("library_archive_gaps").upsert(rows.slice(i, i + 500), { onConflict: "domain,quarter" });
    if (error) throw new Error("Archive gap write failed");
  }
  return { written: rows.length, skipped_unknown: gaps.length - gaps.filter(g => known.has(g.domain)).length };
}
