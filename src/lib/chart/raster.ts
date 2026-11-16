// Pure-JS rasterizer + PNG encoder for the chart card (no native or WASM deps, so it runs on the hosted runtime).
// Anti-aliased nonzero scanline fill (4 sub-rows, exact horizontal coverage) and pre-rendered IBM Plex Mono glyph masks.
import { FACE_ATLASES, GLYPH_ATLASES, GLYPH_CHARS } from "./glyphs.gen";
import { memoBy } from "../memo";
import { ballGeom, markGeom, type Prim } from "./card";
import { advances, atlasKey, type Face, type TextSize, type TextWeight } from "./fonts";
import { flattenPath } from "./path";
import { MARK_INK } from "@/components/brand/mark";

type Glyph = { w: number; h: number; l: number; t: number; data: Uint8Array };
async function inflate(bytes: Uint8Array) { const s = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate")); return new Uint8Array(await new Response(s).arrayBuffer()); }
async function deflate(bytes: Uint8Array) { const s = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream("deflate")); return new Uint8Array(await new Response(s).arrayBuffer()); }
const b64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const atlas = memoBy(Infinity, async (key: string): Promise<Map<string, Glyph>> => {
      const src = GLYPH_ATLASES[key] ?? FACE_ATLASES[key]; if (!src) throw new Error(`missing glyph atlas ${key}`);
      const raw = await inflate(b64(src)), view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength), map = new Map<string, Glyph>(); let o = 0;
      for (const ch of GLYPH_CHARS) { const w = view.getUint16(o, true), h = view.getUint16(o + 2, true), l = view.getInt16(o + 4, true), t = view.getInt16(o + 6, true); o += 8; map.set(ch, { w, h, l, t, data: raw.subarray(o, o + w * h) }); o += w * h; }
      return map;
}, { key: k => k, retries: 0 });
const rgbOf = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

class Canvas {
  px: Uint8Array;
  constructor(public w: number, public h: number) { this.px = new Uint8Array(w * h * 3); }
  blend(i: number, c: [number, number, number], a: number) { if (a <= 0) return; const o = i * 3, k = Math.min(1, a); this.px[o] = this.px[o]! + (c[0] - this.px[o]!) * k; this.px[o + 1] = this.px[o + 1]! + (c[1] - this.px[o + 1]!) * k; this.px[o + 2] = this.px[o + 2]! + (c[2] - this.px[o + 2]!) * k; }
  /** Union of polygons (each normalized to the same orientation) filled with nonzero winding. */
  /** `keepWinding`: fill as drawn (nonzero), so reverse-wound contours cut holes (the mark's counters and slits). */
  fill(polys: [number, number][][], color: string, opacity = 1, keepWinding = false) {
    const SS = 4, c = rgbOf(color), edges: { x0: number; y0: number; x1: number; y1: number; dir: number }[] = [];
    let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
    for (let poly of polys) {
      let area = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i]!, b = poly[(i + 1) % poly.length]!; area += a[0] * b[1] - b[0] * a[1]; }
      if (area < 0 && !keepWinding) poly = [...poly].reverse();
      for (let i = 0; i < poly.length; i++) { const a = poly[i]!, b = poly[(i + 1) % poly.length]!; minX = Math.min(minX, a[0]); maxX = Math.max(maxX, a[0]); minY = Math.min(minY, a[1]); maxY = Math.max(maxY, a[1]); if (a[1] === b[1]) continue; edges.push(a[1] < b[1] ? { x0: a[0], y0: a[1], x1: b[0], y1: b[1], dir: 1 } : { x0: b[0], y0: b[1], x1: a[0], y1: a[1], dir: -1 }); }
    }
    const x0 = Math.max(0, Math.floor(minX)), x1 = Math.min(this.w, Math.ceil(maxX) + 1), y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(this.h, Math.ceil(maxY) + 1), bw = x1 - x0;
    if (bw <= 0 || y1 <= y0) return;
    const cov = new Float32Array(bw);
    for (let py = y0; py < y1; py++) {
      cov.fill(0);
      for (let s = 0; s < SS; s++) {
        const sy = py + (s + 0.5) / SS, xs: { x: number; d: number }[] = [];
        for (const e of edges) if (sy >= e.y0 && sy < e.y1) xs.push({ x: e.x0 + ((sy - e.y0) / (e.y1 - e.y0)) * (e.x1 - e.x0), d: e.dir });
        xs.sort((a, b) => a.x - b.x); let wind = 0;
        for (let i = 0; i < xs.length - 1; i++) {
          wind += xs[i]!.d; if (wind === 0) continue;
          const a = Math.max(x0, xs[i]!.x), b = Math.min(x1, xs[i + 1]!.x); if (b <= a) continue;
          const ia = Math.floor(a), ib = Math.floor(b);
          if (ia === ib) { cov[ia - x0] = cov[ia - x0]! + (b - a) / SS; continue; }
          cov[ia - x0] = cov[ia - x0]! + (ia + 1 - a) / SS;
          for (let x = ia + 1; x < ib; x++) cov[x - x0] = cov[x - x0]! + 1 / SS;
          if (ib < x1) cov[ib - x0] = cov[ib - x0]! + (b - ib) / SS;
        }
      }
      for (let x = 0; x < bw; x++) if (cov[x]! > 0) this.blend(py * this.w + x0 + x, c, Math.min(1, cov[x]!) * opacity);
    }
  }
  stroke(pts: [number, number][], width: number, color: string, dash?: [number, number], opacity = 1) {
    const segs: [[number, number], [number, number]][] = [];
    if (dash) { let on = true, left = dash[0]; for (let i = 0; i < pts.length - 1; i++) { let a = pts[i]!; const b = pts[i + 1]!; let len = Math.hypot(b[0] - a[0], b[1] - a[1]); while (len > 0) { const step = Math.min(left, len), t = step / len, m: [number, number] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; if (on) segs.push([a, m]); a = m; len -= step; left -= step; if (left <= 1e-9) { on = !on; left = on ? dash[0] : dash[1]; } } } }
    else for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i]!, pts[i + 1]!]);
    const r = width / 2, polys: [number, number][][] = [];
    for (const [a, b] of segs) { const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = (-(b[1] - a[1]) / len) * r, ny = ((b[0] - a[0]) / len) * r; polys.push([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]); }
    if (!dash) for (const p of pts) polys.push(Array.from({ length: 12 }, (_, i) => [p[0] + r * Math.cos((i * Math.PI) / 6), p[1] + r * Math.sin((i * Math.PI) / 6)] as [number, number]));
    this.fill(polys, color, opacity);
  }
  async text(x: number, y: number, text: string, size: TextSize, weight: TextWeight, color: string, anchor?: "start" | "end", face: Face = "mono") {
    const g = await atlas(atlasKey(face, weight, size)), c = rgbOf(color), chars = [...text], adv = advances(text, size, weight, face);
    let pen = anchor === "end" ? x - adv.reduce((a, b) => a + b, 0) : x;
    for (const [k, ch] of chars.entries()) {
      const gl = g.get(ch) ?? g.get("?")!, ox = Math.round(pen) + gl.l, oy = Math.round(y) + gl.t;
      for (let j = 0; j < gl.h; j++) { const yy = oy + j; if (yy < 0 || yy >= this.h) continue; for (let i = 0; i < gl.w; i++) { const xx = ox + i, a = gl.data[j * gl.w + i]!; if (a && xx >= 0 && xx < this.w) this.blend(yy * this.w + xx, c, a / 255); } }
      pen += adv[k]!;
    }
  }
}
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(parts: Uint8Array[]) { let c = 0xffffffff; for (const p of parts) for (let i = 0; i < p.length; i++) c = CRC[(c ^ p[i]!) & 0xff]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type: string, data: Uint8Array) { const out = new Uint8Array(12 + data.length), v = new DataView(out.buffer), t = new TextEncoder().encode(type); v.setUint32(0, data.length); out.set(t, 4); out.set(data, 8); v.setUint32(8 + data.length, crc32([t, data])); return out; }
export async function encodePng(px: Uint8Array, w: number, h: number) {
  const raw = new Uint8Array((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { const o = y * (w * 3 + 1), r = y * w * 3; raw[o] = 1; for (let i = 0; i < w * 3; i++) raw[o + 1 + i] = (px[r + i]! - (i >= 3 ? px[r + i - 3]! : 0)) & 0xff; }
  const ihdr = new Uint8Array(13), v = new DataView(ihdr.buffer); v.setUint32(0, w); v.setUint32(4, h); ihdr.set([8, 2, 0, 0, 0], 8);
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", await deflate(raw)), chunk("IEND", new Uint8Array())];
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out;
}
export async function renderScenePng(scene: { w: number; h: number; prims: Prim[] }) {
  const cv = new Canvas(scene.w, scene.h);
  for (const p of scene.prims) {
    if (p.k === "rect") cv.fill([[[p.x, p.y], [p.x + p.w, p.y], [p.x + p.w, p.y + p.h], [p.x, p.y + p.h]]], p.fill, p.opacity ?? 1);
    else if (p.k === "poly") cv.fill([p.pts], p.fill, p.opacity);
    else if (p.k === "line") cv.stroke(p.pts, p.width, p.stroke, p.dash, p.opacity ?? 1);
    else if (p.k === "mark") { const m = markGeom(p); if (m.slab) cv.fill([[[m.slab.x, m.slab.y], [m.slab.x + m.slab.w, m.slab.y], [m.slab.x + m.slab.w, m.slab.y + m.slab.h], [m.slab.x, m.slab.y + m.slab.h]]], m.slab.fill); cv.fill(flattenPath(m.d, m.s, m.x, m.y), MARK_INK, 1, true); }
    else if (p.k === "ball") for (const g of ballGeom(p)) cv.fill([g.pts], g.fill);
    else await cv.text(p.x, p.y, p.text, p.size, p.weight, p.fill, p.anchor, p.face);
  }
  return encodePng(cv.px, scene.w, scene.h);
}
