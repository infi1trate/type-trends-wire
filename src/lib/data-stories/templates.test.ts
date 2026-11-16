import { describe, expect, it } from "vitest";
import { fxInput, fxCapture } from "./fixtures";
import { quarterCoverage, usableQuarters, shareSeries, activeSites, rowsIn } from "./series";
import { adoption, doubledAt } from "./templates/adoption";
import { multiplesFig, firstLast } from "./templates/multiples";
import { brandField, clusters } from "./templates/field";
import { paletteDrift, familyOf, DRIFT } from "./templates/drift";
import { toFrame, beforeAfter, strip, diffs, boxesOf, MAX_BOXES, FOLD } from "./templates/frames";
import type { CropRow } from "../crops";

describe("coverage rule", () => {
  it("counts a quarter only with 15 brands sampled (8 for one sector) and 25% coverage", () => {
    const thin = fxInput({ sampled: (i, q) => q !== "2022Q1" || i % 5 === 0 }); // 2022Q1: 12 of 60 sampled
    expect(quarterCoverage(thin, null).find(c => c.q === "2022Q1")).toMatchObject({ denom: 12, usable: false });
    expect(usableQuarters(thin, null)).toEqual(["2021Q1", "2023Q1", "2024Q1", "2026Q4"]);
    expect(quarterCoverage(thin, ["fintech"]).find(c => c.q === "2022Q1")).toMatchObject({ denom: 4, usable: false });
    const sector = fxInput({ perSector: 8 });
    expect(usableQuarters(sector, ["fintech"])).toHaveLength(5);
    expect(usableQuarters(fxInput({ perSector: 7 }), ["fintech"])).toEqual([]);
  });
  it("share series skip unusable quarters", () => {
    const thin = fxInput({ sampled: (i, q) => q !== "2022Q1" || i % 5 === 0 });
    expect(shareSeries(thin, null, "combo:big_type").map(p => p.q)).toEqual(["2021Q1", "2023Q1", "2024Q1", "2026Q4"]);
  });
});

describe("adoption timeline", () => {
  const i = fxInput(), key = "combo:big_type", share = shareSeries(i, null, key);
  const a = adoption({ signal: { key, name: "Big type" }, sites: activeSites(i, null), rows: rowsIn(i, null), usable: usableQuarters(i, null), share, title: "t", note: "n" });
  it("orders adopters by first well-covered sighting, then capture time, then domain", () => {
    const qi = (q: string) => a.fig.quarters.indexOf(q);
    for (let k = 1; k < a.fig.adopters.length; k++) expect(qi(a.fig.adopters[k]!.first)).toBeGreaterThanOrEqual(qi(a.fig.adopters[k - 1]!.first));
    expect(a.entries[0]!.first).toBe("2022Q1");
    expect(a.censored.every(x => x.first === "2021Q1")).toBe(true);
  });
  it("splits established, already-there and never", () => {
    expect([a.entries.length, a.censored.length, a.never.length]).toEqual([40, 10, 10]);
  });
  it("doubling is read from the share series", () => {
    expect(doubledAt([{ q: "2021Q1", share: 0.1, denom: 20 }, { q: "2022Q1", share: 0.19, denom: 20 }, { q: "2023Q1", share: 0.2, denom: 20 }])?.q).toBe("2023Q1");
    expect(doubledAt([{ q: "2021Q1", share: 0.1, denom: 20 }, { q: "2022Q1", share: 0.19, denom: 20 }])).toBeNull();
    expect(doubledAt([{ q: "2021Q1", share: 0, denom: 20 }, { q: "2022Q1", share: 0.5, denom: 20 }])).toBeNull();
  });
  it("empty: no rows gives no adopters and everyone unknown", () => {
    const e = adoption({ signal: { key, name: "Big type" }, sites: activeSites(i, null), rows: [], usable: [], share: [], title: "t", note: "n" });
    expect(e.fig.adopters).toEqual([]);
    expect(e.unknown).toBe(60);
  });
});

describe("small multiples", () => {
  it("shares one x axis and one y maximum across panels", () => {
    const f = multiplesFig({ title: "t", note: "n", unit: "count", chart: "bars", panels: [{ id: "a", label: "A", href: "/a", points: [{ x: "2022", y: 3 }] }, { id: "b", label: "B", href: "/b", points: [{ x: "2021", y: 9 }] }] });
    expect(f.xs).toEqual(["2021", "2022"]);
    expect(f.yMax).toBe(9);
    expect(firstLast(f.panels[0]!)).toBeNull();
  });
});

describe("brand field", () => {
  const axes = { x: { key: "x", label: "Headline size", measure: "m", unit: "px" as const }, y: { key: "y", label: "White space", measure: "m", unit: "share" as const } };
  const words = { x: ["Bigger headlines", "Smaller headlines"] as [string, string], y: ["more white space", "denser first screens"] as [string, string] };
  it("places measured brands, counts the missing, labels the extremes and the centre", () => {
    const f = brandField({ title: "t", note: "n", sector: "fintech", sectorName: "Fintech", axes, words, brands: [
      { domain: "a", name: "A", x: 20, y: 0.1 }, { domain: "b", name: "B", x: 80, y: 0.2 }, { domain: "c", name: "C", x: 50, y: 0.9 }, { domain: "d", name: "D", x: null, y: 0.5 }] });
    expect(f.points).toHaveLength(3);
    expect(f.missing).toBe(1);
    expect(f.centre).toEqual({ x: 50, y: 0.2 });
    expect(f.extremes.map(e => [e.id, e.domain])).toEqual([["x-max", "b"], ["x-min", "a"], ["y-max", "c"], ["y-min", "a"]]);
  });
  it("clusters deterministically and numbers them left to right", () => {
    const pts = [{ x: 1, y: 1 }, { x: 1.1, y: 1 }, { x: 5, y: 5 }, { x: 5.1, y: 5 }, { x: 9, y: 1 }, { x: 9.1, y: 1 }];
    expect(clusters(pts)).toEqual([0, 0, 1, 1, 2, 2]);
    expect(clusters(pts)).toEqual(clusters(pts));
  });
  it("empty field has no points and no extremes", () => {
    const f = brandField({ title: "t", note: "n", sector: "fintech", sectorName: "Fintech", axes, words, brands: [] });
    expect([f.points.length, f.extremes.length]).toEqual([0, 0]);
  });
});

describe("palette drift", () => {
  it("groups real hexes into families, weights by share and reads entered / left / stayed", () => {
    expect(familyOf("#FFFFFF").id).toBe("n-white");
    expect(familyOf("#111111").id).toBe("n-black");
    expect(familyOf("#2F6BFF").id).toBe("blue-light");
    const caps = (q: string, hex: string) => Array.from({ length: 15 }, (_, k) => ({ domain: `d${k}`, q, palette: [{ hex: "#FFFFFF", share: 0.7 }, { hex, share: 0.3 }] }));
    const d = paletteDrift({ title: "t", note: "n", scope: "fintech", quarters: ["2021Q1", "2026Q4"], captures: [...caps("2021Q1", "#2F6BFF"), ...caps("2026Q4", "#FF4F00")] });
    expect(d.fig.bands.map(b => b.q)).toEqual(["2021Q1", "2026Q4"]);
    expect(d.entered.map(s => s.id)).toEqual(["orange-light"]);
    expect(d.left.map(s => s.id)).toEqual(["blue-light"]);
    expect(d.stayed.map(s => s.id)).toEqual(["n-white"]);
    expect(d.fig.bands[1]!.swatches.find(s => s.id === "orange-light")!.hex).toBe("#FF4F00");
  });
  it("thin: a quarter with fewer than the minimum brands has no band", () => {
    const caps = Array.from({ length: DRIFT.minBrands - 1 }, (_, k) => ({ domain: `d${k}`, q: "2021Q1", palette: [{ hex: "#FFFFFF", share: 1 }] }));
    expect(paletteDrift({ title: "t", note: "n", scope: "x", quarters: ["2021Q1"], captures: caps }).fig.bands).toEqual([]);
  });
});

describe("captures: skeleton fallback and crop upgrade", () => {
  const a = fxCapture(1, "2021-02-10T00:00:00Z"), b = fxCapture(2, "2026-11-14T00:00:00Z", { bg: "#0A0A0A", source: "live", h1_size: 96 });
  const crop: CropRow = { domain: "x.example", section: "hero", viewport: "desktop", captured_at: "2026-11-15T00:00:00Z", first_seen_at: "2026-11-15T00:00:00Z", last_seen_at: "2026-11-15T00:00:00Z", path: "x.example/hero/2026-11-15-abcdef12.webp", width: 1280, height: 800, bytes: 1000, hash: "abcdef1234" };
  it("redraws from the skeleton in the capture's own colours when no crop exists", () => {
    const f = toFrame("x.example", b, []);
    expect(f.crop).toBeNull();
    expect([f.bg, f.accent]).toEqual(["#0A0A0A", "#2F6BFF"]);
    expect(f.ink).not.toBe(f.bg);
    expect(f.boxes.every(x => x[2] < FOLD.h)).toBe(true); // the box at y=2500 is below the fold
    expect(f.boxes.map(x => x[0])).toEqual(["s", "m", "h", "t", "c"]);
  });
  it("uses a crop captured within two days", () => {
    expect(toFrame("x.example", b, [crop]).crop?.src).toBe("/crops/x.example/hero/2026-11-15-abcdef12.webp");
    expect(toFrame("x.example", a, [crop]).crop).toBeNull();
  });
  it("caps boxes", () => {
    expect(boxesOf(Array.from({ length: 400 }, (_, k) => ({ kind: "text", x: 0, y: k, w: 10, h: 10 })), 1440)).toHaveLength(MAX_BOXES);
    expect(boxesOf(null, 1440)).toEqual([]);
  });
  it("before / after lists only measured differences", () => {
    expect(diffs(a, b).map(d => d.field)).toEqual(["Theme", "Page background", "Headline size"]);
    expect(diffs(a, { ...b, h1_size: 66, whitespace: 0.43 }).map(d => d.field)).toEqual(["Theme", "Page background"]);
    const f = beforeAfter({ title: "t", note: "n", domain: "x.example", name: "X", a, b, crops: [] });
    expect([f.before.crop, f.after.crop]).toEqual([null, null]);
  });
  it("the strip keeps every archive capture plus the latest live one and marks changes on the next frame", () => {
    const live2 = fxCapture(3, "2026-11-15T00:00:00Z", { source: "live" });
    const s = strip({ title: "t", note: "n", domain: "x.example", name: "X", captures: [b, a, live2], events: [{ id: 9, at: "2023-01-01T00:00:00Z", type: "type_change" }], crops: [] });
    expect(s.frames.map(f => f.id)).toEqual(["1", "3"]);
    expect(s.marks[0]).toMatchObject({ id: "9", after: "3" });
  });
});
