// Site thumbnails: pure request contract, WebP checks, storage paths, pruning and display helpers. No I/O.
import { z } from "zod";
export const THUMB_LIMITS = {
  requestBytes: 4 * 1024 * 1024, // whole POST body
  imageBytesHard: 300 * 1024, // any single decoded image; larger is refused before inspection
  storedBytes: 150 * 1024, // what we keep (the hosted runtime has no verified encoder, so images arrive final)
  maxWidth: 1280, maxHeight: 800, variants: [640, 320] as const, keep: 2, maxCaptures: 12,
} as const;
export const VIEWPORTS = ["desktop", "mobile"] as const;
export type Viewport = (typeof VIEWPORTS)[number];
export const DOMAIN_RE = /^(?=.{3,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
// base64 of 300 KB is 409,600 chars; the schema stops anything longer before decoding.
const b64 = z.string().min(16).max(Math.ceil(THUMB_LIMITS.imageBytesHard / 3) * 4 + 4).regex(/^[A-Za-z0-9+/]+={0,2}$/, "base64");
export const thumbCapture = z.object({
  domain: z.string().transform(s => s.trim().toLowerCase()).pipe(z.string().regex(DOMAIN_RE, "domain")),
  viewport: z.enum(VIEWPORTS),
  captured_at: z.string().datetime({ offset: true }),
  images: z.object({ full: b64, w640: b64.optional(), w320: b64.optional() }).strict(),
}).strict();
export const thumbPayload = z.object({ run_id: z.string().min(1).max(80).optional(), captures: z.array(thumbCapture).min(1).max(THUMB_LIMITS.maxCaptures) }).strict();
export type ThumbPayload = z.infer<typeof thumbPayload>;
export const optoutPayload = z.object({ domain: z.string().transform(s => s.trim().toLowerCase()).pipe(z.string().regex(DOMAIN_RE, "domain")), note: z.string().max(500).optional(), action: z.enum(["add", "remove"]).default("add") }).strict();

export type ImageKind = "webp" | "png" | "jpeg" | "gif" | "avif" | null;
const ascii = (b: Uint8Array, o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));
export function sniffImage(b: Uint8Array): ImageKind {
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "webp";
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 3) === "PNG") return "png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 6 && ascii(b, 0, 4) === "GIF8") return "gif";
  if (b.length >= 12 && ascii(b, 4, 4) === "ftyp" && /avi[fs]/.test(ascii(b, 8, 4))) return "avif";
  return null;
}
/** Canvas size of a WebP file from its first chunk (VP8, VP8L or VP8X); null when the header is not a well-formed WebP. */
export function webpSize(b: Uint8Array): { width: number; height: number } | null {
  if (sniffImage(b) !== "webp" || b.length < 30) return null;
  const riff = (b[4]! | (b[5]! << 8) | (b[6]! << 16) | (b[7]! << 24)) >>> 0;
  if (riff + 8 > b.length + 1 || riff < 22) return null;
  const fourcc = ascii(b, 12, 4);
  if (fourcc === "VP8 ") {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { width: (b[26]! | (b[27]! << 8)) & 0x3fff, height: (b[28]! | (b[29]! << 8)) & 0x3fff };
  }
  if (fourcc === "VP8L") {
    if (b[20] !== 0x2f) return null;
    const b1 = b[21]!, b2 = b[22]!, b3 = b[23]!, b4 = b[24]!;
    return { width: 1 + (((b2 & 0x3f) << 8) | b1), height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)) };
  }
  if (fourcc === "VP8X") return { width: 1 + (b[24]! | (b[25]! << 8) | (b[26]! << 16)), height: 1 + (b[27]! | (b[28]! << 8) | (b[29]! << 16)) };
  return null;
}
export const decodeB64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export type ImageCheck = { ok: true; width: number; height: number; bytes: number } | { ok: false; reason: string };
/** Size/type/dimension gate for one image. maxWidth is 1280 for the full crop or the variant width. */
export function checkImage(bytes: Uint8Array, maxWidth: number, maxHeight: number): ImageCheck {
  if (bytes.length > THUMB_LIMITS.imageBytesHard) return { ok: false, reason: "image_over_300kb" };
  const kind = sniffImage(bytes);
  if (kind !== "webp") return { ok: false, reason: kind ? `not_webp:${kind}` : "not_an_image" };
  const size = webpSize(bytes);
  if (!size || !size.width || !size.height) return { ok: false, reason: "bad_webp_header" };
  if (size.width > maxWidth || size.height > maxHeight) return { ok: false, reason: `too_large_dimensions:${size.width}x${size.height}` };
  if (bytes.length > THUMB_LIMITS.storedBytes) return { ok: false, reason: "image_over_150kb" };
  return { ok: true, ...size, bytes: bytes.length };
}

/** `<domain>/<yyyy-mm-dd>-<viewport>.webp`; variants add `-640w` / `-320w`. */
export const thumbPath = (domain: string, capturedAt: string, viewport: Viewport, variant?: number) =>
  `${domain}/${capturedAt.slice(0, 10)}-${viewport}${variant ? `-${variant}w` : ""}.webp`;
export const THUMB_PATH_RE = /^([a-z0-9.-]+)\/(\d{4}-\d{2}-\d{2})-(desktop|mobile)(?:-(640|320)w)?\.webp$/;
export const mainPathOf = (path: string) => (THUMB_PATH_RE.test(path) ? path.replace(/-(640|320)w\.webp$/, ".webp") : null);

export type ThumbVariant = { w: number; h: number; bytes: number; path: string };
export type ThumbRow = { id?: number; domain: string; captured_at: string; viewport: Viewport | string; path: string; width: number; height: number; bytes: number; variants: ThumbVariant[] | unknown; removed_at?: string | null };
export const allPaths = (r: ThumbRow) => [r.path, ...(Array.isArray(r.variants) ? (r.variants as ThumbVariant[]).map(v => v.path) : [])];
/** Rows beyond the newest `keep` per domain+viewport (removed rows count too, so storage never grows). */
export function pruneOld<T extends ThumbRow>(rows: T[], keep: number = THUMB_LIMITS.keep): T[] {
  const groups = new Map<string, T[]>();
  for (const r of rows) { const k = `${r.domain}|${r.viewport}`; groups.set(k, [...(groups.get(k) ?? []), r]); }
  return [...groups.values()].flatMap(g => [...g].sort((a, b) => b.captured_at.localeCompare(a.captured_at) || b.path.localeCompare(a.path)).slice(keep));
}

// Display
export type Thumb = { domain: string; captured_at: string; viewport: string; src: string; srcSet: string; width: number; height: number; alt: string; caption: string; live: string; terminal: string };
export const thumbSrc = (path: string) => `/thumbs/${path}`;
const day = (iso: string) => iso.slice(0, 10);
export const thumbCaption = (domain: string, capturedAt: string) => `${domain} · captured ${day(capturedAt)}`;
export const thumbAlt = (domain: string, capturedAt: string) => `${domain} homepage, captured ${day(capturedAt)}`;
export function toThumb(r: ThumbRow): Thumb {
  const vs = (Array.isArray(r.variants) ? (r.variants as ThumbVariant[]) : []).filter(v => v && typeof v.path === "string" && v.w > 0).sort((a, b) => a.w - b.w);
  return { domain: r.domain, captured_at: r.captured_at, viewport: r.viewport, src: thumbSrc(r.path), srcSet: [...vs.map(v => `${thumbSrc(v.path)} ${v.w}w`), `${thumbSrc(r.path)} ${r.width}w`].join(", "),
    width: r.width, height: r.height, alt: thumbAlt(r.domain, r.captured_at), caption: thumbCaption(r.domain, r.captured_at), live: `https://${r.domain}`, terminal: `/library/${r.domain}` };
}
/** Desktop capture nearest the reference date (prefer on/before it), else mobile; removed rows never show. */
export function pickThumb(rows: ThumbRow[], domain: string, refIso?: string): Thumb | null {
  const mine = rows.filter(r => r.domain === domain && !r.removed_at);
  for (const vp of ["desktop", "mobile"]) {
    const c = mine.filter(r => r.viewport === vp).sort((a, b) => b.captured_at.localeCompare(a.captured_at));
    if (!c.length) continue;
    const best = refIso ? (c.find(r => r.captured_at <= refIso) ?? c.at(-1)!) : c[0]!;
    return toThumb(best);
  }
  return null;
}
