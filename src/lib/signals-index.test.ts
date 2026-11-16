import { describe, expect, it } from "vitest";
import { FIRST_ROWS, changeOf, defaultSort, momentumText, parseSignalsSearch, signalsIndex, signalsSearch } from "./signals-index";
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
  it("the default view sends the first screen only: all headline rows, the first 15 supporting, the archive as a count", () => {
    expect(FIRST_ROWS).toEqual({ headline: Infinity, supporting: 15, archive: 0 });
    const many = Array.from({ length: 20 }, (_, k) => ({ ...all.find(s => s.tier === "supporting")!, key: `font:s${k}`, name: `S${k}` }));
    const lens = { sector: "all", scope: "all", signals: [...all, ...many], note: null };
    const g = signalsIndex({ all, lens, series }, base).groups.find(x => x.tier === "supporting")!;
    expect([g.rows.length, g.count]).toEqual([15, 21]);
    expect(signalsIndex({ all, lens, series }, { ...base, archive: true }).groups.find(x => x.tier === "supporting")!.rows.length).toBe(21);
  });
  it("groups by tier: Headline, Supporting, then Archive folded", () => {
    const x = signalsIndex({ all, lens: { sector: "all", scope: "all", signals: all, note: null }, series }, base);
    expect(x.groups.map(g => [g.tier, g.count, g.folded])).toEqual([["headline", 3, false], ["supporting", 1, false], ["archive", 1, true]]);
    expect(x.groups[2]!.rows).toEqual([]); // folded: the count is sent, the rows come with ?tier=archive
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
  it("with a sector lens, Momentum is the all-sector value, labelled as such, and never a bare dash", () => {
    const scoped = fintech.map(x => ({ ...x, momentum_index: null })); // Momentum is scored for all sectors only
    const x = signalsIndex({ all, lens: { sector: "fintech", scope: "fintech", signals: scoped, note: null }, series }, parseSignalsSearch({ sector: "fintech", sort: "momentum", tier: "archive" }));
    const rows = x.groups.flatMap(g => g.rows), big = rows.find(r => r.key === "combo:big_type")!;
    expect([big.momentum, big.momentumAll, momentumText(big)]).toEqual([90, true, "Momentum 90, all sectors"]);
    expect(rows.map(momentumText).some(t => t != null && /—/.test(t))).toBe(false);
    expect(momentumText(rows.find(r => r.key === "css:old")!)).toBeNull(); // an unscored row shows nothing in that slot
    expect(x.groups[0]!.rows.map(r => r.key)).toEqual(["combo:big_type", "font:inter", "css:has"]); // sorted by the all-sector value
    expect(x.countLine).toContain("by momentum across all sectors");
    const plain = signalsIndex({ all, lens: { sector: "all", scope: "all", signals: all, note: null }, series }, base).groups[0]!.rows[0]!;
    expect(momentumText(plain)).toBe("Momentum 90");
  });
  it("an unscored row leaves the Momentum slot empty; the count line says why once; the Momentum sort puts them last under one rule", () => {
    const some = all.map(x => (x.key === "font:inter" || x.key === "css:has" ? { ...x, momentum_index: null } : x));
    const x = signalsIndex({ all: some, lens: { sector: "all", scope: "all", signals: some, note: null }, series }, base);
    const head = x.groups[0]!;
    expect(head.rows.map(r => [r.key, momentumText(r)])).toEqual([["combo:big_type", "Momentum 90"], ["css:has", null], ["font:inter", null]]);
    expect(head.unscoredFrom).toBe(1);
    expect(x.momentumLine).toBe("Momentum is scored for 2 of 4; it needs a share under 35% across all sectors and at least 3 tracked sites; signals already that common have no next wave to score.");
    expect(x.countLine.match(/Momentum is scored/g)).toHaveLength(1);
    expect(signalsIndex({ all: some, lens: { sector: "all", scope: "all", signals: some, note: null }, series }, { ...base, sort: "share" }).groups[0]!.unscoredFrom).toBeNull();
    expect(signalsIndex({ all, lens: { sector: "all", scope: "all", signals: all, note: null }, series }, base).momentumLine).toBeNull();
  });
});
