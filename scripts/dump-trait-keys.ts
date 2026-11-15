// One-time fixture dump: every trait key the app currently stores, read through the existing anonymous store code.
//   bun scripts/dump-trait-keys.ts > src/lib/__fixtures__/trait-keys.json
// Open-vocabulary categories (font families, headline words) keep a 20-key sample; their names are rule-built.
import { supabaseAnon } from "../src/lib/mcp/supabase";
import { pages, loadTasteSites } from "../src/lib/taste/store.server";

const db = supabaseAnon();
const keys = new Set<string>(), stages = new Set<string>(), bands = new Set<string>();
const [fc, hist, layout, tech, spread, colors, vibe, sites, gf] = await Promise.all([
  pages(f => db.from("forecast_latest").select("dimension,value,stage").order("dimension").order("value").order("scope").range(f, f + 999)),
  pages(f => db.from("library_history_share").select("dimension,value").order("dimension").order("value").order("quarter").order("sector").range(f, f + 999)),
  pages(f => db.from("crawl_layout_share").select("dimension,value").order("dimension").order("value").order("index_name").order("scope").range(f, f + 999)),
  pages(f => db.from("crawl_tech_share").select("tech").order("tech").order("index_name").order("scope").range(f, f + 999)),
  pages(f => db.from("crawl_spread").select("signal").order("signal").order("scope").range(f, f + 999)),
  pages(f => db.from("color_tickers").select("key").order("key").order("scope").range(f, f + 999)),
  db.from("vibe_clusters").select("name"),
  loadTasteSites(),
  db.from("gfont_snapshots").select("family").order("popularity_rank").limit(20),
]);
for (const r of [...fc, ...hist]) keys.add(`${r.dimension}:${r.value}`);
for (const r of fc) stages.add(r.stage ?? "null");
for (const r of layout) keys.add(`${r.dimension}:${r.value}`);
for (const r of tech) if (r.tech) keys.add(`tech:${r.tech}`);
for (const r of spread) if (r.signal) keys.add(`spread:${r.signal}`);
for (const r of colors) if (r.key) keys.add(`color:${r.key}`);
for (const r of vibe.data ?? []) keys.add(`vibe:${r.name}`);
for (const r of gf.data ?? []) keys.add(`family:${r.family}`);
const open = new Map<string, number>();
for (const s of sites) for (const t of s.traits) { const cat = t.split(":")[0]!; if (["h1_word", "h1_font", "body_font", "accent"].includes(cat)) { const n = open.get(cat) ?? 0; if (n >= 20 || keys.has(t)) continue; open.set(cat, n + 1); } keys.add(t); }
for (const b of ["BASELINE", "RISING", "PEAKING", "RETURNING", "FADING", "STEADY"]) bands.add(b);
console.log(JSON.stringify({ generated: new Date().toISOString().slice(0, 10), keys: [...keys].sort(), stages: [...stages].sort(), bands: [...bands] }, null, 1));
