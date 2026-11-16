import { describe, expect, it } from "vitest";
import { changeOf, defaultSort, parseSignalsSearch, signalsIndex, signalsSearch } from "./signals-index";
import type { Signal } from "./signals";

const sig = (key: string, o: Partial<Signal>): Signal => ({ key, name: key, dimension: "LAYOUT", basis: "measured", tier: "headline", reasons: [], scope: "all", stage: "Rising", share: 0.1, momentum: null, direction: null, next_wave_score: null,
  momentum_index: 50, confidence: "High", confidence_reason: "", so_what: null, sites: 100, quarters: 8, components: 4, ...o });
const all = [
  sig("combo:big_type", { share: 0.3, momentum_index: 90 }), sig("css:has", { dimension: "LAYOUT", share: 0.6, momentum_index: 40 }),
  sig("font:inter", { dimension: "FONT", share: 0.2, momentum_index: 70 }), sig("color:neon", { dimension: "COLOR", tier: "supporting", share: 0.05, momentum_index: 20 }),
  sig("css:old", { tier: "archive", share: 0.01, momentum_index: null }),
];
const fintech = all.map(s => ({ ...s, scope: "fintech", share: s.key === "font:inter" ? 0.8 : (s.share ?? 0) / 2 }));
const series = { "combo:big_type": [0.1, 0.2, 0.3], "css:has": [0.5, 0.6], "font:inter": [0.4, 0.2] };
const base = parseSignalsSearch({});

describe("signals index", () => {
  it("groups by tier: Headline, Supporting, then Archive folded", () => {
    const x = signalsIndex({ all, lens: { sector: "all", scope: "all", signals: all, note: null }, series }, base);
    expect(x.groups.map(g => [g.tier, g.rows.length, g.folded])).toEqual([["headline", 3, false], ["supporting", 1, false], ["archive", 1, true]]);
    expect(x.groups[0]!.rows.map(r => [r.rank, r.key])).toEqual([[1, "combo:big_type"], [2, "font:inter"], [3, "css:has"]]);
    expect(x.countLine).toBe("3 headline and 1 supporting signals, by momentum; 1 archive signal folded.");
    expect(signalsIndex({ all, lens: { sector: "all", scope: "all", signals: all, note: null }, series }, { ...base, archive: true }).groups[2]!.folded).toBe(false);
  });
  it("each sort", () => {
    const lens = { sector: "all", scope: "all", signals: all, note: null };
    expect(signalsIndex({ all, lens, series }, { ...base, sort: "share" }).groups[0]!.rows.map(r => r.key)).toEqual(["css:has", "combo:big_type", "font:inter"]);
    expect(signalsIndex({ all, lens, series }, { ...base, sort: "change" }).groups[0]!.rows.map(r => r.key)).toEqual(["combo:big_type", "css:has", "font:inter"]);
    expect(changeOf([0.1, 0.2, 0.3])).toBeCloseTo(0.2); expect(changeOf([0.4])).toBeNull();
  });
  it("the sector lens reorders by the sector's share and shows it against all sectors", () => {
    const v = parseSignalsSearch({ sector: "fintech" });
    expect(v.sort).toBe("share");
    const x = signalsIndex({ all, lens: { sector: "fintech", scope: "fintech", signals: fintech, note: null }, series }, v);
    const top = x.groups[0]!.rows[0]!;
    expect([top.key, top.share, top.allShare]).toEqual(["font:inter", 0.8, 0.2]);
    expect(x.scoped).toBe(true);
    expect(x.countLine).toContain("in Fintech, by share now");
  });
  it("the dimension filter", () => {
    const x = signalsIndex({ all, lens: { sector: "all", scope: "all", signals: all, note: null }, series }, { ...base, tab: "type" });
    expect(x.groups.flatMap(g => g.rows.map(r => r.key))).toEqual(["font:inter"]);
    expect(x.countLine).toContain("in Type");
  });
  it("URL round trip leaves defaults out", () => {
    expect(signalsSearch(base)).toEqual({});
    expect(defaultSort("all")).toBe("momentum");
    const v = parseSignalsSearch({ tab: "color", sort: "change", sector: "fintech", tier: "archive" });
    expect(signalsSearch(v)).toEqual({ tab: "color", sort: "change", sector: "fintech", tier: "archive" });
    expect(parseSignalsSearch(signalsSearch(v))).toEqual(v);
    expect(parseSignalsSearch({ sort: "nonsense", tab: "nope" })).toEqual(base);
  });
});
