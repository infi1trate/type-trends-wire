import { describe, expect, it } from "vitest";
import { SIMILAR_ENOUGH, SIMILAR_MAX, SIMILAR_MIN, SIMILAR_MIN_SHARED, jaccard, similarBrands, type SimilarSite } from "./similar";

const E = new Set(["m:a", "m:b", "m:c", "m:d"]); // eligible: headline + measured
const site = (domain: string, sector: string, traits: string[], name: string | null = null): SimilarSite => ({ domain, name, sector, traits });

describe("similar brands", () => {
  it("named thresholds", () => {
    expect(SIMILAR_MIN).toBe(0.6); expect(SIMILAR_MIN_SHARED).toBe(2); expect(SIMILAR_MAX).toBe(6); expect(SIMILAR_ENOUGH).toBe(3);
  });
  it("Jaccard overlap is shared over either", () => {
    expect(jaccard(new Set(["a", "b", "c"]), new Set(["a", "b", "d"]))).toBe(0.5);
    expect(jaccard(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
    expect(jaccard(new Set(), new Set())).toBe(0);
  });
  it("counts measured headline signals only: AI tags and archive signals never make brands similar", () => {
    const sites = [site("x.com", "fintech", ["m:a", "m:b", "ai:x", "ai:y"]), site("y.com", "fintech", ["m:a", "m:b", "ai:z"])];
    const r = similarBrands("x.com", sites, E);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]!.overlap).toBe(1);
    expect(r.items[0]!.shared).toEqual(["m:a", "m:b"]);
  });
  it("below the minimum overlap, or with one shared signal, a brand is not similar", () => {
    const sites = [site("x.com", "s", ["m:a", "m:b", "m:c"]), site("half.com", "s", ["m:a", "m:b", "m:d"]), site("one.com", "s", ["m:a"])];
    expect(similarBrands("x.com", sites, E).items).toEqual([]); // 2/4 = 0.5 < 0.6; 1/3 and one shared
    expect(similarBrands("x.com", [site("x.com", "s", ["m:a"]), site("y.com", "s", ["m:a"])], E).items).toEqual([]); // overlap 1, one shared
  });
  it("ties go to the same sector, then by name; at most six", () => {
    const twins = ["b.com", "a.com", "c.com", "d.com", "e.com", "f.com", "g.com"].map((d, k) => site(d, k === 6 ? "fintech" : "dev-tools", ["m:a", "m:b"], d.toUpperCase()));
    const r = similarBrands("x.com", [site("x.com", "fintech", ["m:a", "m:b"]), ...twins], E);
    expect(r.items.map(i => i.domain)).toEqual(["g.com", "a.com", "b.com", "c.com", "d.com", "e.com"]);
    expect(r.items[0]!.sameSector).toBe(true);
  });
  it("fewer than three says so instead of padding", () => {
    const sites = [site("x.com", "s", ["m:a", "m:b"]), site("y.com", "s", ["m:a", "m:b"]), site("z.com", "s", ["m:c"])];
    const r = similarBrands("x.com", sites, E);
    expect(r.enough).toBe(false);
    expect(r.items).toHaveLength(1);
    expect(r.line).toBe("Only 1 tracked brand shares at least 60% (and 2 or more) of its measured headline signals; we show it rather than pad the list.");
    expect(similarBrands("x.com", [sites[0]!, sites[2]!], E).line).toContain("none is called similar");
    expect(similarBrands("z.com", [site("z.com", "s", ["ai:q"])], E).line).toContain("nothing to compare");
  });
  it("three or more is enough", () => {
    const sites = ["x", "a", "b", "c"].map(d => site(`${d}.com`, "s", ["m:a", "m:b", "m:c"]));
    const r = similarBrands("x.com", sites, E);
    expect(r.enough).toBe(true);
    expect(r.items.map(i => i.href)).toEqual(["/brands/a.com", "/brands/b.com", "/brands/c.com"]);
  });
});
