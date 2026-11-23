// Brand assets (I1): the brand's own site icon and social share image, sent by the crawler beside section crops. Pure contract,
// checks, paths and display helpers; no I/O. Same picture policy as crops: credit, live-site link, "Report this image", opt-outs.
import { DOMAIN_RE } from "./thumbs";
import { ASSET_SECTIONS, CROP_LIMITS, checkCrop, utcDay, type CropCheck, type CropRefusal } from "./crops";

export const ASSET_KINDS = ASSET_SECTIONS;
export type AssetKind = (typeof ASSET_KINDS)[number];
export const isAssetKind = (s: unknown): s is AssetKind => typeof s === "string" && (ASSET_KINDS as readonly string[]).includes(s);
/** Plain words for each kind (policy text, credits, alt text). */
export const ASSET_NAME: Record<AssetKind, string> = { icon: "site icon", card: "social share image" };

export const ASSET_LIMITS = {
  /** A site icon is between 48 and 256 px on each side. */
  iconMin: 48, iconMax: 256,
  /** A social card follows the crop limits: at most 1280×1600 and 150 KB. */
  maxWidth: CROP_LIMITS.maxWidth, maxHeight: CROP_LIMITS.maxHeight, imageBytes: CROP_LIMITS.imageBytes,
  /** Versions kept per brand + kind. */
  keep: CROP_LIMITS.keep,
} as const;

export type AssetRefusal = CropRefusal | "icon_too_small" | "icon_too_large";
/** The crop checks (real WebP, ≤150 KB, ≤1280×1600, header matches the declared size), plus the icon's 48–256 px rule. */
export function checkAsset(kind: AssetKind, bytes: Uint8Array, declared: { width: number; height: number }): CropCheck | { ok: false; reason: AssetRefusal } {
  if (kind === "icon") {
    if (declared.width < ASSET_LIMITS.iconMin || declared.height < ASSET_LIMITS.iconMin) return { ok: false, reason: "icon_too_small" };
    if (declared.width > ASSET_LIMITS.iconMax || declared.height > ASSET_LIMITS.iconMax) return { ok: false, reason: "icon_too_large" };
  }
  return checkCrop(bytes, declared);
}

/** `assets/<domain>/<kind>/<yyyy-mm-dd>-<first 8 of hash>.webp`: the crops bucket under its own prefix. */
export const assetPath = (domain: string, kind: AssetKind, capturedAt: string, hash: string) => `assets/${domain}/${kind}/${utcDay(capturedAt)}-${hash.slice(0, 8)}.webp`;
import { ASSET_PATH_RE } from "./picture-paths";
export { ASSET_PATH_RE };
export const parseAssetPath = (path: string) => { const m = ASSET_PATH_RE.exec(path); return m && DOMAIN_RE.test(m[1]!) ? { domain: m[1]!, kind: m[2] as AssetKind } : null; };

export type AssetRow = { id?: number; domain: string; kind: AssetKind | string; captured_at: string; first_seen_at: string; last_seen_at: string; path: string; width: number; height: number; bytes: number; hash: string; run_id?: string | null };
