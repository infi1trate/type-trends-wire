// Real pictures of a brand (I1), pure: the latest site icon, social card and hero crop per brand (the public brand_pictures view),
// the brand page cover (card, else hero crop), and the hero crop a wireframe can reveal. Every picture carries its credit.
import { cropSrc, reportHref, versionsOf, type CropRow } from "./crops";
import { ASSET_NAME } from "./brand-assets";

export type PictureKind = "icon" | "card" | "hero";
export type PictureRow = { domain: string; kind: string; path: string; width: number; height: number; captured_at: string };
/** One stored picture, ready to draw: its address, stored size and capture time. */
export type Pic = { src: string; width: number; height: number; at: string };
export type BrandPics = { icon: Pic | null; card: Pic | null; hero: Pic | null };
export const NO_PICS: BrandPics = { icon: null, card: null, hero: null };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "20 Nov 2026" (UTC). */
export function longDay(iso: string): string { const d = new Date(iso); return Number.isFinite(d.getTime()) ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : iso.slice(0, 10); }

/** Latest picture of each kind per brand (rows newest first per domain + kind win). */
export function pictureIndex(rows: PictureRow[]): Map<string, BrandPics> {
  const out = new Map<string, BrandPics>();
  for (const r of rows) {
    if (r.kind !== "icon" && r.kind !== "card" && r.kind !== "hero") continue;
    const cur = out.get(r.domain) ?? { ...NO_PICS }, have = cur[r.kind];
    if (!have || r.captured_at > have.at) cur[r.kind] = { src: cropSrc(r.path), width: r.width, height: r.height, at: r.captured_at };
    out.set(r.domain, cur);
  }
  return out;
}
export const picsOf = (index: Map<string, BrandPics> | Record<string, BrandPics>, domain: string): BrandPics =>
  (index instanceof Map ? index.get(domain) : index[domain]) ?? NO_PICS;
/** Icons for a list of domains: only those that have one (a missing key draws nothing). */
export function iconsFor(index: Map<string, BrandPics>, domains: Iterable<string>): Record<string, Pic> {
  const out: Record<string, Pic> = {};
  for (const d of domains) { const i = index.get(d)?.icon; if (i) out[d] = i; }
  return out;
}
/** Lists reserve the icon's width only when most rows have one; otherwise rows without one sit exactly where they sit today. */
export const reserveIconSpace = (withIcon: number, rows: number) => rows > 0 && withIcon / rows > 0.5;

// COVER -------------------------------------------------------------------------------------------------
export type Cover = { kind: "card" | "hero"; domain: string; src: string; width: number; height: number; at: string; alt: string; what: string; credit: string; live: string; report: string };
/** "Social card published by gopro.com" / "Hero section of gopro.com". */
export const coverWhat = (kind: "card" | "hero", domain: string) => kind === "card" ? `Social card published by ${domain}` : `Hero section of ${domain}`;
/** The brand page cover: the latest social card, else the latest hero crop, else nothing (the page stays as it is). */
export function coverOf(domain: string, pics: BrandPics): Cover | null {
  const kind = pics.card ? "card" : pics.hero ? "hero" : null;
  if (!kind) return null;
  const p = pics[kind]!, what = coverWhat(kind, domain), day = longDay(p.at);
  return { kind, domain, src: p.src, width: p.width, height: p.height, at: p.at, what, credit: `${what} · captured ${day}`,
    alt: `${kind === "card" ? `The ${ASSET_NAME.card} ${domain} publishes` : `${domain} homepage hero`}, captured ${day}`, live: `https://${domain}`, report: reportHref(domain) };
}
/** The cover's box: the stored aspect ratio, never wider than the picture itself (no upscaling), and never taller than `capRem`. */
export function coverBox(width: number, height: number, capRem = 22.5): { aspectRatio: string; width: string } {
  const ratio = width / Math.max(1, height);
  return { aspectRatio: `${width} / ${height}`, width: `min(100%, ${width}px, ${+(capRem * ratio).toFixed(3)}rem, ${+(45 * ratio).toFixed(3)}vh)` };
}

// REVEAL ------------------------------------------------------------------------------------------------
/** The real hero crop a drawn capture can reveal: address, stored size, and the credit read with it. */
export type Reveal = { src: string; width: number; height: number; domain: string; at: string; credit: string; alt: string };
export function revealOf(domain: string, hero: Pic | null | undefined): Reveal | null {
  if (!hero) return null;
  const day = longDay(hero.at);
  return { src: hero.src, width: hero.width, height: hero.height, domain, at: hero.at, credit: `${domain} · captured ${day}`, alt: `${domain} homepage hero, captured ${day}` };
}
/** Accessible-name suffix on a drawing that can show its real capture. */
export const REVEAL_HINT = "A real capture is available: press Enter to show it";
/** The hero crop a drawing of `domain` captured at `at` reveals: the newest version taken by a day after the drawing's capture,
 * else the oldest stored one (the credit always says when it was captured). Null when the brand has no hero crop. */
export function heroRevealFor(crops: CropRow[], domain: string, at: string): Reveal | null {
  const v = versionsOf(crops, domain, "hero");
  if (!v.length) return null;
  const t = Date.parse(at) + 864e5, pick = v.find(c => Date.parse(c.captured_at) <= t) ?? v[v.length - 1]!;
  return revealOf(domain, { src: cropSrc(pick.path), width: pick.width, height: pick.height, at: pick.captured_at });
}
