// W3a · museum works: the ingest contract (POST /api/public/ingest-art), the per-work checks, the thumbnail path and the plain
// credit line readers see. Only works the museum itself marks public domain (CC0) are stored; a link must be the museum's own page.
// Pure: no I/O.
import { z } from "zod";
import { decodeB64, sniffImage, webpSize } from "../thumbs";

export const ART_SOURCES = ["met", "aic"] as const;
export type ArtSource = (typeof ART_SOURCES)[number];
export const ART_KINDS = ["painting", "print", "drawing", "textile", "other"] as const;
export type ArtKind = (typeof ART_KINDS)[number];
/** The museum's own name, as the credit line says it. */
export const MUSEUM_NAME: Record<ArtSource, string> = { met: "The Metropolitan Museum of Art", aic: "The Art Institute of Chicago" };
/** A link must sit on the museum's own site: the host ends with this. */
export const LINK_HOST: Record<ArtSource, string> = { met: "metmuseum.org", aic: "artic.edu" };
export const ART_LIMITS = {
  requestBytes: 1024 * 1024, // whole POST body
  minWorks: 1, maxWorks: 20,
  thumbBytes: 20 * 1024, // decoded WebP
  thumbWidth: 240, thumbHeight: 480,
  paletteMin: 1, paletteMax: 8,
  /** Shares may add to a hair over 1 from rounding. */
  shareSum: 1.001,
} as const;
const HEX = /^#[0-9A-Fa-f]{6}$/;
const work = z.object({
  source: z.enum(ART_SOURCES),
  source_id: z.string().min(1).max(40),
  title: z.string().min(1).max(300),
  artist: z.string().min(1).max(200).nullable(),
  date_display: z.string().max(120),
  year_start: z.number().int().min(-3000).max(2030),
  year_end: z.number().int().min(-3000).max(2030),
  tradition: z.string().min(1).max(80),
  movement: z.string().min(1).max(80).nullable(),
  kind: z.enum(ART_KINDS),
  credit_line: z.string().max(400),
  link: z.string().url().max(500),
  // Checked per work (refused "not_cc0"), so one wrong record does not sink the batch.
  licence: z.string().max(40),
  palette: z.array(z.object({ hex: z.string().regex(HEX, "#RRGGBB"), share: z.number().min(0).max(1) }).strict()).min(ART_LIMITS.paletteMin).max(ART_LIMITS.paletteMax),
  width: z.number().int().min(1).max(ART_LIMITS.thumbWidth),
  height: z.number().int().min(1).max(ART_LIMITS.thumbHeight),
  webp_base64: z.string().min(1).max(Math.ceil(ART_LIMITS.thumbBytes / 3) * 4 + 8),
}).strict().refine(w => w.year_end >= w.year_start, { message: "year_end must be at or after year_start", path: ["year_end"] });
export const artPayload = z.object({ run_id: z.string().min(1).max(120), works: z.array(work).min(ART_LIMITS.minWorks).max(ART_LIMITS.maxWorks) }).strict();
export type ArtWorkIn = z.infer<typeof work>;
export type ArtRefusal = "removed" | "not_cc0" | "wrong_link_host" | "palette_shares" | "over_20kb" | "not_webp" | "bad_webp" | "dimension_mismatch";

/** The museum's own page: https and a host that is, or ends with, the museum's domain. */
export function linkOk(source: ArtSource, link: string): boolean {
  try { const u = new URL(link), h = u.hostname.toLowerCase(), want = LINK_HOST[source]; return u.protocol === "https:" && (h === want || h.endsWith(`.${want}`)); } catch { return false; }
}
/** Per-work checks after the shape is valid: the licence, the link's host, the palette's shares and the thumbnail. */
export function checkWork(w: ArtWorkIn): { ok: true; bytes: Uint8Array } | { ok: false; reason: ArtRefusal } {
  if (w.licence !== "CC0") return { ok: false, reason: "not_cc0" };
  if (!linkOk(w.source, w.link)) return { ok: false, reason: "wrong_link_host" };
  if (w.palette.reduce((a, c) => a + c.share, 0) > ART_LIMITS.shareSum) return { ok: false, reason: "palette_shares" };
  let bytes: Uint8Array; try { bytes = decodeB64(w.webp_base64); } catch { return { ok: false, reason: "bad_webp" }; }
  if (bytes.length > ART_LIMITS.thumbBytes) return { ok: false, reason: "over_20kb" };
  if (sniffImage(bytes) !== "webp") return { ok: false, reason: "not_webp" };
  const size = webpSize(bytes);
  if (!size || !size.width || !size.height) return { ok: false, reason: "bad_webp" };
  if (size.width !== w.width || size.height !== w.height) return { ok: false, reason: "dimension_mismatch" };
  return { ok: true, bytes };
}
/** Thumbnails share the crops bucket in their own folder: `art/<source>-<id>-<hash8>.webp`. */
export const ART_DIR = "art";
const safeId = (id: string) => id.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 40);
export const artPath = (source: ArtSource, sourceId: string, hash: string) => `${ART_DIR}/${source}-${safeId(sourceId)}-${hash.slice(0, 8)}.webp`;
export { isArtPath } from "../picture-paths";
/** The fields a stored row carries (everything but the picture). */
export const workFields = (w: ArtWorkIn) => ({ source: w.source, source_id: w.source_id, title: w.title, artist: w.artist, date_display: w.date_display, year_start: w.year_start, year_end: w.year_end,
  tradition: w.tradition, movement: w.movement, kind: w.kind, credit_line: w.credit_line, link: w.link, licence: "CC0" as const, palette: w.palette, width: w.width, height: w.height });
/** A work is unchanged when its fields and its picture are the same as stored: one hash over both. */
export const workHashInput = (w: ArtWorkIn) => JSON.stringify(workFields(w)) + "|" + w.webp_base64;

export const artRemoveBody = z.object({ source: z.enum(ART_SOURCES), source_id: z.string().min(1).max(40), reason: z.string().trim().min(3).max(300) });
export type ArtRemove = z.infer<typeof artRemoveBody>;

/** W3c · the credit every shown work carries: "Artist. Title, Date. Museum." (an unknown artist or a blank date is left out). */
export function workCredit(w: { artist: string | null; title: string; date_display: string; source: ArtSource }): string {
  const artist = w.artist?.trim(), date = w.date_display.trim();
  return `${artist ? `${artist.replace(/\.$/, "")}. ` : ""}${w.title.trim()}${date ? `, ${date}` : ""}. ${MUSEUM_NAME[w.source]}.`;
}
/** The reader's line: "Nearest in the museum: <artist>, <title>, <date>. <museum>. Public domain." (an unknown artist is left out). */
export function nearestLine(w: { artist: string | null; title: string; date_display: string; source: ArtSource }): string {
  return `Nearest in the museum: ${[w.artist, w.title, w.date_display].filter(x => x && x.trim()).join(", ")}. ${MUSEUM_NAME[w.source]}. Public domain.`;
}
