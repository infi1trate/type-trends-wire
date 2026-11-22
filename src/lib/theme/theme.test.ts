import { describe, expect, it, vi } from "vitest";
// P2 · these tests build whole story days from fixtures (1.5 to 4 s alone); under the full suite's load they ran past vitest's 5 s default.
vi.setConfig({ testTimeout: 30_000 });
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MODES, THEMES, flatten, missingTokens, requiredTokens, activeCss, type Theme } from "./index";
import { legacy } from "./legacy";
import { blank } from "./blank";
import { modeOf, DARK_ROUTE_FILES, DEFAULT_MODE, VIEW_ROUTE_FILES } from "./route-mode";

describe("token contract", () => {
  it("every registered theme provides every token in every mode", () => {
    for (const [name, t] of Object.entries(THEMES)) expect(missingTokens(t, legacy), name).toEqual([]);
    for (const m of MODES) expect(requiredTokens(legacy, m).length).toBeGreaterThan(150);
  });
  it("the blank stub is complete in shape, and a stub missing a token fails (types and at runtime)", () => {
    expect(missingTokens(blank, legacy)).toEqual([]);
    const { accent: _a, ...noAccent } = blank.modes.light;
    // @ts-expect-error — a mode without `accent` does not satisfy the contract
    const broken: Theme = { ...blank, modes: { ...blank.modes, light: noAccent } };
    expect(missingTokens(broken, legacy)).toContain("light:--tk-accent-1");
    const emptied: Theme = { ...blank, shared: { ...blank.shared, space: { ...blank.shared.space, 3: "" } } };
    expect(missingTokens(emptied, legacy)).toContain("dark:--tk-space-3");
  });
  it("legacy keeps the look before the brand exactly (spot checks), for before/after comparisons", () => {
    const light = flatten(legacy, "light"), dark = flatten(legacy, "dark");
    expect(dark["--tk-accent-1"]).toBe("#ff4f00");
    expect(dark["--tk-surface-page"]).toBe("#000000");
    expect(light["--tk-surface-page"]).toBe("#ffffff");
    expect(light["--tk-text-primary"]).toBe("#0b0b0b");
    expect(light["--tk-type-kicker-size"]).toBe("11px");
    expect(legacy.shared.space).toEqual({ 1: "4px", 2: "8px", 3: "16px", 4: "24px", 5: "40px", 6: "64px", 7: "104px" });
    expect(legacy.modes.vibes).toBe(legacy.modes.light);
    expect(legacy.shared.square).toBe(true);
  });
  it("only the theme folder holds the product's font stylesheets (specimen loaders for data fonts are separate)", () => {
    const hits: string[] = [];
    const walk = (dir: string) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) walk(p); else if (/\.(ts|tsx|css)$/.test(e.name) && !/\.test\./.test(e.name) && !p.includes("/theme/") && /family=(Geist\+Mono|Bodoni\+Moda|Newsreader)/.test(readFileSync(p, "utf8"))) hits.push(p); } };
    walk("src");
    expect(hits).toEqual([]);
  });
});

describe("root mode per route", () => {
  it("the deepest route naming a mode wins; otherwise light", () => {
    expect(modeOf([])).toBe(DEFAULT_MODE);
    expect(modeOf([{ staticData: {} }, { staticData: { mode: "dark" } }])).toBe("dark");
    expect(modeOf([{ staticData: { mode: "dark" } }, { staticData: { mode: "light" } }])).toBe("light");
    expect(modeOf([{}, { staticData: undefined }])).toBe("light");
  });
  it("an object route with a Data view is dark only while ?view=data is set (U1)", () => {
    expect(modeOf([{}, { staticData: { views: true }, search: { view: "data" } }])).toBe("dark");
    expect(modeOf([{}, { staticData: { views: true }, search: { sector: "fintech" } }])).toBe("light");
    expect(modeOf([{}, { staticData: {}, search: { view: "data" } }])).toBe("light");
    const files = readdirSync("src/routes").filter(f => f.endsWith(".tsx") && /staticData:\s*\{\s*views:\s*true/.test(readFileSync(join("src/routes", f), "utf8")));
    expect(files.sort()).toEqual([...VIEW_ROUTE_FILES].sort());
  });
  it("exactly the terminal-density route files declare dark; Read pages (including /kit) stay light", () => {
    const files = readdirSync("src/routes").filter(f => f.endsWith(".tsx"));
    const dark = files.filter(f => /staticData:\s*\{\s*mode:\s*"dark"/.test(readFileSync(join("src/routes", f), "utf8")));
    expect(dark.sort()).toEqual([...DARK_ROUTE_FILES].sort());
    expect(files).toContain("kit.tsx");
    expect(dark).not.toContain("kit.tsx");
  });
  it("the root shell writes the mode on <html>", () => {
    expect(readFileSync("src/routes/__root.tsx", "utf8")).toMatch(/<html lang="en" data-mode=\{mode\}/);
  });
});
