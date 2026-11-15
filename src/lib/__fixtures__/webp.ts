// Minimal WebP headers for tests (VP8X / VP8L / VP8 first chunk), padded to a byte size.
export function webp(width: number, height: number, opts: { kind?: "VP8X" | "VP8L" | "VP8 "; bytes?: number } = {}) {
  const kind = opts.kind ?? "VP8X", len = Math.max(opts.bytes ?? 64, 32), b = new Uint8Array(len);
  const put = (o: number, s: string) => [...s].forEach((c, i) => (b[o + i] = c.charCodeAt(0)));
  put(0, "RIFF"); new DataView(b.buffer).setUint32(4, len - 8, true); put(8, "WEBP"); put(12, kind);
  new DataView(b.buffer).setUint32(16, len - 20, true);
  if (kind === "VP8X") { const w = width - 1, h = height - 1; b[24] = w & 255; b[25] = (w >> 8) & 255; b[26] = (w >> 16) & 255; b[27] = h & 255; b[28] = (h >> 8) & 255; b[29] = (h >> 16) & 255; }
  if (kind === "VP8L") { b[20] = 0x2f; const bits = (width - 1) | ((height - 1) << 14); b[21] = bits & 255; b[22] = (bits >>> 8) & 255; b[23] = (bits >>> 16) & 255; b[24] = (bits >>> 24) & 0x0f; }
  if (kind === "VP8 ") { b[23] = 0x9d; b[24] = 0x01; b[25] = 0x2a; b[26] = width & 255; b[27] = (width >> 8) & 0x3f; b[28] = height & 255; b[29] = (height >> 8) & 0x3f; }
  return b;
}
export const png = () => Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(40).fill(0)]);
export const b64 = (u: Uint8Array) => { let s = ""; for (const x of u) s += String.fromCharCode(x); return btoa(s); };
