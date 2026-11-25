import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PHONE_ROWS } from "./SectorBrands";

const view = readFileSync("src/components/read/EditionsViews.tsx", "utf8");
const route = readFileSync("src/routes/sectors.$sector.tsx", "utf8");
const css = readFileSync("src/styles.css", "utf8");

describe("R1b · sector page order", () => {
  it("chips sit directly under the standfirst, the brand list after the small multiples", () => {
    const sf = view.indexOf('className="ed-standfirst">{r.title}'), chips = view.indexOf("data-sector-chips"), sm = view.indexOf("<SmallMultiples r={r} />}"), brands = view.indexOf("{brands}");
    expect(sf).toBeGreaterThan(0);
    expect(chips).toBeGreaterThan(sf);
    expect(sm).toBeGreaterThan(chips);
    expect(brands).toBeGreaterThan(sm);
  });
  it("the route no longer renders the brand list above the report", () => {
    expect(route).not.toMatch(/<SectorBrands[^>]*\/>\s*\n\s*<Full/);
    expect(route).toMatch(/brands=\{<SectorBrands/);
  });
  it("phones show ten rows until Show all", () => {
    expect(PHONE_ROWS).toBe(10);
    expect(css).toMatch(/max-width: 767px\) \{ \.sector-brand-list:not\(\[data-all\]\) > li:nth-child\(n\+11\)/);
  });
});
