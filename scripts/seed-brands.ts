// Apply the owner's brand seed (src/lib/brands/seed.tsv) to library_sites: fill `name` only where it is NULL and set `site_kind` only
// where it is still the default "standard", so a fresh database gets the same values and later corrections are never overwritten.
// Usage: bun scripts/seed-brands.ts --dry   (counts only)
//        bun scripts/seed-brands.ts         (writes)
import { readFileSync } from "node:fs";
import { parseSeed } from "../src/lib/brand-names";
const dry = process.argv.includes("--dry");
const { supabaseAdmin: db } = await import("../src/integrations/supabase/client.server");
const seed = parseSeed(readFileSync(new URL("../src/lib/brands/seed.tsv", import.meta.url), "utf8"));
const { data: sites, error } = await db.from("library_sites").select("domain,name,site_kind");
if (error) throw error;
const by = new Map((sites ?? []).map(s => [s.domain, s]));
let names = 0, kinds = 0;
const missing: string[] = [];
for (const r of seed) {
  const s = by.get(r.domain);
  if (!s) { missing.push(r.domain); continue; }
  if (s.name == null) { names++; if (!dry) { const { error: e } = await db.from("library_sites").update({ name: r.name }).eq("domain", r.domain).is("name", null); if (e) throw e; } }
  if (s.site_kind === "standard" && r.kind !== "standard") { kinds++; if (!dry) { const { error: e } = await db.from("library_sites").update({ site_kind: r.kind }).eq("domain", r.domain).eq("site_kind", "standard"); if (e) throw e; } }
}
console.log(JSON.stringify({ dry, seed: seed.length, sites: by.size, names_filled: names, kinds_set: kinds, not_in_library: missing, in_library_not_seeded: [...by.keys()].filter(d => !seed.some(r => r.domain === d)) }));
