// 1200×630 share card for a data story, in vibes: pink page, the series number on an ink plate, the question in Big Shoulders,
// the key figure on a yellow card, the drawn mark on pink. Same primitives as the chart card. Pure.
import { fit, wrap, txt, vibesCard, VIBES, D7, D9, T4, CARD_HOST, type Prim } from "../chart/card";
import type { StoryModel } from "./types";
export const DATA_OG_SIZE = { w: 1200, h: 630 } as const;
export function dataStoryOgScene(s: { number: number; slug: string; question: string; key: StoryModel["key"]; template: string }): { w: number; h: number; prims: Prim[] } {
  const { w, h } = DATA_OG_SIZE, pad = 48, inner = w - pad * 2, pin = 24, prims: Prim[] = [{ k: "rect", x: 0, y: 0, w, h, fill: VIBES.bg }];
  const lines = wrap(s.question.toUpperCase(), 44, inner - pin * 2, 3, D9), plateH = 20 + 32 + lines.length * 50 + 24;
  prims.push({ k: "rect", x: pad, y: pad, w: inner, h: plateH, fill: VIBES.plate });
  prims.push(txt(pad + pin, pad + 18, fit(`DATA STORY ${s.number} · ${s.template.toUpperCase()}`, 22, inner - pin * 2, D7), 22, D7, VIBES.bg));
  lines.forEach((line, n) => prims.push(txt(pad + pin, pad + 52 + n * 50, line, 44, D9, VIBES.plateInk)));
  const top = pad + plateH + 32, cardH = Math.min(180, h - top - 96), cardW = Math.min(inner, 640);
  prims.push(...vibesCard(pad, top, cardW, cardH));
  prims.push(txt(pad + 24, top + 16, fit(s.key.n, 96, cardW - 48, D9), 96, D9, VIBES.ink));
  prims.push(txt(pad + 24, top + cardH - 46, fit(s.key.label, 28, cardW - 48, T4), 28, T4, VIBES.ink));
  prims.push({ k: "rect", x: pad, y: h - pad - 22, w: inner, h: 3, fill: VIBES.ink });
  prims.push(txt(pad, h - pad - 4, fit(`${CARD_HOST}/data/${s.slug}`, 22, inner - 140, D7), 22, D7, VIBES.ink));
  prims.push({ k: "mark", x: w - pad, y: h - pad - 8, h: 32, anchor: "end" });
  return { w, h, prims };
}
