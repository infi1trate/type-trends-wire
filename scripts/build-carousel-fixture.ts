// E2f · freeze the carousel captures (with the page's flag inherited by older captures) into the golden fixtures' `carousel` field.
// Only that field is written; events, checks and everything else in the fixtures stay as frozen. Usage: bun scripts/build-carousel-fixture.ts
import { readFileSync, writeFileSync } from "node:fs";
const { supabaseAnon } = await import("../src/lib/mcp/supabase");
const { carouselSnapshots } = await import("../src/lib/carousel.server");
for (const f of ["golden", "day-2026-11-20"]) {
  const path = `src/lib/stories/golden/__fixtures__/${f}.json`, fx = JSON.parse(readFileSync(path, "utf8")) as { events: { snapshot_id?: number | null; prev_snapshot_id?: number | null }[]; carousel?: number[] };
  fx.carousel = [...(await carouselSnapshots(supabaseAnon(), fx.events.flatMap(e => [e.snapshot_id, e.prev_snapshot_id])))].sort((a, b) => a - b);
  writeFileSync(path, JSON.stringify(fx));
  console.log(f, fx.carousel.length);
}
