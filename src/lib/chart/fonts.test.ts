import { describe, expect, it } from "vitest";
import { FACE_ADVANCES, FACE_ATLASES, GLYPH_CHARS } from "./glyphs.gen";
import { FACE_SIZES, atlasKey, hasAtlas, measureText } from "./fonts";

describe("image drawer type", () => {
  it("atlases exist for Big Shoulders 700 and 900 and Newsreader 400, with an advance per glyph", () => {
    for (const [face, weights] of Object.entries(FACE_SIZES).filter(([f]) => f !== "mono")) for (const [w, sizes] of Object.entries(weights)) for (const s of sizes as number[]) {
      const key = atlasKey(face as never, Number(w) as never, s as never);
      expect(FACE_ATLASES[key], key).toBeDefined();
      expect(FACE_ADVANCES[key]!.length, key).toBe([...GLYPH_CHARS].length);
    }
    expect(hasAtlas("display", 700, 28)).toBe(true); expect(hasAtlas("display", 900, 96)).toBe(true); expect(hasAtlas("text", 400, 22)).toBe(true);
    expect(() => atlasKey("text", 900 as never, 96 as never)).toThrow();
  });
  it("measures proportional text with per-glyph advances", () => {
        expect(measureText("WWWW", 44, 900, "display")).toBeGreaterThan(measureText("IIII", 44, 900, "display"));
    expect(measureText("AB", 44, 900, "display")).toBeCloseTo(measureText("A", 44, 900, "display") + measureText("B", 44, 900, "display"), 5);
    expect(measureText("47.0%", 96, 900, "display")).toBeGreaterThan(measureText("47.0%", 44, 900, "display"));
        expect(measureText("mmm", 22, 400, "text")).toBeGreaterThan(measureText("iii", 22, 400, "text"));
    // Monospace stays fixed-width.
    expect(measureText("WWWW", 22)).toBe(measureText("IIII", 22));
  });
});
