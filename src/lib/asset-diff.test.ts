import { describe, expect, it } from "vitest";
import { assetComparisons, assetGrid, decodeGrid, encodeGrid, gridDiff, gridSpread, visiblyDiffer, type AssetVersion, type Grid } from "./asset-diff";

const solid = (w: number, h: number, rgb: [number, number, number], a = 255) => { const p = new Uint8Array(w * h * 4); for (let i = 0; i < w * h; i++) p.set([...rgb, a], i * 4); return p; };
const withPatch = (w: number, h: number) => { const p = solid(w, h, [20, 20, 20]); for (let y = 0; y < h / 8; y++) for (let x = 0; x < w / 8; x++) p.set([250, 120, 0, 255], (y * w + x) * 4); return p; };
const grid = (p: Uint8Array, w: number, h: number): Grid => { const g = assetGrid(p, w, h); return { grid: g, spread: gridSpread(g) }; };
const v = (id: number, path: string, first: string, last: string, kind = "icon", domain = "x.com"): AssetVersion => ({ id, domain, kind, path, first_seen_at: first, last_seen_at: last, width: 192, height: 192 });

describe("W1b · perceptual icon and card comparison", () => {
  it("a resize or re-save of the same picture does not differ visibly", () => {
    const a = assetGrid(withPatch(192, 192), 192, 192), b = assetGrid(withPatch(96, 96), 96, 96);
    expect(visiblyDiffer(gridDiff(a, b))).toBe(false);
    expect(gridDiff(a, decodeGrid(encodeGrid(a))).mean).toBeLessThan(1);
  });
  it("a small new element counts through the block measure even when the average barely moves", () => {
    const a = assetGrid(solid(256, 256, [20, 20, 20]), 256, 256), b = assetGrid(withPatch(256, 256), 256, 256), d = gridDiff(a, b);
    expect(d.mean).toBeLessThan(12); expect(visiblyDiffer(d)).toBe(true);
  });
  it("transparent pixels are laid on white", () => {
    expect(gridSpread(assetGrid(solid(64, 64, [0, 0, 0], 0), 64, 64))).toBe(0);
    expect(assetGrid(solid(64, 64, [0, 0, 0], 0), 64, 64)[0]).toBe(255);
  });
  const A = grid(solid(64, 64, [10, 10, 200]), 64, 64), B = grid(withPatch(64, 64), 64, 64), BLANK = grid(solid(64, 64, [0, 0, 0], 0), 64, 64);
  it("a change needs the old picture on two captures and the new one on two captures six hours apart", () => {
    const g = new Map([["a", A], ["b", B]]);
    expect(assetComparisons([v(1, "a", "2026-11-20T08:00:00Z", "2026-11-20T14:00:00Z"), v(2, "b", "2026-11-21T06:00:00Z", "2026-11-21T13:00:00Z")], g)[0]!.verdict).toBe("change");
    expect(assetComparisons([v(1, "a", "2026-11-20T08:00:00Z", "2026-11-20T08:00:00Z"), v(2, "b", "2026-11-21T06:00:00Z", "2026-11-21T13:00:00Z")], g)[0]!.verdict).toBe("waiting");
    expect(assetComparisons([v(1, "a", "2026-11-20T08:00:00Z", "2026-11-20T14:00:00Z"), v(2, "b", "2026-11-21T06:00:00Z", "2026-11-21T11:00:00Z")], g)[0]!.verdict).toBe("waiting");
  });
  it("a re-save, a blank capture, a back-and-forth and a media card are never changes", () => {
    const span = ["2026-11-20T08:00:00Z", "2026-11-20T14:00:00Z"] as const, span2 = ["2026-11-21T06:00:00Z", "2026-11-21T13:00:00Z"] as const;
    expect(assetComparisons([v(1, "a", ...span), v(2, "a2", ...span2)], new Map([["a", A], ["a2", A]]))[0]!.verdict).toBe("re-encode");
    expect(assetComparisons([v(1, "a", ...span), v(2, "z", ...span2)], new Map([["a", A], ["z", BLANK]]))[0]!.verdict).toBe("blank");
    const alt = assetComparisons([v(1, "a", ...span), v(2, "b", ...span2), v(3, "a3", "2026-11-22T06:00:00Z", "2026-11-22T13:00:00Z")], new Map([["a", A], ["b", B], ["a3", A]]));
    expect(alt.map(c => c.verdict)).toEqual(["alternating", "alternating"]);
    expect(assetComparisons([v(1, "a", ...span, "card", "news.com"), v(2, "b", ...span2, "card", "news.com")], new Map([["a", A], ["b", B]]), new Set(["news.com"]))[0]!.verdict).toBe("editorial");
  });
});
