// I3b · a crop's pixel measurement, the same numbers the I3 script took with Pillow (scripts/crop-quality-measure.py): the picture as
// 8-bit luminance (Pillow's "L" conversion), its standard deviation, the share of its commonest level, and the mean horizontal
// difference on a 32×20 bicubic reduction (Pillow's two-pass fixed-point resampling). Pure; the caller decodes the WebP to RGBA.
import type { PixelStats } from "./lead-picture";

/** Pillow's RGB → L: (R·19595 + G·38470 + B·7471 + 0x8000) >> 16; alpha is ignored. */
export function luma(rgba: Uint8Array | Uint8ClampedArray, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < out.length; i++, j += 4) out[i] = (rgba[j]! * 19595 + rgba[j + 1]! * 38470 + rgba[j + 2]! * 7471 + 0x8000) >>> 16;
  return out;
}
const PRECISION_BITS = 32 - 8 - 2;
const bicubic = (x: number) => { const a = -0.5; x = Math.abs(x); return x < 1 ? ((a + 2) * x - (a + 3)) * x * x + 1 : x < 2 ? (((x - 5) * x + 8) * x - 4) * a : 0; };
/** Pillow's precompute_coeffs + normalize_coeffs_8bpc for one axis. */
function coeffs(inSize: number, outSize: number): { bounds: [number, number][]; k: Int32Array[] } {
  const scale = inSize / outSize, filterscale = Math.max(scale, 1), support = 2 * filterscale, ss = 1 / filterscale;
  const bounds: [number, number][] = [], k: Int32Array[] = [];
  for (let xx = 0; xx < outSize; xx++) {
    const center = (xx + 0.5) * scale;
    let xmin = Math.trunc(center - support + 0.5); if (xmin < 0) xmin = 0;
    let xmax = Math.trunc(center + support + 0.5); if (xmax > inSize) xmax = inSize; xmax -= xmin;
    const w: number[] = []; let ww = 0;
    for (let x = 0; x < xmax; x++) { const v = bicubic((x + xmin - center + 0.5) * ss); w.push(v); ww += v; }
    const kk = new Int32Array(xmax);
    for (let x = 0; x < xmax; x++) { const v = ww !== 0 ? w[x]! / ww : w[x]!; kk[x] = v < 0 ? Math.trunc(-0.5 + v * (1 << PRECISION_BITS)) : Math.trunc(0.5 + v * (1 << PRECISION_BITS)); }
    bounds.push([xmin, xmax]); k.push(kk);
  }
  return { bounds, k };
}
const clip8 = (ss: number) => { const v = Math.floor(ss / (1 << PRECISION_BITS)); return v < 0 ? 0 : v > 255 ? 255 : v; };
/** Pillow's Image.resize((ow, oh)) with its default bicubic filter, for an 8-bit single-channel image (horizontal pass, then vertical). */
export function resizeL(src: Uint8Array, w: number, h: number, ow: number, oh: number): Uint8Array {
  const H = coeffs(w, ow), V = coeffs(h, oh);
  const y0 = V.bounds[0]![0], y1 = V.bounds[oh - 1]![0] + V.bounds[oh - 1]![1], th = y1 - y0;
  const tmp = new Uint8Array(ow * th);
  for (let y = 0; y < th; y++) for (let xx = 0; xx < ow; xx++) {
    const [xmin, xmax] = H.bounds[xx]!, kk = H.k[xx]!; let ss = 1 << (PRECISION_BITS - 1);
    for (let x = 0; x < xmax; x++) ss += src[(y + y0) * w + x + xmin]! * kk[x]!;
    tmp[y * ow + xx] = clip8(ss);
  }
  const out = new Uint8Array(ow * oh);
  for (let yy = 0; yy < oh; yy++) {
    const [ymin, ymax] = V.bounds[yy]!, kk = V.k[yy]!, base = ymin - y0;
    for (let xx = 0; xx < ow; xx++) { let ss = 1 << (PRECISION_BITS - 1); for (let y = 0; y < ymax; y++) ss += tmp[(y + base) * ow + xx]! * kk[y]!; out[yy * ow + xx] = clip8(ss); }
  }
  return out;
}
const round = (x: number, n: number) => Number(x.toFixed(n));
/** std (1 decimal), top (3 decimals), edges (2 decimals) and bytes per pixel (4 decimals), as the I3 script stored them. */
export function cropStats(rgba: Uint8Array | Uint8ClampedArray, w: number, h: number, bytes: number): PixelStats & { std: number; bpp: number } {
  const l = luma(rgba, w, h), hist = new Array<number>(256).fill(0);
  for (const v of l) hist[v]!++;
  let n = 0, sum = 0, sum2 = 0, top = 0;
  for (let i = 0; i < 256; i++) { const c = hist[i]!; n += c; sum += i * c; sum2 += i * i * c; if (c > top) top = c; }
  const std = Math.sqrt(Math.max(0, (sum2 - (sum * sum) / n) / n));
  const small = resizeL(l, w, h, 32, 20); let e = 0;
  for (let y = 0; y < 20; y++) for (let x = 0; x < 31; x++) e += Math.abs(small[y * 32 + x]! - small[y * 32 + x + 1]!);
  return { std: round(std, 1), top: round(top / n, 3), edges: round(e / (31 * 20), 2), bpp: round(bytes / (w * h), 4) };
}
