// E2g · freeze today's census inputs for the census tests: each active brand's newest live desktop home captures inside the last eight
// days (headline source, headline, first button labels), the brands' names and sectors, and the confirmed headline changes of the last
// 14 days with their capture dates (judged against every stored live capture now).
// Usage: bun scripts/build-census-fixture.ts
import { writeFileSync } from "node:fs";
const { supabaseAnon } = await import("../src/lib/mcp/supabase");
const { censusCaptures } = await import("../src/lib/census.server");
const { computeChecks } = await import("../src/lib/integrity.server");
const { splitChecked } = await import("../src/lib/integrity");
const db = supabaseAnon(), now = Date.now(), nowIso = new Date(now).toISOString();
const caps = await censusCaptures(db, now);
const { data: sites } = await db.from("library_sites").select("domain,name,sector,active").order("domain").range(0, 999);
const active = (sites ?? []).filter(s => s.active);
const keep = new Set(active.map(s => s.domain));
// The newest three captures per brand are enough for the base (two newest) and its tests.
const by = new Map<string, typeof caps>(); for (const c of caps) if (keep.has(c.domain)) by.set(c.domain, [...(by.get(c.domain) ?? []), c]);
const captures = [...by.values()].flatMap(xs => xs.sort((a, b) => b.at.localeCompare(a.at) || b.id - a.id).slice(0, 3)).map(c => ({ ...c, ctas: c.ctas.slice(0, 3) }));
const { data: evs, error } = await db.from("library_events").select("id,domain,type,before,after,detected_at,page_type,viewport,source,snapshot_id,prev_snapshot_id")
  .eq("type", "message_pivot").eq("source", "live").eq("viewport", "desktop").eq("page_type", "home").gte("detected_at", new Date(now - 14 * 864e5).toISOString()).order("id");
if (error) throw error;
const checks = await computeChecks(db, evs ?? []);
const events = splitChecked(evs ?? [], checks).tape;
writeFileSync("src/lib/__fixtures__/census-2026-11-20.json", JSON.stringify({ now: nowIso, sites: active.map(s => ({ domain: s.domain, name: s.name, sector: s.sector })), captures, events }));
console.log({ now: nowIso, brands: by.size, captures: captures.length, events: events.length });
