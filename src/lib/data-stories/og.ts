// 1200×630 share card for a data story: the series number, the question, the key figure and the product name. Same primitives as the
// chart card, so the existing SVG serializer and pure-JS rasterizer draw it. Pure.
import { fit, wrap, LIGHT_PALETTE, COLORS, CARD_HOST, type Prim } from "../chart/card";
import { BRAND_NAME } from "../brand";
import type { StoryModel } from "./types";
export const DATA_OG_SIZE = { w: 1200, h: 630 } as const;
const P = LIGHT_PALETTE, INK = P[COLORS.ink]!, MUTED = P[COLORS.g500]!, RULE = P[COLORS.rule]!, BG = P[COLORS.bg]!;
export function dataStoryOgScene(s: { number: number; slug: string; question: string; key: StoryModel["key"]; template: string }): { w: number; h: number; prims: Prim[] } {
  const { w, h } = DATA_OG_SIZE, pad = 56, inner = w - pad * 2, prims: Prim[] = [{ k: "rect", x: 0, y: 0, w, h, fill: BG }];
  const t = (x: number, y: number, text: string, size: 22 | 28 | 44 | 96, weight: 400 | 600, fill: string, anchor?: "end") => prims.push({ k: "text", x, y, text, size, weight, fill, ...(anchor ? { anchor } : {}) });
  t(pad, pad - 10, fit(BRAND_NAME, 28, inner / 2), 28, 600, INK);
  t(w - pad, pad - 6, fit(`DATA STORY ${s.number} · ${s.template.toUpperCase()}`, 22, inner * 0.6), 22, 400, MUTED, "end");
  prims.push({ k: "rect", x: pad, y: pad + 34, w: inner, h: 2, fill: INK });
  const lines = wrap(s.question, 44, inner, 3);
  lines.forEach((line, n) => t(pad, pad + 76 + n * 56, line, 44, 600, INK));
  const top = pad + 76 + lines.length * 56 + 40;
  t(pad, top + 70, fit(s.key.n, 96, inner), 96, 600, INK);
  t(pad, top + 112, fit(s.key.label, 22, inner), 22, 400, MUTED);
  prims.push({ k: "rect", x: pad, y: h - pad - 18, w: inner, h: 1, fill: RULE });
  t(pad, h - pad - 4, fit(`${BRAND_NAME} · ${CARD_HOST}/data/${s.slug}`, 22, inner), 22, 400, MUTED);
  return { w, h, prims };
}
