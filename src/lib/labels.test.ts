import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/trait-keys.json";
import { CATEGORY_DIMENSION, DIMENSIONS, KEY_DIMENSION, NAMES, STAGES, alertDisplayTitle, colorName, label, resolveLabel, stageName, tagPhrase, traitText } from "./labels";

describe("trait labels", () => {
  it("resolves every stored trait key without the fallback", () => {
    const misses = fixture.keys.filter(k => !resolveLabel(k).known);
    expect(misses).toEqual([]);
    expect(fixture.keys.length).toBeGreaterThan(300);
  });
  it("maps every stored trait to exactly one of the four dimensions", () => {
    for (const k of fixture.keys) expect(DIMENSIONS).toContain(label(k).dimension);
    for (const d of Object.values(CATEGORY_DIMENSION)) expect(DIMENSIONS).toContain(d);
    for (const d of Object.values(KEY_DIMENSION)) expect(DIMENSIONS).toContain(d);
    for (const k of Object.keys(NAMES)) expect(CATEGORY_DIMENSION[k.split(":")[0]!]).toBeDefined();
  });
  it("uses the agreed names", () => {
    expect(label("hero_media:video")).toEqual({ name: "Video hero", dimension: "LAYOUT" });
    expect(label("tracking:tight")).toEqual({ name: "Tight headline spacing", dimension: "FONT" });
    expect(label("css:subgrid").name).toBe("Subgrid layouts");
    expect(label("bento-grid")).toEqual({ name: "Bento grids", dimension: "LAYOUT" });
    expect(label("logo-wall").name).toBe("Logo walls");
    expect(label("full-bleed-media").name).toBe("Full-bleed media");
    expect(label("spread:dark_theme")).toEqual({ name: "Dark mode", dimension: "COLOR", short: "dark" });
    expect(label("family:Inter")).toEqual({ name: "Inter", dimension: "FONT" });
    expect(label("css:variable_fonts").dimension).toBe("FONT");
  });
  it("turns color tickers into readable words", () => {
    expect(colorName("amber·muted·dark")).toBe("Muted dark amber");
    expect(colorName("pink·vivid·mid")).toBe("Vivid pink");
    expect(colorName("neutral·neutral·light")).toBe("Off-white and light grey");
    expect(label("accent:teal·vivid·light").name).toBe("Vivid light teal accents");
  });
  it("falls back to readable title case for unknown keys", () => {
    const r = resolveLabel("mystery:some_new-thing");
    expect(r.known).toBe(false);
    expect(r.name).toBe("Some new thing");
  });
  it("keeps the vibe phrases cluster names were built from", () => {
    expect(tagPhrase("aesthetic:neo_brutalist")).toBe("soft brutalism");
    expect(tagPhrase("tone:friendly")).toBe("friendly");
  });
});

describe("stage words", () => {
  it("maps every stored stage value onto the five words", () => {
    for (const s of fixture.stages) expect(STAGES).toContain(stageName(s));
    expect(stageName("accelerating")).toBe("Rising");
    expect(stageName("declining")).toBe("Fading");
    expect(stageName("flat")).toBe("Steady");
    expect(stageName("emerging")).toBe("Emerging");
    expect(stageName("peaking")).toBe("Peaking");
    expect(stageName(null)).toBeNull();
  });
  it("maps Google Fonts bands too; baseline means not enough history yet", () => {
    for (const b of fixture.bands.filter(b => b !== "BASELINE")) expect(STAGES).toContain(stageName(b));
    expect(stageName("BASELINE")).toBeNull();
    expect(stageName("RETURNING")).toBe("Rising");
  });
});

const TICKER = /\$[A-Z][A-Z0-9-]+/;
describe("alert titles", () => {
  it("rewrites stored ticker titles through the label map", () => {
    expect(alertDisplayTitle("BREAKOUT $SUBGRID +4.8 pts/q in all", "css:subgrid")).toBe("BREAKOUT · Subgrid layouts [LAYOUT] +4.8 pts/q · all sectors");
    expect(alertDisplayTitle("BREAKOUT $BENTO-GRID +2.3 pts/q in fintech", "components:bento_grid")).toBe("BREAKOUT · Bento grids [LAYOUT] +2.3 pts/q · fintech");
    expect(alertDisplayTitle("SATURATION $THEME-DARK 36.0% share", "theme:dark")).toBe("SATURATION · Dark mode [COLOR] 36.0% share");
    expect(alertDisplayTitle("SATURATION $THEME-DARK 36.0% share", "theme:dark")).not.toMatch(TICKER);
  });
  it("leaves new titles alone", () => {
    const t = `BREAKOUT · ${traitText("css:subgrid")} +4.8 pts/q · all sectors`;
    expect(alertDisplayTitle(t, "css:subgrid")).toBe(t);
  });
});
