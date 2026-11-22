// U2b · colour words are facts: one naming function, checked on twenty-plus hexes across hues and lightness.
import { describe, expect, it } from "vitest";
import { allowedColourWords, colourName, colourWordsIn } from "./colour-names";
import { hexName } from "./agency/changes";

describe("colourName", () => {
  it("No. 85's palette: a pale blue-grey is never light grey", () => {
    expect(colourName("#F7F1F1")).toBe("Off-white");
    expect(colourName("#D0E0E7")).toBe("Pale blue");
    expect(colourName("#B1CBDA")).toBe("Pale blue");
    expect(colourName("#12181F")).toBe("Near-black");
  });
  const cases: [string, string][] = [
    ["#FFFFFF", "White"], ["#000000", "Black"], ["#808080", "Mid grey"], ["#F4F4F4", "Off-white"], ["#1A1A1A", "Near-black"],
    ["#FF0000", "Vivid red"], ["#DC143C", "Vivid red"], ["#800000", "Dark red"], ["#FF8000", "Vivid orange"], ["#8B4513", "Brown"],
    ["#FFFF00", "Vivid yellow"], ["#FFFDD0", "Cream"], ["#F5F5DC", "Cream"], ["#00FF00", "Vivid green"], ["#008000", "Vivid green"],
    ["#008080", "Muted teal"], ["#00FFFF", "Vivid cyan"], ["#87CEEB", "Light blue"], ["#0000FF", "Vivid blue"], ["#000080", "Navy"],
    ["#1C4673", "Dark blue"], ["#708090", "Blue-grey"], ["#6366F1", "Vivid indigo"], ["#4B0082", "Dark purple"], ["#FF00FF", "Vivid magenta"],
    ["#FF69B4", "Vivid pink"], ["#FFC0CB", "Light pink"], ["#E6E6FA", "Lavender"],
  ];
  for (const [hex, name] of cases) it(`${hex} → ${name}`, () => expect(colourName(hex)).toBe(name));
  it("hexName uses it and leaves non-hex input as given", () => { expect(hexName("#D0E0E7")).toBe("Pale blue"); expect(hexName("oops")).toBe("oops"); expect(hexName(null)).toBe("none"); });
});

describe("colour words", () => {
  it("finds hues and named shades, near-black as one word", () => expect(colourWordsIn("Near-black gave way to pale blue and cream.")).toEqual(["near-black", "blue", "cream"]));
  it("set phrases are not colours", () => expect(colourWordsIn("A white space before Black Friday")).toEqual([]));
  it("a name allows its own words and compounds", () => {
    const a = allowedColourWords(["Off-white", "Pale blue", "Near-black"]);
    for (const w of ["off-white", "white", "blue", "near-black", "black"]) expect(a.has(w)).toBe(true);
    expect(a.has("grey")).toBe(false);
  });
});

// W1d · the reference table: 48 colours around the hue circle at high, middle and low lightness, with the shades readers name (hot pink,
// navy, magenta, rose, coral, orange-red, teal, lime, tan, near-black). Before W1d 34 of these were named as below; #FB2180 read "Vivid red".
const REFERENCE: [string, string][] = [
  ["#FF0000","Vivid red"],
  ["#DC143C","Vivid red"],
  ["#800000","Dark red"],
  ["#FB2180","Vivid pink"],
  ["#FF1493","Vivid pink"],
  ["#FF007F","Vivid pink"],
  ["#FF69B4","Vivid pink"],
  ["#FFC0CB","Light pink"],
  ["#FFE4E6","Pale pink"],
  ["#DB7093","Muted pink"],
  ["#C71585","Vivid pink"],
  ["#FF00FF","Vivid magenta"],
  ["#D946EF","Vivid magenta"],
  ["#800080","Dark purple"],
  ["#FF7F50","Coral"],
  ["#FA8072","Coral"],
  ["#FF4500","Vivid orange-red"],
  ["#FF8000","Vivid orange"],
  ["#F97316","Vivid orange"],
  ["#8B4513","Brown"],
  ["#D2B48C","Tan"],
  ["#C19A6B","Tan"],
  ["#FFFDD0","Cream"],
  ["#FFFF00","Vivid yellow"],
  ["#EAB308","Vivid yellow"],
  ["#84CC16","Lime"],
  ["#BFFF00","Lime"],
  ["#00FF00","Vivid green"],
  ["#365314","Dark green"],
  ["#064E3B","Dark green"],
  ["#008080","Muted teal"],
  ["#14B8A6","Muted teal"],
  ["#40E0D0","Light cyan"],
  ["#06B6D4","Muted cyan"],
  ["#87CEEB","Light blue"],
  ["#0000FF","Vivid blue"],
  ["#000080","Navy"],
  ["#130281","Navy"],
  ["#191970","Navy"],
  ["#6366F1","Vivid indigo"],
  ["#7C3AED","Vivid purple"],
  ["#E6E6FA","Lavender"],
  ["#0A0A0A","Near-black"],
  ["#0B1020","Near-black"],
  ["#FFFFFF","White"],
  ["#808080","Mid grey"],
  ["#708090","Blue-grey"],
  ["#1C4673","Dark blue"],
];
describe("W1d · colour names against the reference table", () => {
  it("has at least 40 colours spread around the hue circle", () => expect(REFERENCE.length).toBeGreaterThanOrEqual(40));
  for (const [hex, name] of REFERENCE) it(`${hex} → ${name}`, () => expect(colourName(hex)).toBe(name));
  it("No. 92's colours: #FB2180 is a hot pink, never red; #130281 is navy", () => {
    expect(colourName("#FB2180")).toBe("Vivid pink"); expect(colourName("#130281")).toBe("Navy");
    expect(colourWordsIn(colourName("#FB2180")!)).not.toContain("red");
  });
  it("established brand colours keep their names (Amazon orange, DocuSign indigo, a peach, tinted greys)", () => {
    expect(colourName("#FF6003")).toBe("Vivid orange"); expect(colourName("#2B0673")).toBe("Dark indigo");
    expect(colourName("#FDBD8B")).toBe("Light orange"); expect(colourName("#84787A")).toBe("Red-grey"); expect(colourName("#34494F")).toBe("Blue-grey");
  });
});
