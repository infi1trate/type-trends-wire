// PALETTE DRIFT: a scope's palette through time, one band per well-covered quarter, from the stored palette colours (real hexes,
// weighted by their share of each first screen). Colours are grouped into named families so "entered / left / stayed" can be read. Pure.
import type { DriftBand, DriftFig, Swatch } from "../types";
import { byQuarter } from "../series";
import { familyOf } from "../../colour-family";

export const DRIFT = { present: 0.03, absent: 0.01, show: 0.01, maxSwatches: 12, minBrands: 15 } as const;
// W3b · the colour families live in one pure module so the museum comparison counts "one colour" exactly as these strips draw it.
export { hsl, familyOf, familyName } from "../../colour-family";

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
