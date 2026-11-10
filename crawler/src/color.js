import sharp from "sharp";

export const rgbToHex = ([r, g, b]) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
export const parseCssColor = (s) => {
  const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(s || "");
  if (!m) return null;
  if (m[4] !== undefined && Number(m[4]) < 0.1) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};
export const luminance = ([r, g, b]) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
export const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
export const chroma = ([r, g, b]) => (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Palette of the first-viewport screenshot: top colors by pixel share, plus whitespace ratio. */
export async function paletteFromScreenshot(png, pageBg = null, top = 8) {
  const { data, info } = await sharp(png).resize(160, 100, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  const buckets = new Map();
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const e = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += r; e.g += g; e.b += b;
    buckets.set(key, e);
  }
  let colors = [...buckets.values()].map((e) => ({ rgb: [e.r / e.n, e.g / e.n, e.b / e.n], share: e.n / n }));
  colors.sort((a, b) => b.share - a.share);
  // Merge perceptually close buckets so gradients don't split one color into many.
  const merged = [];
  for (const c of colors) {
    const hit = merged.find((m) => dist(m.rgb, c.rgb) < 28);
    if (hit) { const t = hit.share + c.share; hit.rgb = hit.rgb.map((v, i) => (v * hit.share + c.rgb[i] * c.share) / t); hit.share = t; }
    else merged.push({ ...c });
  }
  merged.sort((a, b) => b.share - a.share);
  // Whitespace and theme are judged against the page background (a big hero image is not the background).
  const dominant = pageBg ?? merged[0].rgb;
  let near = 0;
  for (let i = 0; i < data.length; i += 3) if (dist([data[i], data[i + 1], data[i + 2]], dominant) < 18) near++;
  const meanLum = merged.reduce((a, c) => a + luminance(c.rgb) * c.share, 0);
  return {
    palette: merged.slice(0, top).map((c) => ({ hex: rgbToHex(c.rgb), share: +c.share.toFixed(4), chroma: +chroma(c.rgb).toFixed(3) })),
    whitespace_ratio: +(near / n).toFixed(3),
    theme: luminance(dominant) < 0.2 ? "dark" : "light",
    mean_luminance: +meanLum.toFixed(3),
  };
}

/** Accent = most saturated meaningful color among CTA backgrounds, then the screenshot palette. */
export function pickAccent(ctaBgs, palette) {
  const fromCta = ctaBgs.map(parseCssColor).filter((c) => c && chroma(c) > 0.25);
  if (fromCta.length) return rgbToHex(fromCta[0]);
  const p = palette.find((c) => c.chroma > 0.3 && c.share > 0.002);
  return p ? p.hex : null;
}
