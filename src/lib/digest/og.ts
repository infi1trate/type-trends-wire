// 1200×630 share card for an issue, in vibes (README "Modes"): pink page, the masthead and headline on an ink plate, the lead chart on
// a yellow card (double-stroke line, gumballs), Big Shoulders for the headline and figures, the drawn mark on pink. Same primitives
// as the chart card, so the existing SVG serializer and pure-JS rasterizer draw it. Pure.
import { chartPrims, fit, wrap, txt, vibesCard, VIBES, VIBES_CHART, D7, D9, CARD_HOST, type Prim } from "../chart/card";
import type { Issue } from "./issue";
import { basisWord } from "../labels";
export const OG_SIZE = { w: 1200, h: 630 } as const;
export function issueOgScene(i: Pick<Issue, "name" | "number" | "dates" | "cover" | "dataThrough">): { w: number; h: number; prims: Prim[] } {
  const { w, h } = OG_SIZE, pad = 48, inner = w - pad * 2, pin = 24, prims: Prim[] = [{ k: "rect", x: 0, y: 0, w, h, fill: VIBES.bg }];
  const lines = wrap(i.cover.headline.toUpperCase(), 44, inner - pin * 2, 2, D9), plateH = 20 + 32 + lines.length * 50 + 24;
  prims.push({ k: "rect", x: pad, y: pad, w: inner, h: plateH, fill: VIBES.plate });
  prims.push(txt(pad + pin, pad + 18, fit(i.name.toUpperCase(), 22, inner / 2, D7), 22, D7, VIBES.bg));
  prims.push(txt(w - pad - pin, pad + 18, fit(`NO. ${i.number} · ${i.dates.label.toUpperCase()}`, 22, inner / 2 - pin, D7), 22, D7, VIBES.bg, "end"));
  lines.forEach((line, n) => prims.push(txt(pad + pin, pad + 52 + n * 50, line, 44, D9, VIBES.plateInk)));
  const lead = i.cover.lead, top = pad + plateH + 18;
  if (lead) prims.push(txt(pad, top, fit(`${lead.name} [${lead.dimension}] · ${basisWord(lead.key)}${lead.stage ? ` · ${lead.stage.toUpperCase()}` : ""}`, 22, inner, D7), 22, D7, VIBES.ink));
  const card = i.cover.card, chartTop = top + 40, chartH = h - chartTop - 76;
  if (card && card.series.length && chartH > 120) prims.push(...vibesCard(pad, chartTop, inner, chartH), ...chartPrims(card, pad + 16, chartTop + 12, inner - 32, chartH - 24, VIBES_CHART));
  prims.push({ k: "rect", x: pad, y: h - pad - 22, w: inner, h: 3, fill: VIBES.ink });
  prims.push(txt(pad, h - pad - 4, fit(`${CARD_HOST}/digest${i.dataThrough ? ` · data through ${i.dataThrough}` : ""}`, 22, inner - 140, D7), 22, D7, VIBES.ink));
  prims.push({ k: "mark", x: w - pad, y: h - pad - 8, h: 32, anchor: "end" });
  return { w, h, prims };
}
