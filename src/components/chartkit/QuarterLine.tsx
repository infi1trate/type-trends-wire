// THE CHART KIT (U3) · line by quarter. One component, two looks, the same quarter axis and tokens:
//  · Read, framed: one or more series by quarter in a ChartFrame (the front page's chart of the day, the kit).
//  · Read, figure: the share of tracked homepages by quarter with its forecast band, drawn from the pure chart-card model the share
//    images use (lib/chart/card.ts), so the page and the PNG cannot differ; archive gaps longer than a year are a muted dashed bridge
//    ("spans several years"), measured points are solid, the forecast band is the AI-free projection.
//  · Data: the terminal's dense line with its projection cone, fitted line, backtest and sector lines (the Forecast panel).
// Every look ships its data table for screen readers; numbers and quarters are formatted by labels.ts.
import type { ReactNode } from "react";
import { useId } from "react";
import { figureSvg, type CardModel } from "@/lib/chart/card";
import { extent, linear, ticks } from "@/lib/charts/scale";
import { line as voiced } from "@/lib/voice";
import { BASIS_WORD, pctText, quarterText, type Basis } from "@/lib/labels";
import type { GumballName } from "@/lib/theme/contract";
import { Axis, ChartFrame, Gumball, GumballDefs, Mark, W, ballId, type FrameProps } from "./Frame";
import { ChartTable } from "./ChartTable";
import { ROLE_PALETTE, lw, pt } from "./ink";
export type Look = "read" | "data";

const pct = (v: number | null | undefined, d = 1) => (v == null ? "not measured" : d === 1 ? pctText(v) : `${(v * 100).toFixed(d)}%`);
const qi = (q: string) => Number(q.slice(0, 4)) * 4 + Number(q.slice(5)) - 1;
const ql = (i: number) => `${Math.floor(i / 4)}Q${(i % 4) + 1}`;

export type LineSeries = { id: string; label: string; points: { x: string; y: number }[] };
/** Series colours, in order: green (rising, measured), pink, yellow, red. Each line sits on an ink-and-paper double stroke. */
const SERIES_BALL: GumballName[] = ["green", "pink", "yellow", "red"];
function FramedLine({ series, y, ...frame }: FrameProps & { series: LineSeries[]; y: { label: string; format: (v: number) => string } }) {
  const gid = ballId(useId());
  const H = 260, m = { l: 40, r: 124, t: 14, b: 34 };
  const xs = [...new Set(series.flatMap(s => s.points.map(p => p.x)))].sort(), dy = extent(series.flatMap(s => s.points.map(p => p.y)));
  const sx = (q: string) => (xs.length < 2 ? (m.l + W - m.r) / 2 : m.l + (xs.indexOf(q) / (xs.length - 1)) * (W - m.r - m.l)), sy = linear(dy, [H - m.b, m.t]);
  const empty = !series.some(s => s.points.length);
  return <ChartFrame {...frame} isEmpty={empty} table={{ columns: ["Quarter", ...series.map(s => s.label)], rows: xs.map(q => [q, ...series.map(s => { const p = s.points.find(v => v.x === q); return p ? y.format(p.y) : "—"; })]) }}>
    {ids => <svg viewBox={`0 0 ${W} ${H}`} className="tk-svg" role="group" aria-labelledby={ids.title} aria-describedby={ids.note}>
      <GumballDefs id={gid} />
      {ticks(dy[0], dy[1], 4).map(t => <g key={t} aria-hidden="true"><line x1={m.l} x2={W - m.r} y1={sy(t)} y2={sy(t)} className="tk-svg-grid" /><text x={m.l - 6} y={sy(t) + 4} textAnchor="end" className="tk-svg-text tk-svg-muted">{y.format(t)}</text></g>)}
      <Axis y0={H - m.b} x0={m.l} x1={W - m.r} />
      {xs.map((q, i) => (i === 0 || i === xs.length - 1 || i % Math.ceil(xs.length / 4) === 0) && <text key={q} x={sx(q)} y={H - m.b + 16} textAnchor="middle" className="tk-svg-text tk-svg-muted" aria-hidden="true">{q}</text>)}
      {series.map((s, i) => { const ball = SERIES_BALL[i % SERIES_BALL.length]!, last = s.points[s.points.length - 1], pts = s.points.map(p => `${sx(p.x)},${sy(p.y)}`).join(" "); return <g key={s.id} data-series={ball}>
        <g aria-hidden="true" fill="none" strokeLinejoin="round" strokeLinecap="round"><polyline points={pts} strokeWidth={lw(8)} className="tk-svg-line-outer" /><polyline points={pts} strokeWidth={lw(5)} className="tk-svg-line-inner" /><polyline points={pts} strokeWidth={lw(3)} style={{ stroke: `var(--tk-gumball-${ball}-base)` }} /></g>
        {s.points.map(p => <Mark key={p.x} label={`${s.label}, ${p.x}: ${y.format(p.y)}`} tip={`${p.x} · ${y.format(p.y)}`} x={sx(p.x)} y={sy(p.y)}><Gumball id={gid} ball={ball} cx={sx(p.x)} cy={sy(p.y)} r={pt(5)} /></Mark>)}
        {last && <text x={sx(last.x) + 10} y={sy(last.y) + 4 + i * 2} className="tk-svg-text" aria-hidden="true">{s.label.length > 16 ? `${s.label.slice(0, 15)}…` : s.label}</text>}
      </g>; })}
    </svg>}
  </ChartFrame>;
}


/** Read, figure: the editorial figure (full bleed below 768 px), the chart-card drawing at two sizes, and its table. */
function EditorialFigure({ card, label, caption, basis }: { card: Pick<CardModel, "series" | "forecast">; label: string; caption: ReactNode; basis?: Basis | undefined }) {
  return <figure className="ed-figure ed-bleed">
    <div className="hidden md:block" dangerouslySetInnerHTML={{ __html: figureSvg(card, 1280, 520, label, ROLE_PALETTE) }} />
    <div className="md:hidden" dangerouslySetInnerHTML={{ __html: figureSvg(card, 640, 480, label, ROLE_PALETTE) }} />
    <ChartTable caption={`${label}: the data behind the chart`} columns={["Quarter", basis ? `Share (${BASIS_WORD[basis].toLowerCase()})` : "Share", "Forecast"]}
      rows={[...card.series.map(p => [quarterText(p.q), pctText(p.s), ""]), ...card.forecast.map(f => [quarterText(f.q), "", `${pctText(f.mid)} (${pctText(f.lo)} to ${pctText(f.hi)})`])]} />
    <figcaption className="ed-caption mt-2 px-5 md:px-0">{caption}</figcaption>
  </figure>;
}

// DATA ---------------------------------------------------------------------------------------------------------------------------
export type QuarterPoint = { q: string; s: number | null; n: number; c: number };
function Cone({ quarters: raw, proj, fitted, backtest, large = false, sectors }: { quarters: QuarterPoint[]; proj: { h: number; mid: number | null; lo: number | null; hi: number | null }[]; fitted?: { quarter: string; value: number }[] | undefined; backtest?: { quarter: string; predicted: number }[] | undefined; large?: boolean; sectors?: { scope: string; pts: QuarterPoint[] }[] }) {
  const quarters = raw, pts = raw.filter(p => p.s !== null && p.n >= 15 && p.c >= .25), faint = raw.filter(p => p.s !== null && p.n > 0 && !(p.n >= 15 && p.c >= .25));
  if (!pts.length) return <svg viewBox="0 0 120 32" className={large ? "h-64 w-full" : "h-8 w-28"} role="img" aria-label={voiced("terminal.forecast.2")}><line x1="0" x2="120" y1="31" y2="31" stroke="var(--sys-color-rule)" /></svg>;
  const p0 = pts[0]!, pn = pts[pts.length - 1]!, first = qi(quarters[0]?.q ?? p0.q), latest = qi(pn.q), last = latest + 4, W = large ? 600 : 120, H = large ? 220 : 32;
  const all = [...pts.map(p => p.s ?? 0), ...(large ? faint.map(p => p.s ?? 0) : []), ...proj.flatMap(p => [p.hi ?? 0, p.mid ?? 0]), ...(fitted ?? []).map(f => f.value), ...(sectors ?? []).flatMap(s => s.pts.map(p => p.s ?? 0))];
  const max = Math.max(0.05, ...all);
  const x = (q: number) => 4 + (q - first) / Math.max(1, last - first) * (W - 8), y = (v: number) => H - 3 - v / max * (H - 8);
  const cone = proj.filter(p => p.lo !== null && p.hi !== null);
  const conePath = cone.length ? `M${x(latest)},${y(pn.s ?? 0)} ${cone.map(p => `L${x(latest + p.h)},${y(p.hi!)}`).join(" ")} ${[...cone].reverse().map(p => `L${x(latest + p.h)},${y(p.lo!)}`).join(" ")} Z` : "";
  return <svg viewBox={`0 0 ${W} ${H}`} className={large ? "h-64 w-full" : "h-8 w-28"} role="img" aria-label={`Share ${p0.q} to ${pn.q}${cone.length ? " with projection cone" : ""}`}>
    <line x1="0" x2={W} y1={H - 2} y2={H - 2} stroke="var(--sys-color-rule)" />
    {sectors?.map(s => { const sp = s.pts.filter(p => p.s !== null && p.n >= 8 && p.c >= .25); return <polyline key={s.scope} fill="none" stroke="var(--sys-color-ink-muted)" strokeOpacity=".35" strokeWidth={lw(1)} points={sp.map(p => `${x(qi(p.q))},${y(p.s!)}`).join(" ")}><title>{s.scope}</title></polyline>; })}
    {conePath && <path d={conePath} fill="var(--sys-color-highlight)" fillOpacity=".18" stroke="none" />}
    {fitted && <polyline fill="none" stroke="var(--sys-color-ink)" strokeOpacity=".5" strokeDasharray="4 3" points={fitted.filter(f => qi(f.quarter) <= last).map(f => `${x(qi(f.quarter))},${y(f.value)}`).join(" ")} />}
    {backtest && backtest.length > 0 && <polyline fill="none" stroke="var(--sys-color-ink-muted)" strokeDasharray="2 3" points={backtest.map(b => `${x(qi(b.quarter))},${y(b.predicted)}`).join(" ")}><title>Backtest prediction from 2025Q2</title></polyline>}
    <polyline fill="none" stroke="var(--sys-color-ink)" strokeWidth={lw(large ? 2 : 1)} points={pts.map(p => `${x(qi(p.q))},${y(p.s!)}`).join(" ")} />
    {large && faint.map(p => <circle key={`f${p.q}`} cx={x(qi(p.q))} cy={y(p.s!)} r={pt(2)} fill="var(--sys-color-ink-muted)" fillOpacity=".5"><title>{`${p.q} · ${pct(p.s)} · n=${p.n} · not usable`}</title></circle>)}
    {pts.map(p => <circle key={p.q} cx={x(qi(p.q))} cy={y(p.s!)} r={pt(large ? 3 : 1.5)} fill="var(--sys-color-ink)"><title>{`${p.q} · ${pct(p.s)} · n=${p.n} · coverage ${(p.c * 100).toFixed(0)}%`}</title></circle>)}
    {proj.filter(p => p.mid !== null).map(p => <circle key={p.h} cx={x(latest + p.h)} cy={y(p.mid!)} r={pt(large ? 3 : 1.5)} fill="var(--sys-color-highlight)"><title>{`+${p.h}Q ${ql(latest + p.h)} · ${pct(p.mid)} (${pct(p.lo)}–${pct(p.hi)})`}</title></circle>)}
  </svg>;
}

type ConeProps = Parameters<typeof Cone>[0];

export type QuarterLineProps =
  | (FrameProps & { look: "read"; series: LineSeries[]; y: { label: string; format: (v: number) => string } })
  | { look: "read"; card: Pick<CardModel, "series" | "forecast">; label: string; caption: ReactNode; basis?: Basis | undefined }
  | (ConeProps & { look: "data"; label?: string | undefined });
/** Line by quarter in either look. */
export function QuarterLine(p: QuarterLineProps) {
  if (p.look === "data") {
    const { look: _l, label, ...cone } = p;
    // The dense line sits in table cells; its table is only drawn with the large chart (the small one is named by its aria-label).
    return <>{<Cone {...cone} />}{cone.large && <ChartTable caption={`${label ?? "Share"} by quarter: the data behind the chart`} columns={["Quarter", "Share", "Homepages", "Usable"]}
      rows={cone.quarters.filter(q => q.s !== null).map(q => [quarterText(q.q), pct(q.s), String(q.n), q.n >= 15 && q.c >= .25 ? "yes" : "no"])} />}</>;
  }
  if ("card" in p) return <EditorialFigure card={p.card} label={p.label} caption={p.caption} basis={p.basis} />;
  const { look: _l, ...framed } = p;
  return <FramedLine {...framed} />;
}
