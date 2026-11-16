// One 1200×630 share card for the page types that had none (front page, story, brand, pattern, collection, Morning Line, sector report),
// drawn with the chart-card primitives in vibes: pink page, a kicker and the title on an ink plate, one big figure on a yellow card when
// the page has one, the deck in Newsreader, the address and the drawn mark at the foot. Long titles wrap at words and end in "…" at a word.
import { fit, wrap, txt, vibesCard, VIBES, D7, D9, T4, CARD_HOST, textWidth, type Prim } from "../chart/card";

export const SHARE_SIZE = { w: 1200, h: 630 } as const;
export const SHARE_KINDS = ["front", "story", "brand", "pattern", "collection", "morning", "sector"] as const;
export type ShareKind = (typeof SHARE_KINDS)[number];
export type ShareCard = { kicker: string; title: string; deck?: string | null; figure?: { value: string; label: string } | null; path: string };
const PAD = 48, PIN = 24, TITLE_LINES = 3, DECK_LINES = 2;

export function shareScene(c: ShareCard): { w: number; h: number; prims: Prim[] } {
  const { w, h } = SHARE_SIZE, inner = w - PAD * 2, prims: Prim[] = [{ k: "rect", x: 0, y: 0, w, h, fill: VIBES.bg }];
  const lines = wrap(c.title.toUpperCase(), 44, inner - PIN * 2, TITLE_LINES, D9), plateH = 20 + 32 + lines.length * 50 + 24;
  prims.push({ k: "rect", x: PAD, y: PAD, w: inner, h: plateH, fill: VIBES.plate });
  prims.push(txt(PAD + PIN, PAD + 18, fit(c.kicker.toUpperCase(), 22, inner - PIN * 2, D7), 22, D7, VIBES.bg));
  lines.forEach((line, n) => prims.push(txt(PAD + PIN, PAD + 52 + n * 50, line, 44, D9, VIBES.plateInk)));
  let y = PAD + plateH + 24;
  const foot = h - PAD - 22;
  if (c.figure) {
    const cardH = Math.min(150, foot - y - 24), value = fit(c.figure.value, 96, 420, D9);
    if (cardH >= 120) {
      prims.push(...vibesCard(PAD, y, inner, cardH));
      prims.push(txt(PAD + 24, y + 14, value, 96, D9, VIBES.ink));
      const vw = textWidth(value, 96, D9);
      const ls = wrap(c.figure.label, 28, inner - vw - 96, 3, T4), top = y + Math.round((cardH - ls.length * 36) / 2) - 4;
      ls.forEach((l, n) => prims.push(txt(PAD + 48 + vw, top + n * 36, l, 28, T4, VIBES.ink)));
      y += cardH + 20;
    }
  }
  if (c.deck) { const room = Math.floor((foot - y - 12) / 36); wrap(c.deck, 28, inner, Math.max(0, Math.min(DECK_LINES, room)), T4).forEach((l, n) => prims.push(txt(PAD, y + n * 36, l, 28, T4, VIBES.ink))); }
  prims.push({ k: "rect", x: PAD, y: foot, w: inner, h: 3, fill: VIBES.ink });
  prims.push(txt(PAD, h - PAD - 4, fit(`${CARD_HOST}${c.path}`, 22, inner - 140, D7), 22, D7, VIBES.ink));
  prims.push({ k: "mark", x: w - PAD, y: h - PAD - 8, h: 32, anchor: "end" });
  return { w, h, prims };
}
/** /share/<kind>/<id>.png → [kind, id] (id decoded; the front page's id is "today"). */
export function parseSharePath(splat: string): { kind: ShareKind; id: string; format: "png" | "svg" } | null {
  const m = /^([a-z]+)\/(.+)\.(png|svg)$/.exec(splat);
  if (!m || !(SHARE_KINDS as readonly string[]).includes(m[1]!)) return null;
  let id: string;
  try { id = decodeURIComponent(m[2]!); } catch { return null; }
  if (!id || id.length > 200) return null;
  return { kind: m[1] as ShareKind, id, format: m[3] as "png" | "svg" };
}
export const sharePath = (kind: ShareKind, id: string) => `/share/${kind}/${encodeURIComponent(id)}.png`;
