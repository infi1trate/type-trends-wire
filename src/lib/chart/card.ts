// Chart of the Week: pure card model + display list. One scene feeds both the SVG and the PNG rasterizer.
import { GLYPH_ADVANCE, GLYPH_ASCENT } from "./glyphs.gen";
import { alertDisplayTitle, basisWord, label as traitLabel, scopeText, stageName } from "../labels";
import { SITE_HOST } from "../brand";
import { activeTheme, svgTextStyle } from "../theme";
import { MARK_PATHS } from "@/components/brand/mark.gen";
import { MARK_INK, SLAB, cutFor, slabPad } from "@/components/brand/mark";
const MARK_SLAB = SLAB.ink;
/** Where a mark primitive lands: its cut, scale, top-left and optional slab rectangle. Shared by the SVG serializer and the rasterizer. */
export function markGeom(p: Extract<Prim, { k: "mark" }>) {
  const g = MARK_PATHS[cutFor(p.h)], s = p.h / g.h, w = g.w * s, pad = p.slab ? slabPad(p.h) : 0, x = (p.anchor === "end" ? p.x - w - pad : p.x + pad), y = p.y + pad;
  return { d: g.d, s, x, y, w, slab: p.slab ? { x: x - pad, y: y - pad, w: w + pad * 2, h: p.h + pad * 2, fill: p.slab } : null };
}
export const CARD_SIZES = { "1200x675": { w: 1200, h: 675 }, "1080x1350": { w: 1080, h: 1350 } } as const;
export type CardSize = keyof typeof CARD_SIZES;
const IMG = activeTheme.shared.image;
/** Card colours come from the theme's image palette (PNG cards cannot read CSS variables). */
export const COLORS = { bg: IMG.dark.bg, rule: IMG.dark.rule, g500: IMG.dark.muted, muted: IMG.dark.secondary, ink: IMG.dark.ink, signal: IMG.dark.accent } as const;
export const CARD_HOST = SITE_HOST;
export type CardPoint = { q: string; s: number; n: number };
export type CardModel = {
  /** `ticker` only exists on cards stored before labels; names are always computed from `trait` at render time. */
  week: string; run_id: number; origin: "call" | "alert"; trait: string; scope: string; ticker?: string; label?: string;
  stage: string | null; momentum_pts_q: number | null; share: number | null; n: number | null; call: string; data_through: string | null;
  series: CardPoint[]; forecast: { q: string; mid: number; lo: number; hi: number }[]; source_ref: string; forecast_run?: number | null;
};
export type Prim =
  | { k: "rect"; x: number; y: number; w: number; h: number; fill: string; opacity?: number }
  | { k: "line"; pts: [number, number][]; stroke: string; width: number; dash?: [number, number]; opacity?: number }
  | { k: "poly"; pts: [number, number][]; fill: string; opacity: number }
  | { k: "text"; x: number; y: number; text: string; size: 22 | 28 | 44 | 96; weight: 400 | 600; fill: string; anchor?: "start" | "end" }
  /** The drawn mark (brand/logo/svg): height in px, top-left at x,y (or right-aligned at x with anchor "end"); always brand ink, on a slab over ink. */
  | { k: "mark"; x: number; y: number; h: number; slab?: string; anchor?: "start" | "end" };

export const MAX_JOIN_QUARTERS = 4;
export const qIdx = (q: string) => Number(q.slice(0, 4)) * 4 + Number(q.slice(5)) - 1;
export const qLabel = (i: number) => `${Math.floor(i / 4)}Q${(i % 4) + 1}`;
export const textWidth = (text: string, size: number) => [...text].length * GLYPH_ADVANCE * size;
export function fit(text: string, size: number, width: number) { const max = Math.floor(width / (GLYPH_ADVANCE * size)), chars = [...text]; return chars.length <= max ? text : chars.slice(0, Math.max(1, max - 1)).join("") + "…"; }
export function wrap(text: string, size: number, width: number, maxLines: number) {
  const max = Math.floor(width / (GLYPH_ADVANCE * size)), lines: string[] = []; let cur = "";
  for (const word of text.split(/\s+/).filter(Boolean)) { const next = cur ? `${cur} ${word}` : word; if ([...next].length <= max) cur = next; else { if (cur) lines.push(cur); cur = [...word].length > max ? fit(word, size, width) : word; } }
  if (cur) lines.push(cur);
  return lines.length <= maxLines ? lines : [...lines.slice(0, maxLines - 1), fit(lines.slice(maxLines - 1).join(" "), size, width)];
}
const pct = (v: number | null, d = 1) => (v == null ? "—" : `${(v * 100).toFixed(d)}%`);
const r1 = (v: number) => Math.round(v * 10) / 10;
export const stageWord = (s: string | null) => stageName(s)?.toUpperCase() ?? "TOO NEW";
/** Render-time display text for a card: label-map name, dimension tag and a ticker-free call line. */
export const cardText = (m: CardModel) => { const l = traitLabel(m.trait); return { name: l.name, dimension: l.dimension, scope: scopeText(m.scope), call: m.origin === "alert" ? alertDisplayTitle(m.call, m.trait) : m.call }; };

/** Share-by-quarter plot primitives (actual series, gap bridges, forecast band). Shared by cards, Digest figures and OG images. */
export function chartPrims(m: Pick<CardModel, "series" | "forecast">, x0: number, y0: number, w: number, h: number): Prim[] {
  return chart(m, x0, y0, w, h);
}
function chart(m: Pick<CardModel, "series" | "forecast">, x0: number, y0: number, w: number, h: number): Prim[] {
  const out: Prim[] = [], series = m.series, fc = m.forecast;
  if (!series.length) { out.push({ k: "text", x: x0, y: y0 + h / 2 - 14, text: "NO USABLE SERIES", size: 22, weight: 400, fill: COLORS.g500 }); return out; }
  const first = qIdx(series[0]!.q), lastActual = qIdx(series.at(-1)!.q), last = Math.max(lastActual, ...fc.map(f => qIdx(f.q)));
  const maxV = Math.max(0.05, ...series.map(p => p.s), ...fc.map(f => f.hi)) * 1.12;
  const step = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25].find(s => maxV / s <= 5) ?? 0.25, top = Math.ceil(maxV / step) * step;
  const left = x0 + 84, right = x0 + w - 8, bottom = y0 + h - 40, plotTop = y0 + 8;
  const X = (q: number) => r1(left + ((q - first) / Math.max(1, last - first)) * (right - left)), Y = (v: number) => r1(bottom - (v / top) * (bottom - plotTop));
  for (let v = 0; v <= top + 1e-9; v += step) { out.push({ k: "rect", x: left, y: Y(v), w: right - left, h: 1, fill: COLORS.rule }); out.push({ k: "text", x: left - 14, y: Y(v) - 14, text: `${Math.round(v * 100)}%`, size: 22, weight: 400, fill: COLORS.g500, anchor: "end" }); }
  const years = Math.floor(last / 4) - Math.floor(first / 4) + 1, every = years > 6 ? 2 : 1;
  for (let y = Math.ceil(first / 4); y * 4 <= last; y++) if ((y - Math.ceil(first / 4)) % every === 0) out.push({ k: "text", x: X(y * 4), y: bottom + 10, text: String(y), size: 22, weight: 400, fill: COLORS.g500 });
  out.push({ k: "rect", x: X(lastActual), y: plotTop, w: 1, h: bottom - plotTop, fill: COLORS.rule });
  const nowRight = X(lastActual) + 8 + textWidth("NOW", 22) <= right;
  out.push({ k: "text", x: nowRight ? X(lastActual) + 8 : X(lastActual) - 8, y: plotTop, text: "NOW", size: 22, weight: 400, fill: COLORS.g500, ...(nowRight ? {} : { anchor: "end" as const }) });
  const anchor: [number, number] = [X(lastActual), Y(series.at(-1)!.s)];
  if (fc.length) {
    out.push({ k: "poly", pts: [anchor, ...fc.map(f => [X(qIdx(f.q)), Y(f.hi)] as [number, number]), ...[...fc].reverse().map(f => [X(qIdx(f.q)), Y(f.lo)] as [number, number])], fill: COLORS.signal, opacity: 0.2 });
    out.push({ k: "line", pts: [anchor, ...fc.map(f => [X(qIdx(f.q)), Y(f.mid)] as [number, number])], stroke: COLORS.signal, width: 3, dash: [10, 8] });
  }
  // Consecutive samples ≤ 4 quarters apart are joined in signal; longer archive gaps get a muted dashed bridge.
  let run: [number, number][] = [];
  series.forEach((p, i) => {
    const pt: [number, number] = [X(qIdx(p.q)), Y(p.s)], prev = series[i - 1];
    if (prev && qIdx(p.q) - qIdx(prev.q) > MAX_JOIN_QUARTERS) { if (run.length > 1) out.push({ k: "line", pts: run, stroke: COLORS.signal, width: 4 }); out.push({ k: "line", pts: [run.at(-1)!, pt], stroke: COLORS.muted, width: 2, dash: [4, 8] }); run = []; }
    run.push(pt);
  });
  if (run.length > 1) out.push({ k: "line", pts: run, stroke: COLORS.signal, width: 4 });
  for (const p of series) out.push({ k: "rect", x: X(qIdx(p.q)) - 5, y: Y(p.s) - 5, w: 10, h: 10, fill: COLORS.signal });
  return out;
}
function stats(m: CardModel): [string, string][] {
  return [["SHARE", pct(m.share)], ["MOMENTUM", m.momentum_pts_q == null ? "—" : `${m.momentum_pts_q >= 0 ? "+" : ""}${m.momentum_pts_q.toFixed(2)} PTS/Q`], ["STAGE", stageWord(m.stage)], ["N", m.n == null ? "—" : String(m.n)]];
}
export const footerText = (m: CardModel) => `${CARD_HOST} · data through ${m.data_through ?? "—"} · N=${m.n ?? "—"}`;
const footerLines = (m: CardModel) => [`${CARD_HOST}`, `data through ${m.data_through ?? "—"} · N=${m.n ?? "—"}`];

/** Display list for one card size. Deterministic: same model → same primitives. */
export function cardScene(m: CardModel, size: CardSize, opts: { head?: string } = {}): { w: number; h: number; prims: Prim[] } {
  const { w, h } = CARD_SIZES[size], portrait = size === "1080x1350", pad = portrait ? 60 : 48, inner = w - pad * 2;
  const prims: Prim[] = [{ k: "rect", x: 0, y: 0, w, h, fill: COLORS.bg }];
  const t = (x: number, y: number, text: string, sz: 22 | 28 | 44 | 96, weight: 400 | 600, fill: string, anchor?: "end") => prims.push({ k: "text", x, y, text, size: sz, weight, fill, ...(anchor ? { anchor } : {}) });
  const head = opts.head ?? `CHART OF THE WEEK · ${m.week}${m.origin === "alert" ? " · BREAKOUT ALERT" : ""}`;
  t(pad, pad - 8, fit(head, 22, inner), 22, 400, COLORS.g500);
  const txt = cardText(m);
  t(pad, pad + 24, fit(txt.name, 44, inner), 44, 600, COLORS.ink);
  t(pad, pad + 80, fit(`[${txt.dimension}] · ${basisWord(m.trait)} · ${txt.scope.toUpperCase()}`, 22, inner), 22, 400, COLORS.muted);
  const callLines = wrap(txt.call, 28, inner, portrait ? 4 : 2);
  callLines.forEach((line, i) => t(pad, pad + 124 + i * 38, line, 28, 400, COLORS.ink));
  const st = stats(m);
  if (portrait) {
    const sy = pad + 124 + callLines.length * 38 + 48;
    st.forEach(([l, v], i) => { const x = pad + (i % 2) * (inner / 2), y = sy + Math.floor(i / 2) * 96; t(x, y, l, 22, 400, COLORS.g500); t(x, y + 30, fit(v, 44, inner / 2 - 20), 44, 600, COLORS.ink); });
    prims.push(...chart(m, pad, sy + 220, inner, h - (sy + 220) - 150));
  } else {
    const cy = pad + 124 + 2 * 38 + 28, colX = w - pad - 300;
    prims.push(...chart(m, pad, cy, colX - pad - 40, h - cy - 96));
    st.forEach(([l, v], i) => { const y = cy + (i ? 82 + (i - 1) * 64 : 0); t(colX, y, l, 22, 400, COLORS.g500); if (i) t(colX, y + 28, fit(v, 28, 300), 28, 600, COLORS.ink); else t(colX, y + 28, fit(v, 44, 300), 44, 600, COLORS.ink); });
  }
  // The drawn mark sits bottom-right on its pink slab (the card is ink); the footer text keeps the host and the data line.
  if (portrait) { prims.push({ k: "rect", x: pad, y: h - pad - 74, w: inner, h: 1, fill: COLORS.rule }); footerLines(m).forEach((line, i) => t(pad, h - pad - 58 + i * 30, fit(line, 22, inner - 160), 22, 400, COLORS.g500)); prims.push({ k: "mark", x: w - pad, y: h - pad - 52, h: 36, slab: MARK_SLAB, anchor: "end" }); }
  else { prims.push({ k: "rect", x: pad, y: h - pad - 34, w: inner, h: 1, fill: COLORS.rule }); t(pad, h - pad - 18, fit(footerText(m), 22, inner - 140), 22, 400, COLORS.g500); prims.push({ k: "mark", x: w - pad, y: h - pad - 20, h: 24, slab: MARK_SLAB, anchor: "end" }); }
  return { w, h, prims };
}
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** SVG serialization of the scene. Text y is top-of-line; baseline = y + ascent·size, matching the rasterizer. */
/** Serialize primitives. `palette` remaps chrome colors (e.g. a light editorial figure); data colors pass through. */
export function renderPrimsSvg(w: number, h: number, prims: Prim[], o: { label: string; palette?: Partial<Record<string, string>>; style?: string; className?: string }): string {
  const c = (x: string) => o.palette?.[x] ?? x;
  const body = prims.map(p => {
    if (p.k === "rect") return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${c(p.fill)}"${p.opacity != null ? ` fill-opacity="${p.opacity}"` : ""}/>`;
    if (p.k === "poly") return `<path d="M${p.pts.map(q => q.join(",")).join(" L")} Z" fill="${c(p.fill)}" fill-opacity="${p.opacity}"/>`;
    if (p.k === "line") return `<polyline points="${p.pts.map(q => q.join(",")).join(" ")}" fill="none" stroke="${c(p.stroke)}" stroke-width="${p.width}" stroke-linejoin="round" stroke-linecap="round"${p.dash ? ` stroke-dasharray="${p.dash.join(" ")}"` : ""}/>`;
    if (p.k === "mark") { const m = markGeom(p); return `${m.slab ? `<rect x="${m.slab.x}" y="${m.slab.y}" width="${m.slab.w}" height="${m.slab.h}" fill="${m.slab.fill}"/>` : ""}<path transform="translate(${m.x} ${m.y}) scale(${m.s})" d="${m.d}" fill="${MARK_INK}"/>`; }
    return `<text x="${p.x}" y="${r1(p.y + GLYPH_ASCENT * p.size)}" font-size="${p.size}" font-weight="${p.weight}" fill="${c(p.fill)}"${p.anchor === "end" ? ` text-anchor="end"` : ""}>${esc(p.text)}</text>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg"${o.className ? ` class="${o.className}"` : ""} width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(o.label)}">${o.style ? `<style>${o.style}</style>` : ""}${body}</svg>`;
}
/** SVG serialization of the scene. Text y is top-of-line; baseline = y + ascent·size, matching the rasterizer. */
export function renderCardSvg(m: CardModel, size: CardSize): string {
  const { w, h, prims } = cardScene(m, size);
  return renderPrimsSvg(w, h, prims, { label: `${cardText(m).name} share by quarter with forecast band. ${cardText(m).call}`, style: svgTextStyle() });
}
/** Light chrome for editorial pages; the data line and band take the light image accent (yellow on ink becomes green on paper). */
export const LIGHT_PALETTE: Record<string, string> = { [COLORS.bg]: IMG.light.bg, [COLORS.rule]: IMG.light.rule, [COLORS.g500]: IMG.light.muted, [COLORS.muted]: IMG.light.secondary, [COLORS.ink]: IMG.light.ink, [COLORS.signal]: IMG.light.accent };
/** Chart-only figure (no card chrome) for Digest and explainer pages. */
export function figureSvg(m: Pick<CardModel, "series" | "forecast">, w: number, h: number, label: string): string {
  return renderPrimsSvg(w, h, [{ k: "rect", x: 0, y: 0, w, h, fill: COLORS.bg }, ...chart(m, 0, 8, w, h - 8)], { label, palette: LIGHT_PALETTE, className: "digest-figure" });
}
