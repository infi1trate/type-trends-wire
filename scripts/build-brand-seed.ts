// Generates src/lib/brands/seed.gen.ts from the owner's seed file src/lib/brands/seed.tsv (domain, name, kind; tab-separated).
// Usage: bun scripts/build-brand-seed.ts   (brand-names.test.ts fails when the two drift)
import { readFileSync, writeFileSync } from "node:fs";
import { parseSeed, seedModule } from "../src/lib/brand-names";
const rows = parseSeed(readFileSync(new URL("../src/lib/brands/seed.tsv", import.meta.url), "utf8"));
writeFileSync(new URL("../src/lib/brands/seed.gen.ts", import.meta.url), seedModule(rows));
console.log(`wrote ${rows.length} brands`);
