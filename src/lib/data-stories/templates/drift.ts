// PALETTE DRIFT: a scope's palette through time, one band per well-covered quarter, from the stored palette colours (real hexes,
// weighted by their share of each first screen). Colours are grouped into named families so "entered / left / stayed" can be read. Pure.
import type { DriftBand, DriftFig, Swatch } from "../types";
import { byQuarter } from "../series";

export const DRIFT = { present: 0.03, absent: 0.01, show: 0.01, maxSwatches: 12, minBrands: 15 } as const;
/** Named hue ranges (degrees, start inclusive): red wraps around 0. */
const HUES: [number, string][] = [[15, "orange"], [45, "yellow"], [70, "green"], [165, "teal"], [195, "blue"], [255, "violet"], [290, "pink"], [345, "red"]];
const hueName = (h: number) => (h < 15 ? "red" : [...HUES].reverse().find(([from]) => h >= from)![1]);
export function hsl(hex: string) {
  const n = parseInt(hex.slice(1), 16), r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}
/** Colour family: neutrals by lightness (white, grey, black), colours by hue and light/dark. */
export function familyOf(hex: string): { id: string; name: string } {
  const { h, s, l } = hsl(hex);
  if (s < 0.15 || l > 0.95 || l < 0.06) return l > 0.85 ? { id: "n-white", name: "White and off-white" } : l < 0.2 ? { id: "n-black", name: "Black and near-black" } : { id: "n-grey", name: "Grey" };
  const hue = hueName(h), tone = l >= 0.5 ? "light" : "dark";
  return { id: `${hue}-${tone}`, name: `${tone === "light" ? "Light" : "Dark"} ${hue}` };
}
export const familyName = (id: string) => (id.startsWith("n-") ? { "n-white": "White and off-white", "n-grey": "Grey", "n-black": "Black and near-black" }[id] ?? id : `${id.endsWith("light") ? "Light" : "Dark"} ${id.split("-")[0]}`);

export type DriftCapture = { domain: string; q: string; palette: { hex: string; share: number }[] };
export type Drift = { fig: DriftFig; entered: Swatch[]; left: Swatch[]; stayed: Swatch[]; first: DriftBand | null; last: DriftBand | null };
export function paletteDrift(o: { title: string; note: string; scope: string; quarters: string[]; captures: DriftCapture[]; minBrands?: number }): Drift {
  const min = o.minBrands ?? DRIFT.minBrands;
  const bands: DriftBand[] = [...o.quarters].sort(byQuarter).flatMap(q => {
    const caps = o.captures.filter(c => c.q === q && c.palette.length);
    if (caps.length < min) return [];
    const w = new Map<string, number>(), best = new Map<string, Map<string, number>>();
    for (const c of caps) for (const p of c.palette) {
      if (!/^#[0-9a-f]{6}$/i.test(p.hex) || !(p.share > 0)) continue;
      const f = familyOf(p.hex).id, hex = p.hex.toUpperCase();
      w.set(f, (w.get(f) ?? 0) + p.share / caps.length);
      const m = best.get(f) ?? new Map<string, number>(); m.set(hex, (m.get(hex) ?? 0) + p.share); best.set(f, m);
    }
    const swatches = [...w].filter(([, v]) => v >= DRIFT.show).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, DRIFT.maxSwatches)
      .map(([id, v]) => ({ id, w: v, hex: [...best.get(id)!].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0] }));
    return [{ q, brands: caps.length, swatches }];
  });
  const first = bands[0] ?? null, last = bands.length > 1 ? bands[bands.length - 1]! : null;
  const wIn = (b: DriftBand | null, id: string) => b?.swatches.find(s => s.id === id)?.w ?? 0;
  const ids = [...new Set([...(first?.swatches ?? []), ...(last?.swatches ?? [])].map(s => s.id))];
  const sw = (b: DriftBand | null, id: string) => b?.swatches.find(s => s.id === id) ?? null;
  const entered = last ? ids.filter(id => wIn(last, id) >= DRIFT.present && wIn(first, id) < DRIFT.absent).map(id => sw(last, id)!) : [];
  const left = last ? ids.filter(id => wIn(first, id) >= DRIFT.present && wIn(last, id) < DRIFT.absent).map(id => sw(first, id)!) : [];
  const stayed = last ? ids.filter(id => wIn(first, id) >= DRIFT.present && wIn(last, id) >= DRIFT.present).map(id => sw(last, id)!) : [];
  return { fig: { kind: "drift", title: o.title, note: o.note, scope: o.scope, bands }, entered, left, stayed, first, last };
}
