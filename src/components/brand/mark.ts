// The drawn mark, pure: which cut to use at a height, its slab rule, and an SVG string for pages rendered outside React
// (the gate, embeds, share images). The mark is always brand ink, never recoloured, never reversed, never given a shadow.
import { MARK_PATHS } from "./mark.gen";
import type { MarkCut } from "./mark-files";

/** The mark's only colour (brand/tokens: mark.colour). */
export const MARK_INK = "#0A0A0A";
/** Cut thresholds by rendered height in CSS px (brand/README.md, "The mark"). */
export const CUT_MIN_PX = { display: 96, standard: 32, micro: 0 } as const;
export type WordCut = Exclude<MarkCut, "s">;
export const cutFor = (height: number): WordCut => (height >= CUT_MIN_PX.display ? "display" : height >= CUT_MIN_PX.standard ? "standard" : "micro");

/** Where the mark sits. Paper, pink, yellow and green are grounds it sits on directly; on ink or an image it needs its slab. */
export const GROUNDS = ["paper", "pink", "yellow", "green", "ink", "image", "auto"] as const;
export type Ground = (typeof GROUNDS)[number];
/** Slab colours (brand kit): pink on ink, paper over an image. "auto" uses the mode's mark-ground token. */
export const SLAB = { ink: "#FF8FC4", image: "#F1ECE0" } as const;
export const needsSlab = (g: Ground) => g === "ink" || g === "image" || g === "auto";
export const slabFill = (g: Ground): string | null => (g === "ink" ? SLAB.ink : g === "image" ? SLAB.image : g === "auto" ? "var(--tk-mark-ground)" : null);
/** Clear space and slab padding: half the x-height. The x-height is 0.4 of the mark's height (the kit's clear-space file pads 200 on 1000). */
export const X_HEIGHT = 0.4;
export const slabPad = (height: number) => Math.round(height * X_HEIGHT * 0.5 * 10) / 10;

export const markSize = (cut: MarkCut, height: number) => { const p = MARK_PATHS[cut]; return { w: Math.round((p.w / p.h) * height * 10) / 10, h: height }; };

/** The mark as a standalone SVG string (gate page, embeds). `ground` adds the slab when one is needed. */
export function markSvg(height: number, ground: Exclude<Ground, "auto"> = "paper", cut: MarkCut = cutFor(height), label = "slug"): string {
  const p = MARK_PATHS[cut], { w } = markSize(cut, height), fill = slabFill(ground), pad = fill ? slabPad(height) : 0;
  const W = w + pad * 2, H = height + pad * 2, s = height / p.h;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">${fill ? `<rect width="${W}" height="${H}" fill="${fill}"/>` : ""}<path transform="translate(${pad} ${pad}) scale(${s})" d="${p.d}" fill="${MARK_INK}"/></svg>`;
}
