import { describe, expect, it } from "vitest";
import { cropStats, luma, resizeL } from "./crop-stats";

// A 97×61 test pattern whose numbers were taken with Pillow (the tool the first 1,369 crops were measured with).
const W = 97, H = 61;
const pattern = () => { const a = new Uint8Array(W * H * 4); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; a[i] = (x * 37 + y * 11) % 256; a[i + 1] = (x * x + y * 5) % 256; a[i + 2] = (x * 3 + y * y) % 256; a[i + 3] = 255; } return a; };

describe("crop pixel measurement matches Pillow", () => {
  it("std, top share and edge mean equal Pillow's numbers for the same picture", () => {
    expect(cropStats(pattern(), W, H, 1000)).toEqual({ std: 49.3, top: 0.009, edges: 25.51, bpp: 0.169 });
  });
  it("the 32×20 bicubic reduction equals Pillow's first pixels", () => {
    expect([...resizeL(luma(pattern(), W, H), W, H, 32, 20).slice(0, 8)]).toEqual([20, 65, 65, 106, 155, 82, 130, 113]);
  });
  it("a one-tone picture is near-blank: no spread, one level covers it, no edges", () => {
    const flat = new Uint8Array(64 * 40 * 4).fill(200);
    expect(cropStats(flat, 64, 40, 100)).toMatchObject({ std: 0, top: 1, edges: 0 });
  });
});
