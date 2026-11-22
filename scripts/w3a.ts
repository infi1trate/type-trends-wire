// W3a + L3 proof (read only): `bun scripts/w3a.ts palettes` — every active brand's newest homepage palette against the museum works
// (stored works, or the dry-run fixture while none are stored), with and without neutrals; `steady` — the reading-steadiness table
// between two forecast runs. Writes nothing to the database.
const cmd = process.argv[2];
const { supabaseAdmin: db } = await import("../src/integrations/supabase/client.server");
const out = (x: unknown) => console.log(JSON.stringify(x, null, 1));
export async function brandPalettes() {
  const sites = (await db.from("library_sites").select("domain,name,sector").eq("active", true).limit(2000)).data ?? [];
  const rows: { domain: string; captured_at: string; palette: unknown }[] = [];
  for (let f = 0; ; f += 1000) {
    const r = await db.from("library_snapshots").select("domain,captured_at,palette:signals->color->palette").eq("source", "live").eq("page_type", "home").eq("viewport", "desktop").order("captured_at", { ascending: false }).range(f, f + 999);
    rows.push(...((r.data ?? []) as never[])); if ((r.data ?? []).length < 1000) break;
  }
  const latest = new Map<string, { captured_at: string; palette: { hex: string; share: number }[] }>();
  for (const r of rows) if (!latest.has(r.domain) && Array.isArray(r.palette)) latest.set(r.domain, { captured_at: r.captured_at, palette: (r.palette as { hex: string; share: number }[]).map(p => ({ hex: p.hex, share: p.share })) });
  return sites.flatMap(s => { const l = latest.get(s.domain); return l ? [{ ...s, ...l }] : []; });
}
if (cmd === "palettes") {
  const P = await import("../src/lib/art/palette");
  const stored = (await db.from("art_works").select("source,source_id,title,artist,date_display,year_start,tradition,movement,palette").is("removed_at", null).limit(5000)).data ?? [];
  const fixture = (await import("../src/lib/art/__fixtures__/dry-run-works.json")).default.works;
  const works = (stored.length ? stored : fixture) as unknown as import("../src/lib/art/palette").Work[];
  const brands = await brandPalettes(), gs = P.groups(works);
  const matches = brands.map(b => ({ b, m: P.nearestFor(b.domain, b.palette, works, gs), raw: P.nearestFor(b.domain, b.palette, works, gs, { keepNeutrals: true }) }));
  const ds = matches.flatMap(x => (!x.m.neutral && x.m.work ? [x.m.work.distance] : [])).sort((a, b) => a - b);
  const q = (p: number) => ds[Math.floor(p * (ds.length - 1))];
  const sp = P.spread(matches.map(x => x.m)), spRaw = P.spread(matches.map(x => x.raw));
  const sectors = [...new Set(brands.map(b => b.sector))].sort().map(s => P.nearestForSector(s, brands.filter(b => b.sector === s), gs)).map(x => ({ sector: x.sector, group: x.group?.name ?? null, count: x.count, base: x.base, neutral: x.neutral, median: x.median }));
  const { writeFileSync } = await import("node:fs");
  writeFileSync("/tmp/w3a/matches.json", JSON.stringify(matches.map(x => ({ domain: x.b.domain, name: x.b.name, sector: x.b.sector, palette: x.b.palette, m: x.m, raw: x.raw }))));
  out({ works: works.length, from: stored.length ? "stored" : "dry-run fixture", groups: gs.map(g => `${g.name} (${g.works})`), brands: brands.length, neutral: matches.filter(x => x.m.neutral).length,
    distance_quantiles: { p05: q(0.05), p10: q(0.1), p25: q(0.25), p50: q(0.5), p75: q(0.75) }, near: P.NEAR_DISTANCE, spread: sp, spread_with_neutrals: spRaw, sectors });
}
if (cmd === "steady") {
  // E3 · every AI-read field by sector (and all sectors) between forecast runs 13 and 16, and the run-16 stories the rule would refuse.
  const { AI_FIELDS } = await import("../src/lib/stories/steady");
  const { steadyFor } = await import("../src/lib/stories/steady.server");
  const { SECTORS } = await import("../src/lib/library");
  const runs = (await db.from("forecast_runs").select("id,computed_at").in("id", [13, 16]).order("id")).data!;
  const sites = new Map(((await db.from("library_sites").select("domain,sector").eq("active", true).limit(2000)).data ?? []).map(s => [s.domain, s.sector]));
  const pairs = AI_FIELDS.flatMap(field => [...SECTORS, "all"].map(scope => ({ field, scope })));
  const got = await steadyFor(db, pairs, sites, runs[0]!.computed_at, runs[1]!.computed_at);
  const table = got.map(x => ({ field: x.field, scope: x.scope, changed: x.changed, both: x.both, verdict: !x.judged ? "too few read in both" : x.steady ? "steady" : "NOT steady" }));
  const bad = new Map(got.filter(x => !x.steady).map(x => [`${x.field}|${x.scope}`, x]));
  const st = (await db.from("stories").select("id,type,status,created_at").ilike("id", "%:16").order("created_at")).data ?? [];
  const latest = new Map<string, { id: string; type: string; status: string }>(); for (const s of st) latest.set(s.id, s);
  const nums = new Map(((await db.from("story_numbers").select("story_id,number").in("story_id", [...latest.keys()])).data ?? []).map(n => [n.story_id, n.number]));
  const states = new Map<string, string>(); for (const x of (await db.from("story_states").select("story_id,state,id").in("story_id", [...latest.keys()]).order("id")).data ?? []) states.set(x.story_id, x.state);
  const stories = [...latest.values()].map(s => { const parts = s.id.split(":"), field = parts[1]!, subject = s.type === "crossover" || s.type === "shift", scope = s.type === "crossover" ? parts[3]! : "all", u = subject ? bad.get(`${field}|${scope}`) : undefined;
    return { id: s.id, number: nums.get(s.id) ?? null, state: states.get(s.id) ?? s.status, type: s.type, field, scope, verdict: !subject ? "not subject (not a crossover or stage change)" : u ? `refused: reading not steady: ${u.changed} of ${u.both} homepages changed between the two forecasts` : "allowed" }; });
  out({ runs: runs.map(r => `${r.id} at ${r.computed_at}`), table, stories, media_hero_layout: got.find(x => x.field === "hero_layout" && x.scope === "media")?.homes });
}
