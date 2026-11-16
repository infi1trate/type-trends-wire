import { describe, expect, it } from "vitest";
import { brandsIndex, brandsSearch, parseBrandsSearch, sortBy, type BrandListing } from "./brands-index";

const B: BrandListing[] = [
  { domain: "ramp.com", name: "Ramp", sector: "fintech", lastChange: "2026-11-10", lastMove: null, moves: 4 },
  { domain: "neon.com", name: "Neon", sector: "dev-tools", lastChange: "2026-11-15", lastMove: null, moves: 1 },
  { domain: "acme.com", name: null, sector: "fintech", lastChange: null, lastMove: null, moves: 0 },
];
describe("brands index", () => {
  it("defaults to last change, newest first, unchanged brands last", () => {
    const x = brandsIndex(B, parseBrandsSearch({}));
    expect(x.rows.map(r => r.domain)).toEqual(["neon.com", "ramp.com", "acme.com"]);
    expect(x.countLine).toBe("3 tracked brands.");
  });
  it("search, lens and sorts", () => {
    expect(brandsIndex(B, parseBrandsSearch({ q: "ne" })).countLine).toBe("1 of 3 tracked brands match “ne”.");
    expect(brandsIndex(B, parseBrandsSearch({ sector: "fintech" })).rows.map(r => r.domain)).toEqual(["ramp.com", "acme.com"]);
    expect(brandsIndex(B, parseBrandsSearch({ sort: "moves" })).rows.map(r => r.moves)).toEqual([4, 1, 0]);
    expect(brandsIndex(B, parseBrandsSearch({ sort: "name" })).rows.map(r => r.domain)).toEqual(["acme.com", "neon.com", "ramp.com"]);
    expect(brandsIndex(B, parseBrandsSearch({ q: "zzz" })).empty).toBeTruthy();
  });
  it("clicking a column flips it; the URL keeps only non-defaults", () => {
    const v = parseBrandsSearch({});
    expect(sortBy(v, "change").dir).toBe("asc");
    expect(sortBy(v, "name")).toMatchObject({ sort: "name", dir: "asc" });
    expect(brandsSearch(v)).toEqual({});
    const w = parseBrandsSearch({ tab: "moves", q: "ramp", sector: "fintech", sort: "moves", dir: "asc" });
    expect(brandsSearch(w)).toEqual({ tab: "moves", q: "ramp", sector: "fintech", sort: "moves", dir: "asc" });
    expect(parseBrandsSearch(brandsSearch(w))).toEqual(w);
  });
});
