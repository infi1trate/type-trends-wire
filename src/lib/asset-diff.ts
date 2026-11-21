// W1b · a brand's site icon or social card as a measured change. Pure; the caller decodes the stored WebPs to RGBA.
// Perceptual measure: each picture is laid on white (icons are often transparent), reduced to a 32×32 colour grid by area averaging
// (so size, aspect, re-encoding and file names don't matter beyond what the eye would see at a glance), and two grids are compared by the
// mean absolute difference per colour channel on a 0–255 scale, and by the largest difference in any of 64 blocks (8×8 of 4×4 cells), so
// a small new element (a mascot in a corner) counts while a re-save never does. Either line crossed = the pictures differ visibly.
import { betweenDays as betweenDates } from "./labels";

export const ASSET_GRID = 32;
/** Calibrated on the stored versions (W1b): re-saves differ by at most 1.7 on average and 0.7 in any block; new pictures by 35+ and 47+. */
export const ASSET_VISIBLE_MEAN = 12, ASSET_VISIBLE_BLOCK = 30;
/** A grid whose colours spread less than this is a blank picture (an empty or fully transparent icon): a capture failure, never a change. */
export const ASSET_BLANK_SPREAD = 2;
/** The previous version must have been seen on at least two captures; the new one on two captures at least this far apart. */
export const ASSET_CONFIRM_HOURS = 6;

/** A 32×32 RGB grid (Float64, 0–255) of the picture laid on white, by area averaging. */
export function assetGrid(rgba: Uint8Array | Uint8ClampedArray, w: number, h: number, n = ASSET_GRID): Float64Array {
  const out = new Float64Array(n * n * 3), weight = new Float64Array(n * n);
  for (let y = 0; y < h; y++) {
    const gy0 = (y * n) / h, gy1 = ((y + 1) * n) / h;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, a = rgba[i + 3]! / 255, px = [0, 1, 2].map(c => rgba[i + c]! * a + 255 * (1 - a));
      const gx0 = (x * n) / w, gx1 = ((x + 1) * n) / w;
      for (let gy = Math.floor(gy0); gy < Math.min(n, Math.ceil(gy1)); gy++) {
        const wy = Math.min(gy1, gy + 1) - Math.max(gy0, gy); if (wy <= 0) continue;
        for (let gx = Math.floor(gx0); gx < Math.min(n, Math.ceil(gx1)); gx++) {
          const wx = Math.min(gx1, gx + 1) - Math.max(gx0, gx); if (wx <= 0) continue;
          const k = gy * n + gx, wt = wx * wy; weight[k] = weight[k]! + wt;
          for (let c = 0; c < 3; c++) out[k * 3 + c] = out[k * 3 + c]! + px[c]! * wt;
        }
      }
    }
  }
  for (let k = 0; k < n * n; k++) for (let c = 0; c < 3; c++) out[k * 3 + c] = out[k * 3 + c]! / (weight[k] || 1);
  return out;
}
/** The grid as stored (one byte per channel, base64) and back. */
export const encodeGrid = (g: Float64Array): string => { let s = ""; for (const v of g) s += String.fromCharCode(Math.max(0, Math.min(255, Math.round(v)))); return btoa(s); };
export const decodeGrid = (b64: string): Float64Array => { const s = atob(b64), g = new Float64Array(s.length); for (let i = 0; i < s.length; i++) g[i] = s.charCodeAt(i); return g; };
/** Standard deviation of the grid's values (0 for one flat colour). */
export function gridSpread(g: Float64Array): number {
  let s = 0, s2 = 0; for (const v of g) { s += v; s2 += v * v; }
  return Math.round(Math.sqrt(Math.max(0, s2 / g.length - (s / g.length) ** 2)) * 10) / 10;
}
export type GridDiff = { mean: number; block: number };
/** Mean absolute channel difference, and the largest mean difference in any 4×4-cell block, one decimal each. */
export function gridDiff(a: Float64Array, b: Float64Array, n = ASSET_GRID): GridDiff {
  let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i]! - b[i]!);
  let block = 0;
  for (let by = 0; by < n; by += 4) for (let bx = 0; bx < n; bx += 4) {
    let t = 0; for (let y = by; y < by + 4; y++) for (let x = bx; x < bx + 4; x++) for (let c = 0; c < 3; c++) { const i = (y * n + x) * 3 + c; t += Math.abs(a[i]! - b[i]!); }
    block = Math.max(block, t / 48);
  }
  return { mean: Math.round((s / a.length) * 10) / 10, block: Math.round(block * 10) / 10 };
}
export const visiblyDiffer = (d: GridDiff) => d.mean >= ASSET_VISIBLE_MEAN || d.block >= ASSET_VISIBLE_BLOCK;

export type AssetVersion = { id: number; domain: string; kind: string; path: string; first_seen_at: string; last_seen_at: string; width: number; height: number };
export type AssetVerdict = "change" | "re-encode" | "waiting" | "alternating" | "blank" | "editorial" | "unmeasured";
export type AssetComparison = {
  domain: string; kind: string; from: AssetVersion; to: AssetVersion; diff: GridDiff | null; verdict: AssetVerdict; reason: string;
  /** The change's dates from its captures: the last capture of the old picture and the first of the new one. */
  between: { old_last: string; new_first: string };
  /** The capture that confirms the change (the new version's latest, at least six hours after its first); null unless a change. */
  confirmed_at: string | null;
};
const H = 36e5;
const twoCaptures = (v: AssetVersion) => Date.parse(v.last_seen_at) > Date.parse(v.first_seen_at);
const spanHours = (v: AssetVersion) => (Date.parse(v.last_seen_at) - Date.parse(v.first_seen_at)) / H;
export type Grid = { grid: Float64Array; spread: number };

/**
 * Every consecutive pair of a brand's versions (per kind, oldest first) with its verdict. A change needs: both pictures measured and not
 * blank, a visible difference, the new picture not a return to an earlier one (and not reverted later: alternating pictures are an A/B
 * test or a cache, like a rotating hero), the old picture seen on at least two captures, and the new one on two captures at least six
 * hours apart. On media sites (`editorial`) the social card follows the lead story, so a new card there is content, not identity.
 */
export function assetComparisons(versions: readonly AssetVersion[], grids: ReadonlyMap<string, Grid>, editorial: ReadonlySet<string> = new Set()): AssetComparison[] {
  const groups = new Map<string, AssetVersion[]>();
  for (const v of versions) { const k = `${v.domain}|${v.kind}`; groups.set(k, [...(groups.get(k) ?? []), v]); }
  const out: AssetComparison[] = [];
  const same = (a: AssetVersion, b: AssetVersion) => { const x = grids.get(a.path), y = grids.get(b.path); return !!x && !!y && !visiblyDiffer(gridDiff(x.grid, y.grid)); };
  for (const g of groups.values()) {
    const sorted = [...g].sort((a, b) => a.first_seen_at.localeCompare(b.first_seen_at) || a.id - b.id);
    for (let i = 1; i < sorted.length; i++) {
      const from = sorted[i - 1]!, to = sorted[i]!, x = grids.get(from.path), y = grids.get(to.path);
      const between = { old_last: from.last_seen_at, new_first: to.first_seen_at }, diff = x && y ? gridDiff(x.grid, y.grid) : null;
      const at = (verdict: AssetVerdict, reason: string, confirmed_at: string | null = null) => out.push({ domain: from.domain, kind: from.kind, from, to, diff, verdict, reason, between, confirmed_at });
      if (!x || !y || !diff) { at("unmeasured", "not measured yet"); continue; }
      if (x.spread < ASSET_BLANK_SPREAD || y.spread < ASSET_BLANK_SPREAD) { at("blank", `the ${y.spread < ASSET_BLANK_SPREAD ? "new" : "earlier"} picture is blank: a capture failure, not a change`); continue; }
      const nums = `${diff.mean} of 255 on average, ${diff.block} in the most changed block`;
      if (!visiblyDiffer(diff)) { at("re-encode", `the same picture saved again (${nums})`); continue; }
      if (sorted.slice(0, i - 1).some(v => same(v, to)) || sorted.slice(i + 1).some(v => same(v, from))) { at("alternating", `back and forth between two pictures (${nums})`); continue; }
      if (from.kind === "card" && editorial.has(from.domain)) { at("editorial", `a media site's card follows its lead story (${nums})`); continue; }
      if (!twoCaptures(from)) { at("waiting", `differs visibly (${nums}); the earlier picture was seen on one capture only`); continue; }
      if (spanHours(to) < ASSET_CONFIRM_HOURS) { at("waiting", `differs visibly (${nums}); the new picture is not yet seen on two captures ${ASSET_CONFIRM_HOURS} hours apart`); continue; }
      at("change", `differs visibly (${nums})`, to.last_seen_at);
    }
  }
  return out;
}
/** "new site icon" / "new social card", dated by its captures ("between 20 and 21 Nov"). */
export const assetChangeWhat = (kind: string) => (kind === "icon" ? "new site icon" : "new social card");
export const assetChangeWhen = (c: Pick<AssetComparison, "between">) => betweenDates(c.between.old_last, c.between.new_first);
