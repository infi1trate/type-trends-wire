// The product's name lives only in src/lib/brand.ts. Earlier names may appear in tests, fixtures, migrations and in comments that
// explain history, nowhere else in user-facing source (pages, components, feeds, share images, MCP text, styles, public files).
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { BRAND_NAME, LEGACY_NAMES } from "./brand";

const SKIP = [/\.test\.tsx?$/, /__snapshots__/, /__fixtures__/, /fixtures?\.ts$/, /routeTree\.gen\.ts$/, /integrations\/supabase\//, /src\/lib\/brand\.ts$/];
const walk = (dir: string): string[] => readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
/** Drops block comments and `//` line comments (a `//` preceded by ":" is a URL, not a comment). */
export const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
const PATTERNS = [...LEGACY_NAMES, "Type Trends Wire", /\bDSGN/];
const hits = (text: string) => PATTERNS.filter(p => (typeof p === "string" ? text.includes(p) : p.test(text))).map(String);

describe("the product name", () => {
  it("is slug, lowercase, one word", () => { expect(BRAND_NAME).toBe("slug"); expect(BRAND_NAME).toMatch(/^[a-z]+$/); });
  it("legacy names appear only in brand.ts, tests, fixtures and history comments", () => {
    const files = [...walk("src"), ...walk("public")].filter(f => /\.(tsx?|css|html|md|svg|json|txt)$/.test(f) && !SKIP.some(r => r.test(f)));
    expect(files.length).toBeGreaterThan(100);
    const bad = files.flatMap(f => { const h = hits(stripComments(readFileSync(f, "utf8"))); return h.length ? [`${f}: ${h.join(", ")}`] : []; });
    expect(bad).toEqual([]);
  });
  it("the current name is never typed out either: pages read BRAND_NAME", () => {
    const files = walk("src").filter(f => /\.tsx?$/.test(f) && !SKIP.some(r => r.test(f)));
    const literal = /(?<!\[)(["'`])slug\1|>slug</;
    const bad = files.filter(f => literal.test(stripComments(readFileSync(f, "utf8"))));
    expect(bad).toEqual([]);
  });
  it("the scan would catch a legacy name in a string but not in a comment", () => {
    expect(hits(stripComments('const t = "Status · DSGN/TERMINAL";'))).not.toEqual([]);
    expect(hits(stripComments("// Renamed from DSGN/TERMINAL in phase 17a.\nconst t = 1;"))).toEqual([]);
    expect(hits(stripComments('const u = "https://type-trends-wire.lovable.app/x";'))).not.toEqual([]);
  });
});
