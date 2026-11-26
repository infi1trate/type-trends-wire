// @vitest-environment node
// M2a · nothing a reader sees reads the listing tables yet: only the ingest route may import src/lib/listings/.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) ? [p] : []; });
describe("listing isolation", () => {
  it("no route but ingest-listings, and no component, imports src/lib/listings", () => {
    const bad = [...walk("src/routes"), ...walk("src/components")].filter(f => !f.endsWith("api/public/ingest-listings.ts") && /lib\/listings\//.test(readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });
});
