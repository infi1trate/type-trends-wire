// Brand assets: the site's own icon and its own social card, as the homepage's <head> declares them. Sent through the
// crop pipeline as two extra sections ("icon", "card"), so storage, versions, opt-outs and removal follow the crop policy:
// small, credited, linked to the site, removable on request. Nothing is fetched beyond what the homepage points to itself and
// the two addresses every browser asks a site for by convention (/apple-touch-icon.png, /favicon.ico).
import sharp from "sharp";
import { lookup } from "node:dns/promises";
import { CROP_LIMITS, cropBody, cropHash, encodeCrop } from "./crops.js";
import { checkUrl, privateAddress } from "./requests.js";

export const ASSET_SECTIONS = ["icon", "card"];
export const ASSET_LIMITS = { iconMax: 256, iconMin: 48, fetchBytes: 3_000_000, timeoutMs: 15_000, tries: 5 };
const ALLOW_PRIVATE = process.env.ALLOW_HTTP === "1";

/**
 * Runs in the page. Returns { icons: [{ href, rel, size, type }], cards: [href] } from <head>: icon links and the
 * Open Graph / Twitter card image. URLs are absolute.
 */
export function findBrandAssets() {
  const abs = (u) => { try { return new URL(u, document.baseURI).href; } catch { return null; } };
  const sizeOf = (l) => {
    const s = (l.getAttribute("sizes") || "").toLowerCase();
    if (s === "any") return 512;
    const m = /(\d+)\s*x\s*(\d+)/.exec(s);
    return m ? Math.min(Number(m[1]), Number(m[2])) : 0;
  };
  const icons = [];
  for (const l of document.querySelectorAll("head link[rel][href]")) {
    const rel = (l.getAttribute("rel") || "").toLowerCase().split(/\s+/);
    const kind = rel.includes("apple-touch-icon") || rel.includes("apple-touch-icon-precomposed") ? "apple" : rel.includes("icon") ? "icon" : null;
    const href = abs(l.getAttribute("href"));
    if (kind && href) icons.push({ href, rel: kind, size: sizeOf(l), type: (l.getAttribute("type") || "").toLowerCase() });
  }
  const cards = [];
  for (const sel of ['meta[property="og:image:secure_url"]', 'meta[property="og:image"]', 'meta[name="og:image"]', 'meta[name="twitter:image"]', 'meta[name="twitter:image:src"]']) {
    for (const m of document.querySelectorAll(sel)) { const href = abs(m.getAttribute("content") || ""); if (href && !cards.includes(href)) cards.push(href); }
  }
  return { icons, cards, origin: location.origin };
}

const isIco = (i) => i.type.includes("x-icon") || i.type.includes("vnd.microsoft.icon") || /\.ico(\?|#|$)/i.test(i.href);
/**
 * Icon candidates, best first: the largest declared raster or SVG icon at or above the minimum, a touch icon counted as
 * 180 px when it declares no size, then the conventional /apple-touch-icon.png, then ICO files the page declares and the
 * conventional /favicon.ico (an ICO is a last resort: often 16 to 32 px, below the minimum).
 */
export function iconOrder(icons, origin) {
  const scored = (icons ?? []).filter((i) => i?.href && !isIco(i)).map((i) => ({ href: i.href, score: (i.type.includes("svg") || /\.svg(\?|#|$)/i.test(i.href) ? 512 : i.size || (i.rel === "apple" ? 180 : 32)) + (i.rel === "apple" ? 1 : 0) }));
  const out = [...new Set(scored.filter((i) => i.score >= ASSET_LIMITS.iconMin).sort((a, b) => b.score - a.score).map((i) => i.href))];
  const add = (href) => { if (!out.includes(href)) out.push(href); };
  if (origin) add(`${origin}/apple-touch-icon.png`);
  for (const i of icons ?? []) if (i?.href && isIco(i)) add(i.href);
  if (origin) add(`${origin}/favicon.ico`);
  return out;
}

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const isIcoBytes = (b) => b.length >= 22 && b.readUInt16LE(0) === 0 && b.readUInt16LE(2) === 1 && b.readUInt16LE(4) > 0 && b.readUInt16LE(4) < 64;
/**
 * The largest readable picture inside an ICO file, as PNG bytes: a PNG entry as stored, or a 32-bit uncompressed bitmap
 * entry re-encoded. Null when the file holds neither (older 4/8/24-bit bitmaps are left alone).
 */
export async function icoLargest(bytes) {
  try {
    if (!isIcoBytes(bytes)) return null;
    const entries = [];
    for (let i = 0, n = bytes.readUInt16LE(4); i < n && 6 + (i + 1) * 16 <= bytes.length; i++) {
      const o = 6 + i * 16, size = bytes.readUInt32LE(o + 8), off = bytes.readUInt32LE(o + 12);
      if (size > 0 && off + size <= bytes.length) entries.push({ w: bytes[o] || 256, bpp: bytes.readUInt16LE(o + 6), data: bytes.subarray(off, off + size) });
    }
    entries.sort((a, b) => b.w - a.w || b.bpp - a.bpp);
    for (const { data } of entries) {
      if (data.length > 8 && data.subarray(0, 8).equals(PNG_SIG)) return Buffer.from(data);
      // BITMAPINFOHEADER, 32 bits, uncompressed: BGRA rows stored bottom-up, declared height doubled for the mask.
      if (data.length >= 40 && data.readUInt32LE(0) === 40 && data.readUInt16LE(14) === 32 && data.readUInt32LE(16) === 0) {
        const w = data.readInt32LE(4), h = Math.abs(data.readInt32LE(8)) >> 1;
        if (w <= 0 || h <= 0 || w > 512 || h > 512 || 40 + w * h * 4 > data.length) continue;
        const px = Buffer.alloc(w * h * 4);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const from = 40 + ((h - 1 - y) * w + x) * 4, to = (y * w + x) * 4;
          px[to] = data[from + 2]; px[to + 1] = data[from + 1]; px[to + 2] = data[from]; px[to + 3] = data[from + 3];
        }
        return await sharp(px, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
      }
    }
    return null;
  } catch { return null; }
}

/** Icon bytes (PNG, JPEG, WebP, GIF, SVG, or an ICO's largest picture) → square-ish WebP within 256 px and the crop byte limit, or null when too small or unreadable. */
export async function encodeIcon(bytes) {
  try {
    if (isIcoBytes(bytes)) { bytes = await icoLargest(bytes); if (!bytes) return null; }
    const { data, info } = await sharp(bytes, { density: 384, animated: false }).rotate()
      .resize({ width: ASSET_LIMITS.iconMax, height: ASSET_LIMITS.iconMax, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 92, alphaQuality: 100 }).toBuffer({ resolveWithObject: true });
    if (Math.min(info.width, info.height) < ASSET_LIMITS.iconMin || data.length > CROP_LIMITS.storedBytes) return null;
    return { webp: data, width: info.width, height: info.height };
  } catch { return null; }
}

/** http(s) URL on a public host (shape and DNS), or null. Local fixture hosts pass only when ALLOW_HTTP=1. */
export async function publicAssetUrl(raw) {
  let u;
  try { u = checkUrl(raw, { allowPrivate: ALLOW_PRIVATE }); } catch { return null; }
  if (ALLOW_PRIVATE) return u;
  if (u.protocol !== "https:") return null;
  try {
    const addrs = await lookup(u.hostname.replace(/^\[|\]$/g, ""), { all: true, verbatim: true });
    return addrs.length > 0 && !addrs.some((a) => privateAddress(a.address)) ? u : null;
  } catch { return null; }
}

/** Image bytes from a URL the homepage declared, through the page's own browser context; null unless a 200 image within the size limit. */
export async function fetchAsset(page, raw) {
  const u = await publicAssetUrl(raw);
  if (!u) return null;
  const r = await page.request.get(u.href, { timeout: ASSET_LIMITS.timeoutMs, maxRedirects: 3, failOnStatusCode: false }).catch(() => null);
  if (!r || r.status() !== 200) return null;
  const type = (r.headers()["content-type"] || "").toLowerCase();
  if (!type.startsWith("image/")) return null;
  const body = await r.body().catch(() => null);
  return body && body.length > 0 && body.length <= ASSET_LIMITS.fetchBytes ? body : null;
}

/**
 * Captures the brand's icon and social card from an open homepage and queues them on the crop sender as sections
 * "icon" and "card". Returns the sections captured. Never throws.
 */
export async function captureBrandAssets(page, domain, sender, { now = () => new Date().toISOString() } = {}) {
  const done = [];
  try {
    const found = await page.evaluate(findBrandAssets);
    const plan = [["icon", iconOrder(found.icons, found.origin), encodeIcon], ["card", found.cards ?? [], encodeCrop]];
    for (const [section, urls, encode] of plan) {
      for (const url of urls.slice(0, ASSET_LIMITS.tries)) {
        const bytes = await fetchAsset(page, url);
        if (!bytes) continue;
        const enc = await encode(bytes).catch(() => null);
        if (!enc) continue;
        sender.add(cropBody(domain, section, now(), enc, await cropHash(enc.webp, section)));
        done.push(section);
        break;
      }
    }
  } catch { /* a page without usable assets just has none this run */ }
  return done;
}
