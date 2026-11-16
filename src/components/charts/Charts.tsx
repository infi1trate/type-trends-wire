// Shared chart primitives: one frame (title, one-line note, source line, receipt link, screen-reader table, empty state) and
// four token-driven SVG charts (scatter, line, bar, donut). Colours, type and focus come only from theme tokens (--tk-*).
// The slug restyle: 3 px ink axes, dashed newsprint gridlines, direct labels in Big Shoulders, stage colours from the tokens,
// points as gumballs (a radial gradient from the token's light to dark with a hard ink offset), lines as a paper-and-ink double
// stroke with the colour on top. Accessible names, table fallbacks and keyboard focus are unchanged.
import { useId, type ReactNode } from "react";
import { arcPath, arcs, extent, linear, point, ticks } from "@/lib/charts/scale";
import { Receipt } from "@/components/read/StoryCard";
import { GUMBALLS, type GumballName } from "@/lib/theme/contract";

export type Cell = string | number;
export type FrameProps = { title: string; note: string; source: string; receipt?: { href: string; label: string } | undefined; empty?: string };
type Frame = FrameProps & { isEmpty: boolean; table: { columns: string[]; rows: Cell[][] }; children: (ids: { title: string; note: string }) => ReactNode };
export const STAGE_FILL = (stage: string | null | undefined) => (stage ? `var(--tk-stage-${stage.toLowerCase()})` : "var(--tk-stage-unstaged)");
/** Which gumball a stage's point uses: Emerging pink, Rising green, Peaking red, Fading ink, Steady and unstaged newsprint. */
const STAGE_BALL: Record<string, GumballName> = { emerging: "pink", rising: "green", peaking: "red", fading: "ink", steady: "newsprint" };
export const stageBall = (stage: string | null | undefined): GumballName => STAGE_BALL[(stage ?? "").toLowerCase()] ?? "newsprint";
/** One radial gradient per gumball colour, ids scoped to this chart (light at the top left, where the light comes from). */
export function GumballDefs({ id }: { id: string }) {
  return <defs>{GUMBALLS.map(g => <radialGradient key={g} id={`${id}-${g}`} cx="35%" cy="30%" r="75%">
    <stop offset="0" style={{ stopColor: `var(--tk-gumball-${g}-light)` }} /><stop offset="0.5" style={{ stopColor: `var(--tk-gumball-${g}-base)` }} /><stop offset="1" style={{ stopColor: `var(--tk-gumball-${g}-dark)` }} />
  </radialGradient>)}</defs>;
}
/** A gumball: a hard ink offset under a gradient-filled circle. */
export function Gumball({ id, ball, cx, cy, r }: { id: string; ball: GumballName; cx: number; cy: number; r: number }) {
  return <><circle cx={cx + r * 0.35} cy={cy + r * 0.35} r={r} className="tk-svg-dot-shadow" aria-hidden="true" /><circle cx={cx} cy={cy} r={r} fill={`url(#${id}-${ball})`} className="tk-svg-dot" data-gumball={ball} /></>;
}
const ballId = (raw: string) => `gb${raw.replace(/[^a-zA-Z0-9_-]/g, "")}`;

export function ChartFrame({ title, note, source, receipt, empty = "No data to chart yet.", isEmpty, table, children }: Frame) {
  const id = useId(), ids = { title: `${id}-t`, note: `${id}-n` };
  return <figure className="tk-chart min-w-0" aria-labelledby={ids.title} data-chart="">
    <h3 id={ids.title} className="tk-t-h3">{title}</h3>
    <p id={ids.note} className="tk-t-small tk-c-secondary mt-1">{note}</p>
    {isEmpty ? <p className="tk-t-data tk-chart-empty mt-3" role="status" data-chart-empty="">{empty}</p> : <>
      <div className="mt-3">{children(ids)}</div>
      <div className="sr-only"><table data-chart-table="">
        <caption>{title}: the data behind the chart</caption>
        <thead><tr>{table.columns.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead>
        <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}</tr>)}</tbody>
      </table></div>
    </>}
    <p className="tk-t-caption tk-c-muted mt-2">Source: {source}{receipt && <> · <Receipt href={receipt.href} className="tk-tap underline">{receipt.label}</Receipt></>}</p>
  </figure>;
}

const W = 420;
const Axis = ({ y0, x0, x1, label }: { y0: number; x0: number; x1: number; label?: string }) => <g aria-hidden="true">
  <line x1={x0} x2={x1} y1={y0} y2={y0} className="tk-svg-axis" />{label && <text x={x1} y={y0 + 26} textAnchor="end" className="tk-svg-text tk-svg-muted">{label}</text>}
</g>;
/** A focusable mark: keyboard users tab through points; the name is its accessible label and its tip shows on focus or hover. */
const Mark = ({ label, tip, x, y, children }: { label: string; tip?: string | undefined; x: number; y: number; children: ReactNode }) => <g tabIndex={0} role="img" aria-label={label} className="tk-mark">
  {children}{tip && <text x={Math.min(x + 8, W - 4)} y={Math.max(12, y - 8)} textAnchor={x > W - 120 ? "end" : "start"} className="tk-svg-text tk-tip" aria-hidden="true">{tip}</text>}
</g>;

export type ScatterPoint = { id: string; label: string; x: number; y: number; stage?: string | null };
export function ScatterChart({ points, x, y, ...frame }: FrameProps & { points: ScatterPoint[]; x: { label: string; format: (v: number) => string }; y: { label: string; format: (v: number) => string } }) {
  const gid = ballId(useId());
  const H = 280, m = { l: 40, r: 12, t: 12, b: 34 };
  const sx = linear(extent(points.map(p => p.x)), [m.l, W - m.r]), dy = extent(points.map(p => p.y), { zero: false }), sy = linear(dy, [H - m.b, m.t]);
  // Direct labels where they fit: greedy, highest first; a label that would overlap another label or a point shows as a focus tip instead.
  const CH = 7.6, boxes: [number, number, number, number][] = points.map(p => [sx(p.x) - 5, sy(p.y) - 5, sx(p.x) + 5, sy(p.y) + 5]);
  const right = (px: number) => px <= W - 130;
  const labelled = new Set<string>();
  for (const p of [...points].sort((a, b) => b.y - a.y || a.id.localeCompare(b.id))) {
    const px = sx(p.x), py = sy(p.y), w = p.label.length * CH, box: [number, number, number, number] = right(px) ? [px + 7, py - 6, px + 8 + w, py + 6] : [px - 8 - w, py - 6, px - 7, py + 6];
    const own = boxes.findIndex(b => b[0] === px - 5 && b[1] === py - 5), others = boxes.filter((_, i) => i !== own);
    if (!others.some(o => box[0] < o[2] && box[2] > o[0] && box[1] < o[3] && box[3] > o[1]) && box[0] >= 0 && box[2] <= W) { boxes.push(box); labelled.add(p.id); }
  }
  return <ChartFrame {...frame} isEmpty={!points.length} table={{ columns: ["Signal", x.label, y.label, "Stage"], rows: points.map(p => [p.label, x.format(p.x), y.format(p.y), p.stage ?? "Not staged"]) }}>
    {ids => <svg viewBox={`0 0 ${W} ${H}`} className="tk-svg" role="group" aria-labelledby={ids.title} aria-describedby={ids.note}>
      <GumballDefs id={gid} />
      {ticks(dy[0], dy[1], 4).map(t => <g key={t} aria-hidden="true"><line x1={m.l} x2={W - m.r} y1={sy(t)} y2={sy(t)} className="tk-svg-grid" /><text x={m.l - 6} y={sy(t) + 4} textAnchor="end" className="tk-svg-text tk-svg-muted">{y.format(t)}</text></g>)}
      <Axis y0={H - m.b} x0={m.l} x1={W - m.r} label={x.label} />
      <text x={m.l} y={m.t - 2} className="tk-svg-text tk-svg-muted" aria-hidden="true">{y.label}</text>
      {points.map(p => { const px = sx(p.x), py = sy(p.y), show = labelled.has(p.id); return <Mark key={p.id} label={`${p.label}: ${x.label} ${x.format(p.x)}, ${y.label} ${y.format(p.y)}${p.stage ? `, ${p.stage}` : ""}`} tip={show ? undefined : p.label} x={px} y={py}>
        <Gumball id={gid} ball={stageBall(p.stage)} cx={px} cy={py} r={5.5} />
        {show && <text x={px + (right(px) ? 8 : -8)} y={py + 4} textAnchor={right(px) ? "start" : "end"} className="tk-svg-text" aria-hidden="true">{p.label}</text>}
      </Mark>; })}
    </svg>}
  </ChartFrame>;
}

export type LineSeries = { id: string; label: string; points: { x: string; y: number }[] };
/** Series colours, in order: green (rising, measured), pink, yellow, red. Each line sits on an ink-and-paper double stroke. */
const SERIES_BALL: GumballName[] = ["green", "pink", "yellow", "red"];
export function LineChart({ series, y, ...frame }: FrameProps & { series: LineSeries[]; y: { label: string; format: (v: number) => string } }) {
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
        <g aria-hidden="true" fill="none" strokeLinejoin="round" strokeLinecap="round"><polyline points={pts} strokeWidth={8} className="tk-svg-line-outer" /><polyline points={pts} strokeWidth={5} className="tk-svg-line-inner" /><polyline points={pts} strokeWidth={3} style={{ stroke: `var(--tk-gumball-${ball}-base)` }} /></g>
        {s.points.map(p => <Mark key={p.x} label={`${s.label}, ${p.x}: ${y.format(p.y)}`} tip={`${p.x} · ${y.format(p.y)}`} x={sx(p.x)} y={sy(p.y)}><Gumball id={gid} ball={ball} cx={sx(p.x)} cy={sy(p.y)} r={5} /></Mark>)}
        {last && <text x={sx(last.x) + 10} y={sy(last.y) + 4 + i * 2} className="tk-svg-text" aria-hidden="true">{s.label.length > 16 ? `${s.label.slice(0, 15)}…` : s.label}</text>}
      </g>; })}
    </svg>}
  </ChartFrame>;
}

export type Bar = { id: string; label: string; value: number; stage?: string | null };
export function BarChart({ bars, format, valueLabel, ...frame }: FrameProps & { bars: Bar[]; format: (v: number) => string; valueLabel: string }) {
  const row = 28, m = { l: 150, r: 52, t: 6, b: 6 }, H = m.t + m.b + bars.length * row;
  const sx = linear([0, Math.max(...bars.map(b => b.value), 0.0001)], [m.l, W - m.r]);
  return <ChartFrame {...frame} isEmpty={!bars.length} table={{ columns: ["Signal", valueLabel, "Stage"], rows: bars.map(b => [b.label, format(b.value), b.stage ?? "Not staged"]) }}>
    {ids => <svg viewBox={`0 0 ${W} ${H}`} className="tk-svg" role="group" aria-labelledby={ids.title} aria-describedby={ids.note}>
      {bars.map((b, i) => { const y = m.t + i * row; return <Mark key={b.id} label={`${b.label}: ${format(b.value)}${b.stage ? `, ${b.stage}` : ""}`} x={sx(b.value)} y={y}>
        <text x={m.l - 8} y={y + 18} textAnchor="end" className="tk-svg-text" aria-hidden="true">{b.label.length > 20 ? `${b.label.slice(0, 19)}…` : b.label}</text>
        <rect x={m.l} y={y + 6} width={Math.max(1, sx(b.value) - m.l)} height={row - 12} style={{ fill: STAGE_FILL(b.stage) }} className="tk-svg-bar" />
        <text x={sx(b.value) + 6} y={y + 18} className="tk-svg-text" aria-hidden="true">{format(b.value)}</text>
      </Mark>; })}
      <line x1={m.l} x2={m.l} y1={m.t} y2={H - m.b} className="tk-svg-axis" aria-hidden="true" />
    </svg>}
  </ChartFrame>;
}

export type Slice = { id: string; label: string; value: number };
/** Slice fills: the four inks, then newsprint and ink, then the light tints (each slice has a 1.5 px ink edge). */
const SLICE_INK = ["pink-base", "green-base", "yellow-base", "red-base", "newsprint-base", "ink-base", "pink-light", "green-light"].map(t => `var(--tk-gumball-${t})`);
/** Slices below this share are named in the note under the chart instead of beside the ring. */
export const DONUT_LABEL_MIN = 0.06;
export function DonutChart({ slices, unit, ...frame }: FrameProps & { slices: Slice[]; unit: string }) {
  const H = 240, cx = W / 2, cy = H / 2, r1 = 92, r0 = 58, a = arcs(slices.map(s => s.value)), total = slices.reduce((n, s) => n + s.value, 0);
  const pctOf = (v: number) => `${Math.round((v / Math.max(1, total)) * 100)}%`, small = slices.filter((_, i) => a[i]!.share > 0 && a[i]!.share < DONUT_LABEL_MIN);
  return <ChartFrame {...frame} isEmpty={!total} table={{ columns: ["Type", unit, "Share"], rows: slices.map(s => [s.label, s.value, pctOf(s.value)]) }}>
    {ids => <>
      <svg viewBox={`0 0 ${W} ${H}`} className="tk-svg" role="group" aria-labelledby={ids.title} aria-describedby={ids.note}>
        {slices.map((s, i) => { const g = a[i]!, [lx, ly] = point(cx, cy, r1 + 12, g.mid), right = Math.sin(g.mid) >= 0; return g.share > 0 && <Mark key={s.id} label={`${s.label}: ${s.value} ${unit}, ${pctOf(s.value)}`} tip={g.share < DONUT_LABEL_MIN ? `${s.label} · ${s.value}` : undefined} x={lx} y={ly}>
          <path d={arcPath(cx, cy, r0, r1, g.start, g.end)} style={{ fill: SLICE_INK[i % SLICE_INK.length] }} className="tk-svg-slice" />
          {g.share >= DONUT_LABEL_MIN && <text x={lx} y={ly + 4} textAnchor={right ? "start" : "end"} className="tk-svg-text" aria-hidden="true">{s.label} {s.value}</text>}
        </Mark>; })}
        <text x={cx} y={cy + 6} textAnchor="middle" className="tk-svg-text tk-svg-big" aria-hidden="true">{total}</text>
        <text x={cx} y={cy + 24} textAnchor="middle" className="tk-svg-text tk-svg-muted" aria-hidden="true">{unit}</text>
      </svg>
      {small.length > 0 && <p className="tk-t-caption tk-c-secondary">Also: {small.map(s => `${s.label} ${s.value}`).join(" · ")}</p>}
    </>}
  </ChartFrame>;
}
