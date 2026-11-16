// 1200×630 share card for a competitive audit, in vibes: pink page, the title on an ink plate, the domains on a yellow card in
// Big Shoulders, the capture date and the drawn mark. No page data beyond names. Pure.
import { fit, txt, vibesCard, VIBES, D7, D9, CARD_HOST, type Prim } from "../chart/card";
export const AUDIT_OG = { w: 1200, h: 630 } as const;
export function auditOgScene(domains: string[], captured: string | null): { w: number; h: number; prims: Prim[] } {
  const { w, h } = AUDIT_OG, pad = 48, inner = w - pad * 2, pin = 24, prims: Prim[] = [{ k: "rect", x: 0, y: 0, w, h, fill: VIBES.bg }];
  prims.push({ k: "rect", x: pad, y: pad, w: inner, h: 96, fill: VIBES.plate });
  prims.push(txt(pad + pin, pad + 22, "COMPETITIVE AUDIT", 44, D9, VIBES.plateInk));
  const list = domains.slice(0, 6), cols = list.length > 3 ? 2 : 1, cardY = pad + 96 + 32, cardH = h - cardY - 96, colW = (inner - 48 - (cols - 1) * 32) / cols;
  prims.push(...vibesCard(pad, cardY, inner, cardH));
  list.forEach((d, i) => { const c = cols === 2 ? i % 2 : 0, r = cols === 2 ? Math.floor(i / 2) : i; prims.push(txt(pad + 24 + c * (colW + 32), cardY + 28 + r * 78, fit(d, 44, colW, D9), 44, D9, VIBES.ink)); });
  prims.push(txt(pad, h - pad - 48, fit(`${list.length} sites compared on type, color, layout and vibe`, 22, inner - 160, D7), 22, D7, VIBES.ink));
  prims.push({ k: "rect", x: pad, y: h - pad - 22, w: inner, h: 3, fill: VIBES.ink });
  prims.push(txt(pad, h - pad - 4, fit(`${captured ? `Captured ${captured.slice(0, 10)} · ` : ""}${CARD_HOST}/audit`, 22, inner - 140, D7), 22, D7, VIBES.ink));
  prims.push({ k: "mark", x: w - pad, y: h - pad - 8, h: 32, anchor: "end" });
  return { w, h, prims };
}
