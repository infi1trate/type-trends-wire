import { describe, expect, it } from "vitest";
import { MOVED_MIN, monogramLetter, movedSet, movedThisWeek, plateOf } from "./brand-tiles";

const C = { ink: "#111111", page: "#f4efe4" };
const NOW = Date.parse("2026-11-23T12:00:00Z");
const day = (n: number) => new Date(NOW - n * 864e5).toISOString();

describe("logo plate", () => {
  it("uses the stored icon when it is at least 48 px", () => {
    expect(plateOf({ icon: { src: "a.png", width: 64, height: 64 }, accent: "#ff0", name: "A", domain: "a.com" }, C).kind).toBe("icon");
  });
  it("draws a monogram for an icon under 48 px or no icon, never an empty plate", () => {
    expect(plateOf({ icon: { src: "a.png", width: 32, height: 32 }, accent: "#ffee00", name: "Raycast", domain: "raycast.com" }, C)).toEqual({ kind: "monogram", letter: "R", bg: "#ffee00", fg: "ink" });
    expect(plateOf({ icon: null, accent: "#1a3cff", name: "Intercom", domain: "intercom.com" }, C)).toEqual({ kind: "monogram", letter: "I", bg: "#1a3cff", fg: "page" });
  });
  it("falls back to the ink plate when there is no accent or neither lettering passes 4.5 : 1", () => {
    expect(plateOf({ icon: null, accent: null, name: "Graza", domain: "graza.co" }, C)).toEqual({ kind: "monogram", letter: "G", bg: null, fg: "page" });
    expect(plateOf({ icon: null, accent: "#777777", name: "Mid", domain: "mid.com" }, C)).toEqual({ kind: "monogram", letter: "M", bg: null, fg: "page" });
  });
  it("takes the first letter or digit of the name, else the domain", () => {
    expect(monogramLetter("  (37) signals", "x.com")).toBe("3");
    expect(monogramLetter(null, "linear.app")).toBe("L");
  });
});

describe("moved this week", () => {
  const moves = [
    { headline: "a1", at: day(1), domains: ["a.com"] }, { headline: "a0", at: day(2), domains: ["a.com"] },
    { headline: "b", at: day(3), domains: ["b.com"] }, { headline: "c", at: day(6.9), domains: ["c.com"] },
    { headline: "old", at: day(8), domains: ["d.com"] },
  ];
  it("gives one card per brand, newest first, only within seven days", () => {
    expect(movedThisWeek(moves, NOW, () => true).map(c => c.headline)).toEqual(["a1", "b", "c"]);
  });
  it("is empty when fewer than three brands qualify", () => {
    expect(MOVED_MIN).toBe(3);
    expect(movedThisWeek(moves, NOW, d => d !== "c.com")).toEqual([]);
  });
  it("caps the band at six", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ headline: String(i), at: day(i / 2), domains: [`s${i}.com`] }));
    expect(movedThisWeek(many, NOW, () => true)).toHaveLength(6);
  });
  it("stickers every brand that moved in seven days", () => {
    expect(movedSet(moves, NOW)).toEqual(["a.com", "b.com", "c.com"]);
  });
});

import { moveAfterName } from "./brand-tiles";
describe("move line under a brand's name", () => {
  it("leaves out the stored headline's leading name", () => {
    expect(moveAfterName("Figma · imagery (AI estimate), abstract gradients", "Figma", "figma.com")).toBe("Imagery (AI estimate), abstract gradients");
    expect(moveAfterName("reMarkable · palette, Green-grey", "reMarkable", "remarkable.com")).toBe("Palette, Green-grey");
  });
  it("keeps a headline that does not open with the name", () => {
    expect(moveAfterName("Homepages are making room for agents", "Figma", "figma.com")).toBe("Homepages are making room for agents");
  });
});
