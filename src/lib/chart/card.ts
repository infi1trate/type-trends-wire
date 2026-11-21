// Chart of the Week: pure card model + display list. One scene feeds both the SVG and the PNG rasterizer.
import { GLYPH_ADVANCE } from "./glyphs.gen";
import { ascentOf, measureText, type Face, type TextSize, type TextWeight } from "./fonts";
import { alertDisplayTitle, basisWord, label as traitLabel, scopeText, stageName } from "../labels";
import { SITE_HOST } from "../brand";
import { activeTheme, svgTextStyle } from "../theme";
import type { Gumball } from "../theme/contract";
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
const IMG = activeTheme.shared.image, V = IMG.vibes;
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
  | { k: "line"; pts: [number, number][]; stroke: string; width: number; dash?: [number, number]; opacity?: number; /** Drawn as-is: a palette remap never touches it (the chart's ink outline). */ keep?: boolean }
  | { k: "poly"; pts: [number, number][]; fill: string; opacity: number }
  /** Text: `face` defaults to mono (code-like values); display = Big Shoulders (headlines, figures), text = Newsreader (decks). */
  | { k: "text"; x: number; y: number; text: string; size: TextSize; weight: TextWeight; fill: string; anchor?: "start" | "end"; face?: Face }
  /** A gumball (README "Charts"): a round mark lit from the top left (dark rim, base, light highlight), with an ink edge. */
  | { k: "ball"; x: number; y: number; r: number; dark: string; base: string; light: string; edge: string }
  /** The drawn mark (brand/logo/svg): height in px, top-left at x,y (or right-aligned at x with anchor "end"); always brand ink, on a slab over ink. */
  | { k: "mark"; x: number; y: number; h: number; slab?: string; anchor?: "start" | "end" };

export const MAX_JOIN_QUARTERS = 4;
export const qIdx = (q: string) => Number(q.slice(0, 4)) * 4 + Number(q.slice(5)) - 1;
export const qLabel = (i: number) => `${Math.floor(i / 4)}Q${(i % 4) + 1}`;
/** Text metrics: mono by default (fixed advance); pass a face and weight for Big Shoulders or Newsreader (per-glyph advances). */
export type FontSpec = { face?: Face; weight?: TextWeight };
export const textWidth = (text: string, size: number, f: FontSpec = {}) => (f.face && f.face !== "mono" ? measureText(text, size as TextSize, f.weight ?? 400, f.face) : [...text].length * GLYPH_ADVANCE * size);
/** The text, or its longest whole-word prefix with "…" that fits (cut mid-word only when even the first word is too wide). */
export function fit(text: string, size: number, width: number, f: FontSpec = {}) {
  if (textWidth(text, size, f) <= width) return text;
  const words = text.split(/(?<=\s)/);
  for (let n = words.length - 1; n >= 1; n--) { const t = words.slice(0, n).join("").trimEnd().replace(/[\s,;:·–—-]+$/, "") + "…"; if (t.length > 1 && textWidth(t, size, f) <= width) return t; }
  const chars = [...text];
  for (let n = chars.length - 1; n >= 1; n--) { const t = chars.slice(0, n).join("").trimEnd() + "…"; if (textWidth(t, size, f) <= width) return t; }
  return chars[0] + "…";
}
export function wrap(text: string, size: number, width: number, maxLines: number, f: FontSpec = {}) {
  const lines: string[] = []; let cur = "";
  for (const word of text.split(/\s+/).filter(Boolean)) { const next = cur ? `${cur} ${word}` : word; if (textWidth(next, size, f) <= width) cur = next; else { if (cur) lines.push(cur); cur = textWidth(word, size, f) > width ? fit(word, size, width, f) : word; } }
  if (cur) lines.push(cur);
  return lines.length <= maxLines ? lines : [...lines.slice(0, maxLines - 1), fit(lines.slice(maxLines - 1).join(" "), size, width, f)];
}
const pct = (v: number | null, d = 1) => (v == null ? "—" : `${(v * 100).toFixed(d)}%`);
const r1 = (v: number) => Math.round(v * 10) / 10;
export const stageWord = (s: string | null) => stageName(s)?.toUpperCase() ?? "TOO NEW";
/** Render-time display text for a card: label-map name, dimension tag and a ticker-free call line. */
export const cardText = (m: CardModel) => { const l = traitLabel(m.trait); return { name: l.name, dimension: l.dimension, scope: scopeText(m.scope), call: m.origin === "alert" ? alertDisplayTitle(m.call, m.trait) : m.call }; };

/** Share-by-quarter plot primitives (actual series, gap bridges, forecast band). Shared by cards, Digest figures and OG images. */
export function chartPrims(m: Pick<CardModel, "series" | "forecast">, x0: number, y0: number, w: number, h: number, pal: ChartPalette = DARK_CHART): Prim[] {
  return chart(m, x0, y0, w, h, pal);
}
/** Chart colours: the line, band and points (signal), axis text (g500), gap bridges (muted), grid (rule), the line's outline (edge,
 * drawn as-is, never remapped) and the gumball for measured points. */
export type ChartPalette = { signal: string; g500: string; muted: string; rule: string; edge: string | null; ball: Gumball | null; face: Face };
const DARK_CHART: ChartPalette = { signal: COLORS.signal, g500: COLORS.g500, muted: COLORS.muted, rule: COLORS.rule, edge: null, ball: null, face: "mono" };
/** The vibes chart (README "Charts"): a double-stroke line (ink outline, green core), gumballs at the measured points, ink type. */
export const VIBES_CHART: ChartPalette = { signal: V.accent, g500: V.ink, muted: V.ink, rule: V.ink, edge: V.edge, ball: V.ball, face: "display" };
/** The light editorial chart (Digest figures, explainers): the same style on paper. */
export const PAPER_CHART: ChartPalette = { signal: IMG.light.accent, g500: IMG.light.muted, muted: IMG.light.secondary, rule: IMG.light.rule, edge: IMG.light.ink, ball: V.ball, face: "display" };
function chart(m: Pick<CardModel, "series" | "forecast">, x0: number, y0: number, w: number, h: number, pal: ChartPalette = DARK_CHART): Prim[] {
  const COLORS = pal, axisText = (x: number, y: number, text: string, anchor?: "end"): Prim => ({ k: "text", x, y, text, size: 22, weight: pal.face === "display" ? 700 : 400, fill: pal.g500, ...(pal.face === "display" ? { face: "display" as const } : {}), ...(anchor ? { anchor } : {}) });
  const out: Prim[] = [], series = m.series, fc = m.forecast;
  if (!series.length) { out.push(axisText(x0, y0 + h / 2 - 14, "NO USABLE SERIES")); return out; }
  const first = qIdx(series[0]!.q), lastActual = qIdx(series.at(-1)!.q), last = Math.max(lastActual, ...fc.map(f => qIdx(f.q)));
  const maxV = Math.max(0.05, ...series.map(p => p.s), ...fc.map(f => f.hi)) * 1.12;
  const step = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25].find(s => maxV / s <= 5) ?? 0.25, top = Math.ceil(maxV / step) * step;
  const left = x0 + 84, right = x0 + w - 8, bottom = y0 + h - 40, plotTop = y0 + 8;
  const X = (q: number) => r1(left + ((q - first) / Math.max(1, last - first)) * (right - left)), Y = (v: number) => r1(bottom - (v / top) * (bottom - plotTop));
  for (let v = 0; v <= top + 1e-9; v += step) { out.push({ k: "rect", x: left, y: Y(v), w: right - left, h: 1, fill: COLORS.rule }); out.push(axisText(left - 14, Y(v) - 14, `${Math.round(v * 100)}%`, "end")); }
  const years = Math.floor(last / 4) - Math.floor(first / 4) + 1, every = years > 6 ? 2 : 1;
  for (let y = Math.ceil(first / 4); y * 4 <= last; y++) if ((y - Math.ceil(first / 4)) % every === 0) out.push(axisText(X(y * 4), bottom + 10, String(y)));
  out.push({ k: "rect", x: X(lastActual), y: plotTop, w: 1, h: bottom - plotTop, fill: COLORS.rule });
  const nowRight = X(lastActual) + 8 + textWidth("NOW", 22) <= right;
  out.push(axisText(nowRight ? X(lastActual) + 8 : X(lastActual) - 8, plotTop, "NOW", nowRight ? undefined : "end"));
  const anchor: [number, number] = [X(lastActual), Y(series.at(-1)!.s)];
  if (fc.length) {
    out.push({ k: "poly", pts: [anchor, ...fc.map(f => [X(qIdx(f.q)), Y(f.hi)] as [number, number]), ...[...fc].reverse().map(f => [X(qIdx(f.q)), Y(f.lo)] as [number, number])], fill: COLORS.signal, opacity: 0.2 });
    out.push({ k: "line", pts: [anchor, ...fc.map(f => [X(qIdx(f.q)), Y(f.mid)] as [number, number])], stroke: COLORS.signal, width: 3, dash: [10, 8] });
  }
  // Consecutive samples ≤ 4 quarters apart are joined in signal; longer archive gaps get a muted dashed bridge.
  // With an edge colour the line is a double stroke: an ink outline under the coloured core (README "Charts").
  const line = (pts: [number, number][]) => { if (pal.edge) out.push({ k: "line", pts, stroke: pal.edge, width: 10, keep: true }); out.push({ k: "line", pts, stroke: COLORS.signal, width: pal.edge ? 5 : 4 }); };
  let run: [number, number][] = [];
  series.forEach((p, i) => {
    const pt: [number, number] = [X(qIdx(p.q)), Y(p.s)], prev = series[i - 1];
    if (prev && qIdx(p.q) - qIdx(prev.q) > MAX_JOIN_QUARTERS) { if (run.length > 1) line(run); out.push({ k: "line", pts: [run.at(-1)!, pt], stroke: COLORS.muted, width: 2, dash: [4, 8] }); run = []; }
    run.push(pt);
  });
  if (run.length > 1) line(run);
  for (const p of series) out.push(pal.ball ? { k: "ball", x: X(qIdx(p.q)), y: Y(p.s), r: 9, dark: pal.ball.dark, base: pal.ball.base, light: pal.ball.light, edge: pal.edge ?? pal.ball.dark } : { k: "rect", x: X(qIdx(p.q)) - 5, y: Y(p.s) - 5, w: 10, h: 10, fill: COLORS.signal });
  return out;
}
function stats(m: CardModel): [string, string][] {
  return [["SHARE", pct(m.share)], ["MOMENTUM", m.momentum_pts_q == null ? "—" : `${m.momentum_pts_q >= 0 ? "+" : ""}${m.momentum_pts_q.toFixed(2)} PTS/Q`], ["STAGE", stageWord(m.stage)], ["N", m.n == null ? "—" : String(m.n)]];
}
export const footerText = (m: CardModel) => `${CARD_HOST} · data through ${m.data_through ?? "—"} · N=${m.n ?? "—"}`;
const footerLines = (m: CardModel) => [`${CARD_HOST}`, `data through ${m.data_through ?? "—"} · N=${m.n ?? "—"}`];

/** Vibes colours for share images (README "Modes"): pink page, yellow card, ink plate, ink type and edges. */
export const VIBES = { bg: V.bg, ink: V.ink, card: V.card, plate: V.plate, plateInk: V.plateInk, edge: V.edge, accent: V.accent } as const;
/** The yellow card: a hard 6 px ink shadow, a 3 px ink edge, the yellow fill (Card on the vibes page). */
export function vibesCard(x: number, y: number, w: number, h: number): Prim[] {
  return [{ k: "rect", x: x + 6, y: y + 6, w, h, fill: V.edge }, { k: "rect", x, y, w, h, fill: V.edge }, { k: "rect", x: x + 3, y: y + 3, w: w - 6, h: h - 6, fill: V.card }];
}
/** Text helpers in the brand faces: headlines and figures in Big Shoulders, decks in Newsreader, code-like values in mono. */
export const D7 = { face: "display", weight: 700 } as const, D9 = { face: "display", weight: 900 } as const, T4 = { face: "text", weight: 400 } as const;
export type TextPrim = Extract<Prim, { k: "text" }>;
export const txt = (x: number, y: number, text: string, size: TextSize, f: { face: Face; weight: TextWeight }, fill: string, anchor?: "end"): TextPrim => ({ k: "text", x, y, text, size, weight: f.weight, fill, ...(f.face === "mono" ? {} : { face: f.face }), ...(anchor ? { anchor } : {}) });

/** Display list for one card size. Deterministic: same model → same primitives. Vibes: pink page, the name on an ink plate, the
 * call in Newsreader, the chart on a yellow card (double-stroke line, gumballs), the figures in Big Shoulders, the mark on pink. */
export function cardScene(m: CardModel, size: CardSize, opts: { head?: string } = {}): { w: number; h: number; prims: Prim[] } {
  const { w, h } = CARD_SIZES[size], portrait = size === "1080x1350", pad = portrait ? 60 : 48, inner = w - pad * 2;
  const prims: Prim[] = [{ k: "rect", x: 0, y: 0, w, h, fill: V.bg }];
  const t = (x: number, y: number, text: string, sz: TextSize, f: { face: Face; weight: TextWeight }, fill: string, anchor?: "end") => prims.push(txt(x, y, text, sz, f, fill, anchor));
  const head = opts.head ?? `CHART OF THE WEEK · ${m.week}${m.origin === "alert" ? " · BREAKOUT ALERT" : ""}`;
  const tx = cardText(m), pin = 24;
  // The ink plate: kicker, name, the dimension/basis/scope line.
  const nameLines = wrap(tx.name.toUpperCase(), 44, inner - pin * 2, portrait ? 2 : 1, D9), plateH = 40 + 32 + nameLines.length * 50 + 40;
  prims.push({ k: "rect", x: pad, y: pad, w: inner, h: plateH, fill: V.plate });
  t(pad + pin, pad + 20, fit(head, 22, inner - pin * 2, D7), 22, D7, V.bg);
  nameLines.forEach((l, i) => t(pad + pin, pad + 54 + i * 50, l, 44, D9, V.plateInk));
  t(pad + pin, pad + 54 + nameLines.length * 50 + 10, fit(`[${tx.dimension}] · ${basisWord(m.trait)} · ${tx.scope.toUpperCase()}`, 22, inner - pin * 2, D7), 22, D7, V.bg);
  // The call, in Newsreader on the pink page.
  const callTop = pad + plateH + 22, callLines = wrap(tx.call, 28, inner, portrait ? 4 : 2, T4);
  callLines.forEach((line, i) => t(pad, callTop + i * 38, line, 28, T4, V.ink));
  const st = stats(m), below = callTop + callLines.length * 38 + 24;
  if (portrait) {
    st.forEach(([l, v], i) => { const x = pad + (i % 2) * (inner / 2), y = below + Math.floor(i / 2) * 96; t(x, y, l, 22, D7, V.ink); t(x, y + 28, fit(v, 44, inner / 2 - 20, D9), 44, D9, V.ink); });
    const cy = below + 210, ch = h - cy - 160;
    prims.push(...vibesCard(pad, cy, inner, ch), ...chart(m, pad + 20, cy + 20, inner - 40, ch - 40, VIBES_CHART));
  } else {
    const colX = w - pad - 280, cy = below, ch = h - cy - 92;
    prims.push(...vibesCard(pad, cy, colX - pad - 32, ch), ...chart(m, pad + 16, cy + 16, colX - pad - 64, ch - 32, VIBES_CHART));
    st.forEach(([l, v], i) => { const y = cy + (i ? 112 + (i - 1) * 64 : 0); t(colX, y, l, 22, D7, V.ink); if (i) t(colX, y + 26, fit(v, 28, 280, D7), 28, D7, V.ink); else t(colX, y + 24, fit(v, 44, 280, D9), 44, D9, V.ink); });
  }
  // The footer: a 3 px ink rule, the host and data line, the drawn mark directly on pink (no slab: README "The mark", grounds).
  if (portrait) { prims.push({ k: "rect", x: pad, y: h - pad - 74, w: inner, h: 3, fill: V.ink }); footerLines(m).forEach((line, i) => t(pad, h - pad - 58 + i * 30, fit(line, 22, inner - 180, D7), 22, D7, V.ink)); prims.push({ k: "mark", x: w - pad, y: h - pad - 52, h: 44, anchor: "end" }); }
  else { prims.push({ k: "rect", x: pad, y: h - pad - 34, w: inner, h: 3, fill: V.ink }); t(pad, h - pad - 18, fit(footerText(m), 22, inner - 160, D7), 22, D7, V.ink); prims.push({ k: "mark", x: w - pad, y: h - pad - 22, h: 32, anchor: "end" }); }
  return { w, h, prims };
}
const FONTS = activeTheme.shared.fonts;
const attr = (s: string) => s.replace(/"/g, "'");
/** SVG font-family per face (the same stacks the pages use); mono comes from the shared <style>. */
export const FACE_FAMILY: Record<Exclude<Face, "mono">, string> = { display: attr(FONTS.display), text: attr(FONTS.text) };
/** A gumball as polygons, lit from the top left: rim (dark), body (base), highlight (light), with an ink edge. Shared by SVG and PNG. */
export function ballGeom(p: Extract<Prim, { k: "ball" }>) {
  const circle = (cx: number, cy: number, r: number, n = 28) => Array.from({ length: n }, (_, i) => [r1(cx + r * Math.cos((i * 2 * Math.PI) / n)), r1(cy + r * Math.sin((i * 2 * Math.PI) / n))] as [number, number]);
  const e = Math.max(1.5, p.r * 0.18);
  return [
    { pts: circle(p.x, p.y, p.r + e), fill: p.edge },
    { pts: circle(p.x, p.y, p.r), fill: p.dark },
    { pts: circle(p.x - p.r * 0.12, p.y - p.r * 0.12, p.r * 0.82), fill: p.base },
    { pts: circle(p.x - p.r * 0.38, p.y - p.r * 0.38, p.r * 0.26, 16), fill: p.light },
  ];
}
function ballSvg(p: Extract<Prim, { k: "ball" }>, c: (x: string) => string) {
  void c; // gumballs are drawn as-is (their colours are the kit's), never remapped
  return ballGeom(p).map(g => `<path d="M${g.pts.map(q => q.join(",")).join(" L")} Z" fill="${g.fill}"/>`).join("");
}
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** SVG serialization of the scene. Text y is top-of-line; baseline = y + ascent·size, matching the rasterizer. */
/** Serialize primitives. `palette` remaps chrome colors (e.g. a light editorial figure); data colors pass through. */
export function renderPrimsSvg(w: number, h: number, prims: Prim[], o: { label: string; palette?: Partial<Record<string, string>>; style?: string; className?: string }): string {
  const c = (x: string) => o.palette?.[x] ?? x;
  const body = prims.map(p => {
    if (p.k === "rect") return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${c(p.fill)}"${p.opacity != null ? ` fill-opacity="${p.opacity}"` : ""}/>`;
    if (p.k === "poly") return `<path d="M${p.pts.map(q => q.join(",")).join(" L")} Z" fill="${c(p.fill)}" fill-opacity="${p.opacity}"/>`;
    if (p.k === "line") return `<polyline points="${p.pts.map(q => q.join(",")).join(" ")}" fill="none" stroke="${p.keep ? p.stroke : c(p.stroke)}" stroke-width="${p.width}" stroke-linejoin="round" stroke-linecap="round"${p.dash ? ` stroke-dasharray="${p.dash.join(" ")}"` : ""}/>`;
    if (p.k === "mark") { const m = markGeom(p); return `${m.slab ? `<rect x="${m.slab.x}" y="${m.slab.y}" width="${m.slab.w}" height="${m.slab.h}" fill="${m.slab.fill}"/>` : ""}<path transform="translate(${m.x} ${m.y}) scale(${m.s})" d="${m.d}" fill="${MARK_INK}"/>`; }
    if (p.k === "ball") return ballSvg(p, c);
    return `<text x="${p.x}" y="${r1(p.y + ascentOf(p.face) * p.size)}"${p.face && p.face !== "mono" ? ` font-family="${FACE_FAMILY[p.face]}"` : ""} font-size="${p.size}" font-weight="${p.weight}" fill="${c(p.fill)}"${p.anchor === "end" ? ` text-anchor="end"` : ""}>${esc(p.text)}</text>`;
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
/** `palette`: the web figure passes design-system roles (chartkit ROLE_PALETTE, same values in Read); images keep LIGHT_PALETTE. */
export function figureSvg(m: Pick<CardModel, "series" | "forecast">, w: number, h: number, label: string, palette: Record<string, string> = LIGHT_PALETTE): string {
  return renderPrimsSvg(w, h, [{ k: "rect", x: 0, y: 0, w, h, fill: COLORS.bg }, ...chart(m, 0, 8, w, h - 8)], { label, palette, className: "digest-figure" });
}
