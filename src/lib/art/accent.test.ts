// W3c Part 1 · one colour at a time: the vivid rule, the share rule, the limit at its edge, removed works, brands with no accent, families.
import { describe, expect, it } from "vitest";
import { ACCENT_MAX_L, ACCENT_MIN_CHROMA, ACCENT_MIN_L, FAMILY_MIN_ACCENTS, HELD_DISTANCE, WORK_MIN_SHARE, accentFigures, accentHeadline, accentMatches, familyRows, headlineHolds, holdOf, vividAccent, workColours, workDistance, type WorkIn } from "./accent";
import { chroma, oklab } from "./palette";
import { workCredit } from "./contract";

const work = (id: string, palette: { hex: string; share: number }[], extra: Partial<WorkIn> & { kind?: string } = {}): WorkIn & { kind?: string } => ({ source: "aic", source_id: id, palette, kind: "painting", ...extra });
const accentOf = (hex: string) => { const v = vividAccent(hex); if (!v.ok) throw new Error(v.reason); return v.accent; };

describe("the vivid rule", () => {
  it("names its constants", () => { expect([ACCENT_MIN_CHROMA, ACCENT_MIN_L, ACCENT_MAX_L, WORK_MIN_SHARE, HELD_DISTANCE, FAMILY_MIN_ACCENTS]).toEqual([0.1, 0.3, 0.94, 0.02, 0.04, 5]); });
  it("a bright orange counts, with its family", () => { const a = accentOf("#FF7A00"); expect(a.family).toBe("orange"); expect(accentOf("#FF5128").family).toBe("red"); expect(a.chroma).toBeGreaterThanOrEqual(ACCENT_MIN_CHROMA); });
  it("a grey, a muted khaki, a near-black and a near-white do not", () => {
    expect(vividAccent("#808080")).toEqual({ ok: false, reason: "not vivid" });
    expect(chroma(oklab("#8A7F70"))).toBeLessThan(ACCENT_MIN_CHROMA);
    expect(vividAccent("#8A7F70")).toEqual({ ok: false, reason: "not vivid" });
    expect(vividAccent("#1A1030")).toEqual({ ok: false, reason: "near-black" });
    expect(vividAccent("#FFF0F5")).toEqual({ ok: false, reason: "near-white" });
  });
  it("no accent, or a value that is not a colour", () => { expect(vividAccent(null)).toEqual({ ok: false, reason: "no accent" }); expect(vividAccent("")).toEqual({ ok: false, reason: "no accent" }); expect(vividAccent("red")).toEqual({ ok: false, reason: "not a colour" }); });
});

describe("the share rule", () => {
  it("keeps colours holding 2% of the picture or more, and nothing smaller", () => {
    const cs = workColours(work("1", [{ hex: "#FF5128", share: 0.019 }, { hex: "#2050C0", share: 0.02 }, { hex: "#704020", share: 0.6 }]));
    expect(cs.map(c => c.hex)).toEqual(["#2050C0", "#704020"]);
  });
  it("a bright passage under 2% never holds the accent, however near", () => {
    expect(holdOf(accentOf("#FF5128"), [work("1", [{ hex: "#FF5128", share: 0.019 }, { hex: "#704020", share: 0.9 }])]).held).toBe(false);
  });
});

describe("the distance limit", () => {
  it("holds at the limit and not a hair past it", () => {
    const a = accentOf("#FF5128"), w = work("1", [{ hex: "#F05A30", share: 0.1 }]), d = workDistance(a, w)!.distance;
    expect(d).toBeGreaterThan(0);
    expect(holdOf(a, [w], d).held).toBe(true);
    expect(holdOf(a, [w], d - 0.0002).held).toBe(false);
  });
  it("the default limit: a same-colour pair holds, a neighbouring hue does not", () => {
    const a = accentOf("#CC3300");
    expect(holdOf(a, [work("1", [{ hex: "#C43A10", share: 0.1 }])]).held).toBe(true);
    expect(holdOf(a, [work("2", [{ hex: "#C06030", share: 0.1 }])]).held).toBe(false);
  });
  it("the nearest work wins; a tie goes to the larger share", () => {
    const a = accentOf("#2050C0");
    const h = holdOf(a, [work("small", [{ hex: "#2050C0", share: 0.03 }]), work("big", [{ hex: "#2050C0", share: 0.2 }]), work("far", [{ hex: "#3060A0", share: 0.5 }])]);
    expect(h.nearest!.work.source_id).toBe("big");
  });
});

describe("removed works and brands without an accent", () => {
  it("a removed work never matches", () => {
    const w = work("gone", [{ hex: "#FF5128", share: 0.5 }], { removed_at: "2026-11-20T00:00:00Z" });
    expect(workColours(w)).toEqual([]);
    expect(holdOf(accentOf("#FF5128"), [w]).nearest).toBeNull();
    expect(accentMatches([{ domain: "a.com", accent: "#FF5128" }], [w])[0]!.held).toBe(false);
    expect(accentFigures([{ domain: "a.com", accent: "#FF5128" }], [w]).works).toBe(0);
  });
  it("a brand with no accent, or a grey one, is not counted", () => {
    const m = accentMatches([{ domain: "none.com", accent: null }, { domain: "grey.com", accent: "#777777" }, { domain: "x.com", accent: "#FF5128" }], [work("1", [{ hex: "#FF5128", share: 0.3 }])]);
    expect(m.map(x => x.domain)).toEqual(["x.com"]);
  });
});

describe("family counts on a small fixture", () => {
  const works = [work("w1", [{ hex: "#FF7A00", share: 0.3 }, { hex: "#5A3A20", share: 0.6 }]), work("w2", [{ hex: "#C8102E", share: 0.05 }, { hex: "#203060", share: 0.4 }], { kind: "print" })];
  const oranges = ["#FF7A00", "#F87A08", "#FF7F05", "#FFB000", "#FFC040"], greens = ["#00A060", "#10B070", "#20C080", "#00905A", "#30D090"], pinks = ["#E0309A", "#F040B0", "#D02090", "#FF50C0", "#C01880"];
  const brands = [...oranges.map((a, k) => ({ domain: `o${k}.com`, accent: a })), ...greens.map((a, k) => ({ domain: `g${k}.com`, accent: a })), ...pinks.map((a, k) => ({ domain: `p${k}.com`, accent: a })), { domain: "r.com", accent: "#C8102E" }];
  const rows = familyRows(accentMatches(brands, works));
  it("counts held accents per family and orders most held first, empty families last", () => {
    expect(rows.map(r => [r.family, r.held, r.total])).toEqual([["orange", 3, 5], ["green", 0, 5], ["pink", 0, 5]]);
    expect(rows[0]!.pairs.length).toBeLessThanOrEqual(3);
    expect(rows[0]!.pairs[0]!.nearest!.work.source_id).toBe("w1");
  });
  it("a family under five accents gets no row but is kept for the counts", () => {
    expect(familyRows(accentMatches(brands, works), { all: true }).find(r => r.family === "red")).toMatchObject({ held: 1, total: 1 });
  });
  it("the headline: two empty families or more name them; otherwise the most held family", () => {
    expect(accentHeadline(rows, 2)).toBe("None of 2 museum works holds brand green or pink");
    expect(accentHeadline(rows.slice(0, 2), 2)).toBe("Orange is the brand colour museum works hold most: 3 of 5");
    expect(accentHeadline([...rows, { family: "violet", held: 0, total: 6 }], 2)).toBe("None of 2 museum works holds brand green, pink or violet");
  });
  it("the check: the headline's numbers are the stored ones", () => {
    const f = accentFigures(brands, works);
    expect([f.works, f.paintings, f.prints, f.vivid, f.held]).toEqual([2, 1, 1, 16, 4]);
    expect(headlineHolds(accentHeadline(f.families, f.works), f)).toBe(true);
    expect(headlineHolds("None of 3 museum works holds brand green or pink", f)).toBe(false);
    expect(headlineHolds("None of 2 museum works holds brand green or violet", f)).toBe(false);
  });
});

it("the credit reads Artist. Title, Date. Museum.", () => {
  expect(workCredit({ artist: "Edgar Degas", title: "The Millinery Shop", date_display: "1879–86", source: "aic" })).toBe("Edgar Degas. The Millinery Shop, 1879–86. The Art Institute of Chicago.");
  expect(workCredit({ artist: null, title: "Landscape", date_display: "", source: "met" })).toBe("Landscape. The Metropolitan Museum of Art.");
});
