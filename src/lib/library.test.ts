import { expect, it } from "vitest";
import { fingerprint, sectorMetrics, radiusBucket } from "./library";
it("fingerprint excludes private text and skeleton, keeping real font and palette values", () => {
  const f = fingerprint({ raw_text: "private", skeleton: [{ x: 0 }], type: { rendered: { h1: { family: "Söhne", webfont: true } } }, color: { accent: "#FF5128", palette: [{ hex: "#FF5128", share: 0.2 }] }, tech: { next: true, framer: false } });
  expect(f.h1_family).toBe("Söhne"); expect(f.accent).toBe("#FF5128"); expect(f.stack).toEqual(["next"]); expect(f).not.toHaveProperty("raw_text"); expect(f).not.toHaveProperty("skeleton");
});
it("computes sector medians and unknown-safe webfont shares", () => {
  const m = sectorMetrics([{ composition: { whitespace_ratio: 0.2 }, type: { rendered: { body: { webfont: true } } } }, { composition: { whitespace_ratio: 0.8 }, type: { rendered: { body: { webfont: false } } } }, {}]);
  expect(m.whitespace).toBe(0.5); expect(m.webfont).toBe(0.5); expect(m.dark).toBeNull(); expect(radiusBucket(999)).toBe("pill");
});