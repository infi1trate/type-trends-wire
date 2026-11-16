// Section crops: pure ingest contract, WebP checks, storage paths, the history rule, and selection/display helpers. No I/O.
// Crops are other companies' pages: every display carries a credit (domain + capture date) and a link to the live site.
import { z } from "zod";
import { DOMAIN_RE, decodeB64, sniffImage, webpSize } from "./thumbs";
import { CROP_SECTION_NAME } from "./labels";
import { CONTACT_EMAIL } from "./site";

export const CROP_SECTIONS = ["hero", "nav", "pricing", "cta", "footer"] as const;
export type CropSection = (typeof CROP_SECTIONS)[number];
export const isCropSection = (s: unknown): s is CropSection => typeof s === "string" && (CROP_SECTIONS as readonly string[]).includes(s);
export const sectionName = (s: CropSection) => CROP_SECTION_NAME[s];

export const CROP_LIMITS = {
  requestBytes: 4 * 1024 * 1024, // whole POST body
  imageBytes: 150 * 1024, // decoded WebP
  maxWidth: 1280, maxHeight: 1600,
  minCaptures: 1, maxCaptures: 12,
  /** Versions kept per domain + section; a 13th evicts the oldest (row and object). */
  keep: 12,
} as const;

// base64 longer than twice the stored limit is stopped by the schema; anything between is decoded and refused as over_150kb.
const B64_MAX = Math.ceil((CROP_LIMITS.imageBytes * 2) / 3) * 4 + 4;
const SECTION_LIST = CROP_SECTIONS.join(", ");
export const cropCapture = z.object({
  domain: z.string().max(253).transform(s => s.trim().toLowerCase()).pipe(z.string().regex(DOMAIN_RE, "not a domain name")),
  section: z.enum(CROP_SECTIONS, { error: iss => `unknown section "${String(iss.input).slice(0, 40)}" (expected ${SECTION_LIST})` }),
  viewport: z.literal("desktop", { error: 'viewport must be "desktop"' }),
  captured_at: z.string().datetime({ offset: true, error: "captured_at must be an ISO date-time" }),
  width: z.number().int().min(1).max(CROP_LIMITS.maxWidth, `width must be at most ${CROP_LIMITS.maxWidth}`),
  height: z.number().int().min(1).max(CROP_LIMITS.maxHeight, `height must be at most ${CROP_LIMITS.maxHeight}`),
  hash: z.string().regex(/^[0-9a-fA-F]{16,64}$/, "hash must be 16–64 hex characters").transform(s => s.toLowerCase()),
  webp_base64: z.string().min(16, "webp_base64 is too short").max(B64_MAX, "webp_base64 is far over 150 KB").regex(/^[A-Za-z0-9+/]+={0,2}$/, "webp_base64 must be base64"),
}).strict();
export const cropPayload = z.object({
  run_id: z.string().min(1, "run_id is required").max(80),
  captures: z.array(cropCapture).min(CROP_LIMITS.minCaptures, "captures must hold 1–12 items").max(CROP_LIMITS.maxCaptures, "captures must hold 1–12 items"),
}).strict();
export type CropCapture = z.infer<typeof cropCapture>;
export type CropPayload = z.infer<typeof cropPayload>;

/** One plain sentence for a 400 from the first schema issue, e.g. `captures.0.section: unknown section "logo" (expected …)`. */
export function plainIssue(issues: { path: (string | number)[]; message: string }[]): string {
  const i = issues[0];
  if (!i) return "Malformed body";
  return i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message;
}

export type CropRefusal = "opted_out" | "untracked_domain" | "over_150kb" | "not_webp" | "bad_webp" | "too_large_dimensions" | "dimension_mismatch";
export type CropCheck = { ok: true; width: number; height: number; bytes: number } | { ok: false; reason: CropRefusal };
/** Really WebP, within 1280×1600 and 150 KB, and the header size matches the declared width and height. */
export function checkCrop(bytes: Uint8Array, declared: { width: number; height: number }): CropCheck {
  if (bytes.length > CROP_LIMITS.imageBytes) return { ok: false, reason: "over_150kb" };
  if (sniffImage(bytes) !== "webp") return { ok: false, reason: "not_webp" };
  const size = webpSize(bytes);
  if (!size || !size.width || !size.height) return { ok: false, reason: "bad_webp" };
  if (size.width > CROP_LIMITS.maxWidth || size.height > CROP_LIMITS.maxHeight) return { ok: false, reason: "too_large_dimensions" };
  if (size.width !== declared.width || size.height !== declared.height) return { ok: false, reason: "dimension_mismatch" };
  return { ok: true, ...size, bytes: bytes.length };
}
export const decodeCrop = (b64: string) => decodeB64(b64);

/** UTC calendar day of an ISO time. */
export const utcDay = (iso: string) => new Date(iso).toISOString().slice(0, 10);
/** `<domain>/<section>/<yyyy-mm-dd>-<first 8 of hash>.webp` (UTC day of the capture). */
export const cropPath = (domain: string, section: CropSection, capturedAt: string, hash: string) => `${domain}/${section}/${utcDay(capturedAt)}-${hash.slice(0, 8)}.webp`;
export const CROP_PATH_RE = /^([a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?)\/(hero|nav|pricing|cta|footer)\/(\d{4}-\d{2}-\d{2})-([0-9a-f]{8})\.webp$/;
export const parseCropPath = (path: string) => { const m = CROP_PATH_RE.exec(path); return m && DOMAIN_RE.test(m[1]!) ? { domain: m[1]!, section: m[2] as CropSection } : null; };

export type CropRow = { id?: number; domain: string; section: CropSection | string; viewport: string; captured_at: string; first_seen_at: string; last_seen_at: string; path: string; width: number; height: number; bytes: number; hash: string; run_id?: string | null };
const newestFirst = <T extends CropRow>(a: T, b: T) => b.captured_at.localeCompare(a.captured_at) || (b.id ?? 0) - (a.id ?? 0) || b.path.localeCompare(a.path);
const laterOf = (a: string, b: string) => (Date.parse(a) >= Date.parse(b) ? a : b);

/**
 * History rule for one incoming capture against the stored versions of its domain + section:
 * same hash as the newest version → unchanged (only last_seen_at moves forward); a version already at the same path → unchanged too;
 * otherwise insert a new version.
 */
export function planCrop<T extends CropRow>(versions: T[], c: { hash: string; captured_at: string; path: string }):
  { action: "unchanged"; row: T; last_seen_at: string } | { action: "insert" } {
  const sorted = [...versions].sort(newestFirst), newest = sorted[0];
  if (newest && newest.hash === c.hash) return { action: "unchanged", row: newest, last_seen_at: laterOf(newest.last_seen_at, c.captured_at) };
  const same = sorted.find(v => v.path === c.path);
  if (same) return { action: "unchanged", row: same, last_seen_at: laterOf(same.last_seen_at, c.captured_at) };
  return { action: "insert" };
}
/** Versions beyond the newest `keep` (12) for each domain + section, oldest last: these rows and objects are removed. */
export function cropEvictions<T extends CropRow>(rows: T[], keep: number = CROP_LIMITS.keep): T[] {
  const groups = new Map<string, T[]>();
  for (const r of rows) { const k = `${r.domain}|${r.section}|${r.viewport}`; groups.set(k, [...(groups.get(k) ?? []), r]); }
  return [...groups.values()].flatMap(g => [...g].sort(newestFirst).slice(keep));
}

// DISPLAY ----------------------------------------------------------------------------------------------
export type Crop = { domain: string; section: CropSection; sectionName: string; captured_at: string; last_seen_at: string; hash: string; src: string; width: number; height: number; alt: string; caption: string; live: string; report: string };
export const cropSrc = (path: string) => `/crops/${path}`;
/** "Report this image": the editor's address when set, else the removal policy (owners ask the editor, who runs the opt-out). */
export const reportHref = (domain: string) => (CONTACT_EMAIL ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Remove images of ${domain}`)}` : "/what-we-show#ed-w-images");
export function toCrop(r: CropRow): Crop {
  const section = (isCropSection(r.section) ? r.section : "hero") as CropSection, name = sectionName(section), day = utcDay(r.captured_at);
  return { domain: r.domain, section, sectionName: name, captured_at: r.captured_at, last_seen_at: r.last_seen_at, hash: r.hash, src: cropSrc(r.path), width: r.width, height: r.height,
    alt: `${r.domain} ${name.toLowerCase()}, captured ${day}`, caption: `${name} · ${r.domain} · captured ${day}`, live: `https://${r.domain}`, report: reportHref(r.domain) };
}

/** Every stored version of one section, newest first. */
export const versionsOf = <T extends CropRow>(rows: T[], domain: string, section: CropSection, viewport = "desktop") => rows.filter(r => r.domain === domain && r.section === section && r.viewport === viewport).sort(newestFirst);
/** Latest crop of each section that exists, in the fixed section order, with how many versions are stored. */
export function latestSections(rows: CropRow[], domain: string): (Crop & { versions: number })[] {
  return CROP_SECTIONS.flatMap(s => { const v = versionsOf(rows, domain, s); return v[0] ? [{ ...toCrop(v[0]), versions: v.length }] : []; });
}

/** A crop near the event time may come from the same crawl as the confirming snapshot, a little before or after it. */
export const CROP_PIVOT_SLACK_HOURS = 12;
/**
 * Before/after for a change at `pivot` (the event's effective time): before = newest version captured before pivot − slack,
 * after = earliest version captured at or after it. Null unless both exist and differ (different hash).
 */
export function beforeAfterAt<T extends CropRow>(versions: T[], pivot: string): { before: T; after: T } | null {
  const cut = Date.parse(pivot) - CROP_PIVOT_SLACK_HOURS * 3600e3;
  if (!Number.isFinite(cut)) return null;
  const sorted = [...versions].sort(newestFirst);
  const before = sorted.find(v => Date.parse(v.captured_at) < cut), after = [...sorted].reverse().find(v => Date.parse(v.captured_at) >= cut);
  return before && after && before.hash !== after.hash ? { before, after } : null;
}

/** A section crop illustrates what we measured only if it was still on the page within this many days of that measurement. */
export const CROP_MATCH_DAYS = 14;
/** The latest crop of a section that was still current around `measuredAt` (last seen no more than CROP_MATCH_DAYS before it). */
export function currentCrop<T extends CropRow>(rows: T[], domain: string, section: CropSection, measuredAt: string | null): T | null {
  const v = versionsOf(rows, domain, section)[0];
  if (!v) return null;
  if (!measuredAt) return v;
  return Date.parse(v.last_seen_at) >= Date.parse(measuredAt) - CROP_MATCH_DAYS * 864e5 ? v : null;
}

/** /status: brands with at least one crop, versions stored, newest capture. */
export function cropCoverage(rows: Pick<CropRow, "domain" | "captured_at">[]) {
  return { brands: new Set(rows.map(r => r.domain)).size, versions: rows.length, newest: rows.map(r => r.captured_at).sort().at(-1) ?? null };
}
export function cropCoverageLine(c: ReturnType<typeof cropCoverage>): string {
  if (!c.versions) return "Section crops: none stored yet. 0 brands have a crop and 0 versions are kept; crops arrive when the crawler sends them.";
  return `Section crops: ${c.brands} ${c.brands === 1 ? "brand has" : "brands have"} at least one crop, ${c.versions} ${c.versions === 1 ? "version" : "versions"} stored, newest capture ${utcDay(c.newest!)}.`;
}

// PATTERNS -----------------------------------------------------------------------------------------------
/** A pattern is illustrated when at least this many of its example brands have a current capture of its section. */
export const ILLUSTRATED_MIN = 3;
export const isIllustrated = (withCaptures: number) => withCaptures >= ILLUSTRATED_MIN;
/** "Bento grids · 34 examples · 21 with captures" */
export const patternCountLine = (name: string, examples: number, withCaptures: number) => `${name} · ${examples} ${examples === 1 ? "example" : "examples"} · ${withCaptures} with ${withCaptures === 1 ? "a capture" : "captures"}`;
export const NO_CAPTURE_TEXT = "No capture of this section yet";

/** /what-we-show "Images of other sites": the policy, generated from the limits above. */
export function imagePolicy(): { id: string; title: string; text: string }[] {
  const names = CROP_SECTIONS.map(s => CROP_SECTION_NAME[s].toLowerCase());
  return [
    { id: "what", title: "What we keep", text: `Small crops of each tracked brand's public desktop homepage: ${names.slice(0, -1).join(", ")} and ${names.at(-1)}. WebP, at most ${CROP_LIMITS.maxWidth}×${CROP_LIMITS.maxHeight} and ${CROP_LIMITS.imageBytes / 1024} KB each. Never full-page captures.` },
    { id: "history", title: "How history works", text: `A new version is stored only when a section looks different from its last stored version; otherwise we only note that it was seen again. At most ${CROP_LIMITS.keep} versions per section are kept; the oldest is deleted when a newer one arrives.` },
    { id: "credit", title: "Credit and access", text: "Every image shows the brand's domain and capture date and links to the live site. Images are shown only to readers inside the site's password gate, never to search engines or link previews." },
    { id: "removal", title: "Removal", text: `Owners can ask for removal${CONTACT_EMAIL ? ` at ${CONTACT_EMAIL}` : " by writing to the editor, Brandon Forant (brandon.wtf)"}. Once a site opts out, every stored crop and thumbnail of it is deleted, new captures are refused, and the site is shown by name only.` },
  ];
}
