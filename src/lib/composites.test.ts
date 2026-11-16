import { describe, expect, it } from "vitest";
import { COMPOSITES, compositeTraits, compositeSeries, memberTraits, ruleText, MEMBER_CUTS } from "./composites";
import { COMBO_AI, basis, label, CATEGORY_DIMENSION, FORECAST_CATEGORIES } from "./labels";

const tagged = { ai_tags: { aesthetic: ["dark_tech"] } };
describe("composites: per-site rules", () => {
  it("all-of needs every member; any-of needs one", () => {
    expect(compositeTraits(["tracking:tight"], { h1_size_px: MEMBER_CUTS.bigHeadlinePx })).toContain("combo:big_type");
    expect(compositeTraits(["tracking:tight"], { h1_size_px: MEMBER_CUTS.bigHeadlinePx - 1 })).not.toContain("combo:big_type");
    expect(compositeTraits([], { frameworks: { gsap: true } })).toContain("combo:motion_rich");
    expect(compositeTraits(["css:view_transitions"], {})).toContain("combo:motion_rich");
    expect(compositeTraits([], {})).toEqual([]);
  });
  it("grouped members: rounded OR pill buttons, AND generous whitespace", () => {
    expect(compositeTraits([], { cta_radius_bucket: "pill", whitespace_ratio: 0.6 })).toContain("combo:soft_ui");
    expect(compositeTraits([], { cta_radius_bucket: "9–24", whitespace_ratio: 0.7 })).toContain("combo:soft_ui");
    expect(compositeTraits([], { cta_radius_bucket: "0", whitespace_ratio: 0.9 })).not.toContain("combo:soft_ui");
    expect(compositeTraits([], { cta_radius_bucket: "pill", whitespace_ratio: 0.59 })).not.toContain("combo:soft_ui");
  });
  it("AI composites need an AI-tagged capture", () => {
    expect(compositeTraits(["theme:dark", "aesthetic:dark_tech"], {})).not.toContain("combo:dark_tech");
    expect(compositeTraits(["theme:dark", "aesthetic:dark_tech"], tagged)).toContain("combo:dark_tech");
  });
  it("member fragments come from stored per-site fields", () => {
    expect([...memberTraits([], { h1_size_px: 64, whitespace_ratio: 0.65, cta_radius_bucket: "pill", frameworks: { three: true, gsap: false } })].sort()).toEqual(["cta_shape:pill", "h1_size:big", "tech:three", "whitespace:high"]);
  });
});

describe("composites: labels, dimension and basis", () => {
  it("every composite has a name, a dimension and a basis that matches its members", () => {
    expect(COMPOSITES.length).toBe(12);
    for (const c of COMPOSITES) {
      expect(label(c.key).name, c.key).not.toMatch(/combo|_/);
      expect(["FONT", "COLOR", "LAYOUT", "VIBE"]).toContain(c.dimension);
      expect(basis(c.key), c.key).toBe(c.memberKeys.some(m => basis(m) === "ai") ? "ai" : "measured");
      expect(c.definition).toMatch(/\.$/);
      expect(ruleText(c).length).toBeGreaterThan(3);
    }
    expect(COMPOSITES.filter(c => c.basis === "ai").map(c => c.id).sort()).toEqual([...COMBO_AI].sort());
    expect(label("combo:big_type").dimension).toBe("FONT");
    expect(label("combo:dark_tech").dimension).toBe("COLOR");
    expect(CATEGORY_DIMENSION["combo"]).toBeTruthy();
    expect(FORECAST_CATEGORIES).toContain("combo");
  });
});

describe("composites: series on the forecast's denominators", () => {
  const base = new Map([["2026Q3|all", { denom: 4, coverage: 0.8 }], ["2026Q3|saas", { denom: 2, coverage: 0.8 }]]);
  const sites = [
    { quarter: "2026Q3", sector: "saas", traits: ["tracking:tight"], h1_size_px: 60, ...tagged },
    { quarter: "2026Q3", sector: "saas", traits: ["theme:dark", "aesthetic:dark_tech"], ...tagged },
    { quarter: "2026Q3", sector: "retail", traits: ["tracking:tight"], h1_size_px: 30 },
    { quarter: "2026Q3", sector: "retail", traits: [] },
  ];
  const s = compositeSeries(sites, base, x => x.traits);
  it("measured composites use every sampled site", () => {
    expect(s.get("combo:big_type|all")).toEqual([{ quarter: "2026Q3", share: 0.25, denom: 4, coverage: 0.8 }]);
    expect(s.get("combo:big_type|saas")![0]!.share).toBe(0.5);
  });
  it("AI composites use tagged sites only and scale coverage (thin AI coverage fails the forecast's own threshold)", () => {
    expect(s.get("combo:dark_tech|all")).toEqual([{ quarter: "2026Q3", share: 0.5, denom: 2, coverage: 0.4 }]);
  });
});
