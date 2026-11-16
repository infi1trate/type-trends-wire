// 1200×630 share card for a competitive audit: masthead, the domains and the capture date. No page data beyond names. Pure.
import { fit, LIGHT_PALETTE, COLORS, CARD_HOST, type Prim } from "../chart/card";
import { BRAND_NAME } from "../brand";
export const AUDIT_OG = { w: 1200, h: 630 } as const;
const P = LIGHT_PALETTE, INK = P[COLORS.ink]!, MUTED = P[COLORS.g500]!, RULE = P[COLORS.rule]!, BG = P[COLORS.bg]!;
export function auditOgScene(domains: string[], captured: string | null): { w: number; h: number; prims: Prim[] } {
  const { w, h } = AUDIT_OG, pad = 56, inner = w - pad * 2, prims: Prim[] = [{ k: "rect", x: 0, y: 0, w, h, fill: BG }];
  const t = (x: number, y: number, text: string, size: 22 | 28 | 44 | 96, weight: 400 | 600, fill: string, anchor?: "end") => prims.push({ k: "text", x, y, text, size, weight, fill, ...(anchor ? { anchor } : {}) });
  t(pad, pad - 10, "COMPETITIVE AUDIT", 28, 600, INK);
  t(w - pad, pad - 6, `${BRAND_NAME}`, 22, 400, MUTED, "end");
  prims.push({ k: "rect", x: pad, y: pad + 34, w: inner, h: 2, fill: INK });
  const list = domains.slice(0, 6), cols = list.length > 3 ? 2 : 1, colW = (inner - (cols - 1) * 32) / cols;
  list.forEach((d, i) => { const c = cols === 2 ? i % 2 : 0, r = cols === 2 ? Math.floor(i / 2) : i; t(pad + c * (colW + 32), pad + 120 + r * 92, fit(d, 44, colW), 44, 600, INK); });
  t(pad, h - pad - 52, fit(`${list.length} sites compared on type, color, layout and vibe`, 22, inner), 22, 400, MUTED);
  prims.push({ k: "rect", x: pad, y: h - pad - 18, w: inner, h: 1, fill: RULE });
  t(pad, h - pad - 4, fit(`${captured ? `Captured ${captured.slice(0, 10)} · ` : ""}${CARD_HOST}/audit`, 22, inner), 22, 400, MUTED);
  return { w, h, prims };
}
