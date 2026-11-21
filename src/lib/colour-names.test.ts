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
