// U3 · no component names a colour or a font size: colours come from the design system's roles (src/lib/theme/system.ts) and type
// from its named steps. Fails on a raw hex colour or a raw px font size anywhere in src/components. Allowed: generated brand files
// (filters drawn from brand/), the vendored shadcn primitives (ui/), and SVG chart internals, whose `fontSize="10"` attributes are
// viewBox units, not CSS px, and whose colours arrive as role variables.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "src/components";
const ALLOW = [/\.gen\.ts$/, /^src\/components\/ui\//, /\.test\.tsx?$/];
const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|css)$/.test(p) ? [p] : []; });
const files = walk(ROOT).filter(f => !ALLOW.some(a => a.test(f)));
// Comments may describe colours ("#418" is an error code, not a colour); strip them first.
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const HEX = /(?<![&\w-])#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/g;
const PX_FONT = /text-\[\d+(?:\.\d+)?px\]|fontSize:\s*["'`]?\d|font-size:\s*\d/g;

describe("design tokens only", () => {
  it("scans the components", () => { expect(files.length).toBeGreaterThan(100); });
  it("no raw hex colour in src/components", () => {
    const hits = files.flatMap(f => [...code(readFileSync(f, "utf8")).matchAll(HEX)].map(m => `${f}: ${m[0]}`));
    expect(hits).toEqual([]);
  });
  it("no raw px font size in src/components (SVG viewBox attributes aside)", () => {
    const hits = files.flatMap(f => [...code(readFileSync(f, "utf8")).matchAll(PX_FONT)].map(m => `${f}: ${m[0]}`));
    expect(hits).toEqual([]);
  });
  it("the rule catches what it is meant to", () => {
    expect("bg-[#FF8FC4]".match(HEX)).toEqual(["#FF8FC4"]);
    expect('style={{ color: "#fff" }}'.match(HEX)).toEqual(["#fff"]);
    expect("text-[13px] or fontSize: 12".match(PX_FONT)).toHaveLength(2);
    expect("href=\"#fig-a\" &#123; #f-glossary".match(HEX)).toBeNull();
  });
});
