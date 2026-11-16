// 1200×630 share card for an issue: masthead, issue No., cover headline and the lead chart. Same primitives as the chart card,
// so the existing SVG serializer and pure-JS rasterizer draw it. Pure.
import { chartPrims, fit, wrap, LIGHT_PALETTE, COLORS, type Prim } from "../chart/card";
import { CARD_HOST } from "../chart/card";
import type { Issue } from "./issue";
import { basisWord } from "../labels";
import { BRAND_NAME } from "../brand";
export const OG_SIZE = { w: 1200, h: 630 } as const;
const P = LIGHT_PALETTE, INK = P[COLORS.ink]!, MUTED = P[COLORS.g500]!, RULE = P[COLORS.rule]!, BG = P[COLORS.bg]!;
export function issueOgScene(i: Pick<Issue, "name" | "number" | "dates" | "cover" | "dataThrough">): { w: number; h: number; prims: Prim[] } {
  const { w, h } = OG_SIZE, pad = 56, inner = w - pad * 2, prims: Prim[] = [{ k: "rect", x: 0, y: 0, w, h, fill: BG }];
  const t = (x: number, y: number, text: string, size: 22 | 28 | 44 | 96, weight: 400 | 600, fill: string, anchor?: "end") => prims.push({ k: "text", x, y, text, size, weight, fill, ...(anchor ? { anchor } : {}) });
  t(pad, pad - 10, fit(i.name.toUpperCase(), 28, inner / 2), 28, 600, INK);
  t(w - pad, pad - 6, fit(`NO. ${i.number} · ${i.dates.label.toUpperCase()}`, 22, inner / 2), 22, 400, MUTED, "end");
  prims.push({ k: "rect", x: pad, y: pad + 34, w: inner, h: 2, fill: INK });
  const lines = wrap(i.cover.headline, 44, inner, 3);
  lines.forEach((line, n) => t(pad, pad + 60 + n * 56, line, 44, 600, INK));
  const lead = i.cover.lead, top = pad + 60 + lines.length * 56 + 18;
  if (lead) t(pad, top, fit(`${lead.name} [${lead.dimension}] · ${basisWord(lead.key)}${lead.stage ? ` · ${lead.stage.toUpperCase()}` : ""}`, 22, inner), 22, 400, MUTED);
  const card = i.cover.card, chartTop = top + 40, chartH = h - chartTop - 70;
  if (card && card.series.length && chartH > 120) prims.push(...chartPrims(card, pad, chartTop, inner, chartH).map(p => recolor(p)));
  prims.push({ k: "rect", x: pad, y: h - pad - 18, w: inner, h: 1, fill: RULE });
  t(pad, h - pad - 4, fit(`${BRAND_NAME} · ${CARD_HOST}/digest${i.dataThrough ? ` · data through ${i.dataThrough}` : ""}`, 22, inner), 22, 400, MUTED);
  return { w, h, prims };
}
function recolor(p: Prim): Prim {
  const c = (x: string) => P[x] ?? x;
  if (p.k === "line") return { ...p, stroke: c(p.stroke) };
  if (p.k === "rect" || p.k === "poly" || p.k === "text") return { ...p, fill: c(p.fill) } as Prim;
  return p;
}
