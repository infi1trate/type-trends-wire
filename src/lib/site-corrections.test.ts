import { describe, expect, it } from "vitest";
import { correctSites, isWrongSite } from "./site-corrections";

describe("site corrections (I3b)", () => {
  it("rewrites the resort's address to the studio's in the seed list and keeps the rest", () => {
    const out = correctSites([{ domain: "ragged-edge.com", name: "Ragged Edge", sector: "studios" }, { domain: "figma.com", name: "Figma", sector: "design" }]);
    expect(out.map(s => s.domain)).toEqual(["raggededge.com", "figma.com"]);
    expect(out[0]?.name).toBe("Ragged Edge");
  });
  it("does not list the studio twice once the crawler's seeds carry the right address", () => {
    expect(correctSites([{ domain: "raggededge.com" }, { domain: "ragged-edge.com" }]).map(s => s.domain)).toEqual(["raggededge.com"]);
  });
  it("marks only the wrong address", () => {
    expect(isWrongSite("ragged-edge.com")).toBe(true);
    expect(isWrongSite("raggededge.com")).toBe(false);
  });
});
