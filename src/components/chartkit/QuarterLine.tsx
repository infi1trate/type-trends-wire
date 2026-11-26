// THE CHART KIT (U3) · line by quarter. One component, two looks, the same quarter axis and tokens:
//  · Read, framed: one or more series by quarter in a ChartFrame (the front page's chart of the day, the kit).
//  · Read, figure: the share of tracked homepages by quarter with its forecast band, drawn from the pure chart-card model the share
//    images use (lib/chart/card.ts), so the page and the PNG cannot differ; archive gaps longer than a year are a muted dashed bridge
//    ("spans several years"), measured points are solid, the forecast band is the AI-free projection.
//  · Data: the terminal's dense line with its projection cone, fitted line, backtest and sector lines (the Forecast panel).
// Every look ships its data table for screen readers; numbers and quarters are formatted by labels.ts.
import { ChartInteraction } from "./Interaction";
import { decimalLabel, type ReadPoint } from "./interaction";
import type { ReactNode } from "react";
import { useId } from "react";
import { figureSvg, qIdx, type CardModel } from "@/lib/chart/card";
import { extent, linear, ticks } from "@/lib/charts/scale";
import { line as voiced } from "@/lib/voice";
import { BASIS_WORD, pctText, quarterText, type Basis } from "@/lib/labels";
import type { GumballName } from "@/lib/theme/contract";
import { Axis, ChartFrame, Gumball, GumballDefs, Mark, W, ballId, type FrameProps } from "./Frame";
import { ChartTable } from "./ChartTable";
import { ROLE_PALETTE, lw, pt } from "./ink";
import { THRESHOLDS } from "@/lib/forecast";
export type Look = "read" | "data";

const pct = (v: number | null | undefined, d = 1) => (v == null ? "not measured" : d === 1 ? pctText(v) : `${(v * 100).toFixed(d)}%`);
const qi = (q: string) => Number(q.slice(0, 4)) * 4 + Number(q.slice(5)) - 1;
const ql = (i: number) => `${Math.floor(i / 4)}Q${(i % 4) + 1}`;

export type LineSeries = { id: string; label: string; points: { x: string; y: number }[] };
/** Series colours, in order: green (rising, measured), pink, yellow, red. Each line sits on an ink-and-paper double stroke. */
const SERIES_BALL: GumballName[] = ["green", "pink", "yellow", "red"];
function FramedLine({ series, y, join, ...frame }: FrameProps & { series: LineSeries[]; y: { label: string; format: (v: number) => string }; join?: { quarter: string; note: string } | undefined }) {
  const gid = ballId(useId());
  const H = 260, m = { l: 40, r: 124, t: 14, b: 34 };
  const xs = [...new Set(series.flatMap(s => s.points.map(p => p.x)))].sort(), dy = extent(series.flatMap(s => s.points.map(p => p.y)));
  const sx = (q: string) => (xs.length < 2 ? (m.l + W - m.r) / 2 : m.l + (xs.indexOf(q) / (xs.length - 1)) * (W - m.r - m.l)), sy = linear(dy, [H - m.b, m.t]);
  const years = [...new Set(xs.map(q=>q.slice(0,4)))];
  const readPoints = xs.map(q=>({x:sx(q),y:sy(series[0]?.points.find(p=>p.x===q)?.y ?? 0),period:quarterText(q),lines:[...series.flatMap(s=>{const p=s.points.find(p=>p.x===q);return p?[`${s.label} ${decimalLabel(y.format(p.y))}`]:[]}), ...(join?.quarter === q ? [join.note] : [])]}));
  const empty = !series.some(s => s.points.length);
  return <ChartFrame {...frame} interaction={false} isEmpty={empty} table={{ columns: ["Quarter", ...series.map(s => s.label)], rows: xs.map(q => [q, ...series.map(s => { const p = s.points.find(v => v.x === q); return p ? y.format(p.y) : "—"; })]) }}>
    {ids => <ChartInteraction width={W} height={H} points={readPoints} label={frame.title}><svg viewBox={`0 0 ${W} ${H}`} className="tk-svg" role="img" aria-labelledby={ids.title} aria-describedby={ids.note}>
      <GumballDefs id={gid} />
      {ticks(dy[0], dy[1], 4).map(t => <g key={t} aria-hidden="true"><line x1={m.l} x2={W - m.r} y1={sy(t)} y2={sy(t)} className="tk-svg-grid" /><text x={m.l - 6} y={sy(t) + 4} textAnchor="end" className="tk-svg-text tk-svg-muted">{y.format(t)}</text></g>)}
      <Axis y0={H - m.b} x0={m.l} x1={W - m.r} />
      {join && xs.includes(join.quarter) && <line x1={sx(join.quarter)} x2={sx(join.quarter)} y1={H - m.b - 8} y2={H - m.b + 8} className="tk-svg-axis"><title>{join.note}</title></line>}
      {years.map((year,i)=>{const q=xs.find(q=>q.startsWith(year));return q && <g key={year} aria-hidden="true"><line x1={sx(q)} x2={sx(q)} y1={H-m.b} y2={H-m.b+5} className="tk-svg-axis" />{(years.length<=4 || i%2===0 || i===years.length-1) && <text x={sx(q)} y={H-m.b+20} textAnchor="middle" className="tk-svg-text tk-svg-muted">{year}</text>}</g>;})}
      {series.map((s, i) => { const ball = SERIES_BALL[i % SERIES_BALL.length]!, last = s.points[s.points.length - 1], pts = s.points.map(p => `${sx(p.x)},${sy(p.y)}`).join(" "); return <g key={s.id} data-series={ball}>
        <g aria-hidden="true" fill="none" strokeLinejoin="round" strokeLinecap="round"><polyline points={pts} strokeWidth={lw(8)} className="tk-svg-line-outer" /><polyline points={pts} strokeWidth={lw(5)} className="tk-svg-line-inner" /><polyline points={pts} strokeWidth={lw(3)} style={{ stroke: `var(--tk-gumball-${ball}-base)` }} /></g>
        {s.points.map(p => <Mark key={p.x} label={`${quarterText(p.x)}: ${s.label} ${y.format(p.y)}`} tip={`${p.x} · ${y.format(p.y)}`} x={sx(p.x)} y={sy(p.y)}><Gumball id={gid} ball={ball} cx={sx(p.x)} cy={sy(p.y)} r={pt(5)} /></Mark>)}
        {s.points[0] && <text x={sx(s.points[0].x)} y={Math.max(14,sy(s.points[0].y)-12)} className="tk-svg-text" aria-hidden="true">{decimalLabel(y.format(s.points[0].y))}</text>}
        {last && <text x={sx(last.x) + 10} y={sy(last.y) + 4 + i * 2} className="tk-svg-text" aria-hidden="true">{s.label.length > 16 ? `${s.label.slice(0, 15)}…` : s.label} {last && decimalLabel(y.format(last.y))}</text>}
      </g>; })}
    </svg></ChartInteraction>}
  </ChartFrame>;
}


/** Read, figure: the editorial figure (full bleed below 768 px), the chart-card drawing at two sizes, and its table. */
export function editorialPoints(card: Pick<CardModel, "series" | "forecast">, w: number, h: number): ReadPoint[] {
  const first = qIdx(card.series[0]?.q ?? "2021Q1"), lastActual = qIdx(card.series.at(-1)?.q ?? "2021Q1"), last = Math.max(lastActual, ...card.forecast.map(f => qIdx(f.q)));
  const max = Math.max(.05, ...card.series.map(p => p.s), ...card.forecast.map(f => f.hi)) * 1.12;
  const step = [.01, .02, .05, .1, .2, .25].find(s => max / s <= 5) ?? .25, top = Math.ceil(max / step) * step;
  const x = (q: string) => 84 + (qIdx(q) - first) / Math.max(1, last - first) * (w - 92), y = (v: number) => h - 40 - v / top * (h - 56);
  return [...card.series.map(p => ({ x: x(p.q), y: y(p.s), period: quarterText(p.q), lines: [`Share ${pctText(p.s)}`, `${Math.round(p.s * p.n)} of ${p.n}`] })), ...card.forecast.map(f => ({ x: x(f.q), y: y(f.mid), period: quarterText(f.q), lines: [`Share ${pctText(f.mid)} · forecast`, `${pctText(f.lo)}–${pctText(f.hi)}`] }))];
}
function EditorialPlot({ card, label, w, h }: { card: Pick<CardModel, "series" | "forecast">; label: string; w: number; h: number }) {
  const points = editorialPoints(card, w, h);
  const first = qIdx(card.series[0]?.q ?? '2021Q1'), last = Math.max(first, ...card.series.map(p => qIdx(p.q)), ...card.forecast.map(f => qIdx(f.q)));
  const years = Array.from({length: Math.floor(last/4)-Math.ceil(first/4)+1}, (_,i) => Math.ceil(first/4)+i);
  const every = years.length > (w < 700 ? 4 : 9) ? 2 : 1;
  const xYear = (y: number) => 84 + (y*4-first)/Math.max(1,last-first)*(w-92);
  return <ChartInteraction points={points} width={w} height={h} label={label}>
    <div className="editorial-plot" style={{ aspectRatio: `${w} / ${h}` }} dangerouslySetInnerHTML={{ __html: figureSvg(card, w, h, label, ROLE_PALETTE).replace(/<text\b[^>]*>\d{4}<\/text>/g, "") }} />
    <svg viewBox={`0 0 ${w} ${h}`} className="editorial-labels" aria-hidden="true">{years.map((y,i) => <g key={y}><line x1={xYear(y)} x2={xYear(y)} y1={h-40} y2={h-32} stroke="var(--sys-color-rule)" />{i%every===0 && <text x={xYear(y)} y={h-8} textAnchor={i===years.length-1?'end':'middle'} className="tk-svg-text">{y}</text>}</g>)}{[points[0], points[card.series.length - 1], card.forecast.length ? points.at(-1) : undefined].filter((p, i, a) => p && a.indexOf(p) === i).map(p => p && <text key={p.period} x={p.x} y={Math.max(32, p.y - 20)} textAnchor={p.x > w * .8 ? "end" : "start"} className="tk-svg-text">{p.lines[0]?.replace('Share ', '')}</text>)}</svg>
  </ChartInteraction>;
}
function EditorialFigure({ card, label, caption, basis }: { card: Pick<CardModel, "series" | "forecast">; label: string; caption: ReactNode; basis?: Basis | undefined }) {
  return <figure className="ed-figure">
    <div className="hidden md:block"><EditorialPlot card={card} label={label} w={1280} h={520} /></div>
    <div className="md:hidden"><EditorialPlot card={card} label={label} w={640} h={480} /></div>
    <ChartTable caption={`${label}: the data behind the chart`} columns={["Quarter", basis ? `Share (${BASIS_WORD[basis].toLowerCase()})` : "Share", "Forecast"]}
      rows={[...card.series.map(p => [quarterText(p.q), pctText(p.s), ""]), ...card.forecast.map(f => [quarterText(f.q), "", `${pctText(f.mid)} (${pctText(f.lo)} to ${pctText(f.hi)})`])]} />
    <figcaption className="ed-caption mt-2">{caption}</figcaption>
  </figure>;
}

// DATA ---------------------------------------------------------------------------------------------------------------------------
export type QuarterPoint = { q: string; s: number | null; n: number; c: number };
function Cone({ quarters: raw, proj, fitted, backtest, large = false, sectors }: { quarters: QuarterPoint[]; proj: { h: number; mid: number | null; lo: number | null; hi: number | null }[]; fitted?: { quarter: string; value: number }[] | undefined; backtest?: { quarter: string; predicted: number }[] | undefined; large?: boolean; sectors?: { scope: string; pts: QuarterPoint[] }[] }) {
  const quarters = raw, pts = raw.filter(p => p.s !== null && p.n >= THRESHOLDS.denomAll && p.c >= THRESHOLDS.coverage), faint = raw.filter(p => p.s !== null && p.n > 0 && !(p.n >= THRESHOLDS.denomAll && p.c >= THRESHOLDS.coverage));
  if (!pts.length) return <svg viewBox="0 0 120 32" className={large ? "h-64 w-full" : "h-8 w-28"} role="img" aria-label={voiced("terminal.forecast.2")}><line x1="0" x2="120" y1="31" y2="31" stroke="var(--sys-color-rule)" /></svg>;
  const p0 = pts[0]!, pn = pts[pts.length - 1]!, first = qi(quarters[0]?.q ?? p0.q), latest = qi(pn.q), last = latest + 4, W = large ? 600 : 120, H = large ? 220 : 32;
  const all = [...pts.map(p => p.s ?? 0), ...(large ? faint.map(p => p.s ?? 0) : []), ...proj.flatMap(p => [p.hi ?? 0, p.mid ?? 0]), ...(fitted ?? []).map(f => f.value), ...(sectors ?? []).flatMap(s => s.pts.map(p => p.s ?? 0))];
  const max = Math.max(0.05, ...all);
  const x = (q: number) => 4 + (q - first) / Math.max(1, last - first) * (W - 8), y = (v: number) => H - 3 - v / max * (H - 8);
  const cone = proj.filter(p => p.lo !== null && p.hi !== null);
  const conePath = cone.length ? `M${x(latest)},${y(pn.s ?? 0)} ${cone.map(p => `L${x(latest + p.h)},${y(p.hi!)}`).join(" ")} ${[...cone].reverse().map(p => `L${x(latest + p.h)},${y(p.lo!)}`).join(" ")} Z` : "";
  const readPoints: ReadPoint[] = [...pts.map(p => ({ x: x(qi(p.q)), y: y(p.s ?? 0), period: quarterText(p.q), lines: [`Share ${pct(p.s)}`, `${Math.round((p.s ?? 0) * p.n)} of ${p.n}`] })), ...proj.filter(p => p.mid !== null).map(p => ({ x: x(latest + p.h), y: y(p.mid ?? 0), period: quarterText(ql(latest + p.h)), lines: [`Share ${pct(p.mid)} · forecast`, `${pct(p.lo)}–${pct(p.hi)}`] })), ...(sectors ?? []).flatMap(s => s.pts.filter(p => p.s !== null).map(p => ({ x: x(qi(p.q)), y: y(p.s ?? 0), period: quarterText(p.q), lines: [`${s.scope} ${pct(p.s)}`, `${Math.round((p.s ?? 0) * p.n)} of ${p.n}`] })))];
  const drawing = <svg viewBox={`0 0 ${W} ${H}`} className={large ? "h-64 w-full" : "h-8 w-28"} role="img" aria-label={`Share ${p0.q} to ${pn.q}${cone.length ? " with projection cone" : ""}`}>
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
  return large ? <ChartInteraction points={readPoints} width={W} height={H} label="Share by quarter">{drawing}</ChartInteraction> : drawing;
}

type ConeProps = Parameters<typeof Cone>[0];

export type QuarterLineProps =
  | (FrameProps & { look: "read"; series: LineSeries[]; y: { label: string; format: (v: number) => string }; join?: { quarter: string; note: string } | undefined })
  | { look: "read"; card: Pick<CardModel, "series" | "forecast">; label: string; caption: ReactNode; basis?: Basis | undefined }
  | (ConeProps & { look: "data"; label?: string | undefined });
/** Line by quarter in either look. */
export function QuarterLine(p: QuarterLineProps) {
  if (p.look === "data") {
    const { look: _l, label, ...cone } = p;
    // The dense line sits in table cells; its table is only drawn with the large chart (the small one is named by its aria-label).
    return <>{<Cone {...cone} />}{cone.large && <ChartTable caption={`${label ?? "Share"} by quarter: the data behind the chart`} columns={["Quarter", "Share", "Homepages", "Usable"]}
      rows={cone.quarters.filter(q => q.s !== null).map(q => [quarterText(q.q), pct(q.s), String(q.n), q.n >= THRESHOLDS.denomAll && q.c >= THRESHOLDS.coverage ? "yes" : "no"])} />}</>;
  }
  if ("card" in p) return <EditorialFigure card={p.card} label={p.label} caption={p.caption} basis={p.basis} />;
  const { look: _l, ...framed } = p;
  return <FramedLine {...framed} />;
}
