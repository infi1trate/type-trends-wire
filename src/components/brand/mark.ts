// The drawn mark, pure: which cut to use at a height, its slab rule, and an SVG string for pages rendered outside React
// (the gate, embeds, share images). The mark is always brand ink, never recoloured, never reversed, never given a shadow.
import { MARK_PATHS } from "./mark.gen";
import { BRAND_NAME } from "@/lib/brand";
import type { MarkCut } from "./mark-files";
import { BRAND_KIT } from "@/lib/theme";

/** The mark's only colour (brand/tokens: mark.colour). */
export const MARK_INK = BRAND_KIT.color.ink;
/** Cut thresholds by rendered height in CSS px (brand/README.md, "The mark"). */
export const CUT_MIN_PX = { display: 96, standard: 32, micro: 0 } as const;
export type WordCut = Exclude<MarkCut, "s">;
export const cutFor = (height: number): WordCut => (height >= CUT_MIN_PX.display ? "display" : height >= CUT_MIN_PX.standard ? "standard" : "micro");

/** Where the mark sits. Paper, pink, yellow and green are grounds it sits on directly; on ink or an image it needs its slab. */
export const GROUNDS = ["paper", "pink", "yellow", "green", "ink", "image", "auto"] as const;
export type Ground = (typeof GROUNDS)[number];
/** Slab colours (brand kit): pink on ink, paper over an image. "auto" uses the mode's mark-ground token. */
export const SLAB = { ink: BRAND_KIT.color.pink, image: BRAND_KIT.color.paper } as const;
export const needsSlab = (g: Ground) => g === "ink" || g === "image" || g === "auto";
export const slabFill = (g: Ground): string | null => (g === "ink" ? SLAB.ink : g === "image" ? SLAB.image : g === "auto" ? "var(--tk-mark-ground)" : null);
/** Clear space and slab padding: half the x-height. The x-height is 0.4 of the mark's height (the kit's clear-space file pads 200 on 1000). */
export const X_HEIGHT = 0.4;
export const slabPad = (height: number) => Math.round(height * X_HEIGHT * 0.5 * 10) / 10;

export const markSize = (cut: MarkCut, height: number) => { const p = MARK_PATHS[cut]; return { w: Math.round((p.w / p.h) * height * 10) / 10, h: height }; };

/** The mark as a standalone SVG string (gate page, embeds). `ground` adds the slab when one is needed; `letters` draws each letter as
 * its own path (data-letter, --i) so standalone pages can play the arrival. The box is padded by MARK_BLEED so no curve is clipped. */
export function markSvg(height: number, ground: Exclude<Ground, "auto"> = "paper", cut: MarkCut = cutFor(height), label = BRAND_NAME, letters = false): string {
  const p = MARK_PATHS[cut], s = height / p.h, bleed = Math.round(MARK_BLEED * s * 10) / 10, { w } = markSize(cut, height), fill = slabFill(ground), pad = fill ? slabPad(height) : 0;
  const W = Math.round((w + bleed * 2 + pad * 2) * 10) / 10, H = height + pad * 2;
  const paths = letters ? markLetters(cut).map((d, i) => `<path data-letter="${i}" style="--i:${i}" d="${d}" fill="${MARK_INK}"/>`).join("") : `<path d="${p.d}" fill="${MARK_INK}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">${fill ? `<rect width="${W}" height="${H}" fill="${fill}"/>` : ""}<g transform="translate(${pad + bleed} ${pad}) scale(${s})">${paths}</g></svg>`;
}

/** Overhang: the outlined letters reach a few units past the files' viewBox (the s's left curve), so drawings pad the box by this. */
export const MARK_BLEED = 12;
/**
 * The mark split into its letters, left to right, for the arrival (each letter rises and settles after the one before it).
 * A letter is an outer contour plus the counters and slits inside its box; the fused micro cut and the s stay one piece.
 */
export function markLetters(cut: MarkCut): string[] {
  const subs = MARK_PATHS[cut].d.match(/M[^M]*/g) ?? [];
  const box = (d: string) => { const n = [...d.matchAll(/(-?[\d.]+)[ ,](-?[\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])] as const); const xs = n.map(p => p[0]), ys = n.map(p => p[1]); return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), d }; };
  const all = subs.map(box), area = (b: ReturnType<typeof box>) => (b.x1 - b.x0) * (b.y1 - b.y0);
  const inside = (a: ReturnType<typeof box>, b: ReturnType<typeof box>) => a !== b && a.x0 >= b.x0 && a.x1 <= b.x1 && a.y0 >= b.y0 && a.y1 <= b.y1 && area(a) < area(b);
  const outers = all.filter(a => !all.some(b => inside(a, b)));
  return outers.sort((a, b) => a.x0 - b.x0).map(o => [o.d, ...all.filter(a => inside(a, o)).map(a => a.d)].join(""));
}
