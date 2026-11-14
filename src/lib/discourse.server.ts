// Discourse vocabulary from public taste tables + privileged count merges. Service-role only.
import { buildTerms, termsVersion, type CountRow, type DiscourseTerm } from "./discourse";
import { isNonType } from "./taste/fonts";
import type { Json } from "@/integrations/supabase/types";
type Db = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

async function pages<T>(f: (from: number) => PromiseLike<{ data: T[] | null; error: unknown }>) { const out: T[] = []; for (let from = 0; ; from += 1000) { const { data, error } = await f(from); if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < 1000) break; } return out; }

export async function loadTerms(db: Db): Promise<{ version: string; terms: DiscourseTerm[] }> {
  const [usage, catalog, tickers] = await Promise.all([
    pages(f => db.from("font_usage").select("key,sites:data->sites").eq("scope", "all").order("key").order("role").range(f, f + 999)),
    pages(f => db.from("font_catalog").select("key,family,license_hint").order("key").range(f, f + 999)),
    pages(f => db.from("color_tickers").select("key").eq("scope", "all").order("key").range(f, f + 999)),
  ]);
  const sites = new Map<string, number>();
  for (const u of usage) sites.set(u.key, Math.max(sites.get(u.key) ?? 0, Number(u.sites ?? 0) || 0));
  const fonts = catalog.filter(c => c.license_hint !== "system" && !isNonType(c.family)).map(c => ({ family: c.family, sites: sites.get(c.key) ?? 0 }));
  const hues = [...new Set(tickers.map(t => t.key.split("·")[0] ?? "").filter(h => h && h !== "neutral"))];
  const terms = buildTerms({ fonts, hues });
  return { version: termsVersion(terms), terms };
}

export async function mergeCounts(db: Db, rows: CountRow[], add: boolean): Promise<number> {
  let written = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const { data, error } = await db.rpc("discourse_merge", { p_rows: rows.slice(i, i + 500) as unknown as Json, p_add: add });
    if (error) throw new Error("Discourse count merge failed");
    written += Number(data ?? 0);
  }
  return written;
}
