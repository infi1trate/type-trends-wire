// L2 · PROPOSED FORM, specimen only (src/lib/chart/forms.ts "slope"): each row at two points in time, lines labelled at both ends,
// the row that moved most drawn in the highlighter. No reader page imports this file until the owner accepts the form and a gated
// build makes it live. Tokens only; the frame ships its table for screen readers and each line takes keyboard focus.
import { ChartInteraction } from "./Interaction";
import { linear } from "@/lib/charts/scale";
import { pctText, ptsText, quarterText } from "@/lib/labels";
import type { SlopeModel } from "@/lib/chart/specimens";
import { ChartFrame, Mark, W, type FrameProps } from "./Frame";
import { ChartTable } from "./ChartTable";
import { INK, MUTED, hlMark, hlSvgText, lw, pt } from "./ink";
import type { Look } from "./QuarterLine";

/** Text on the highlighter takes the highlighter's own text role, so it reads in both looks. */
const hlLabel = { ...hlSvgText, fill: "var(--tk-highlight-fg)" } as const;

/** Label positions spread to at least `gap` px apart, in the rows' order of value (top to bottom). */
export function spread(ys: readonly number[], gap: number, top: number, bottom: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y), out = new Array<number>(ys.length);
  let last = -Infinity;
  for (const o of order) { const y = Math.max(o.y, last + gap, top); out[o.i] = y; last = y; }
  const over = last - bottom;
  if (over > 0) for (const o of order) out[o.i] = Math.max(top, out[o.i]! - over);
  return out;
}
const heightOf = (dense: boolean) => (dense ? 260 : 280);
function Lines({ m, dense }: { m: SlopeModel; dense: boolean }) {
  const H = heightOf(dense), pad = { l: dense ? 56 : 150, r: dense ? 190 : 150, t: 24, b: 24 };
  const max = Math.max(...m.rows.flatMap(r => [r.from, r.to]), 0.01), sy = linear([0, max], [H - pad.b, pad.t]);
  const x0 = pad.l, x1 = W - pad.r, gap = dense ? 15 : 14;
  const ly0 = spread(m.rows.map(r => sy(r.from)), gap, pad.t, H - pad.b), ly1 = spread(m.rows.map(r => sy(r.to)), gap, pad.t, H - pad.b);
  return <>
    <text x={x0} y={12} textAnchor="middle" className="tk-svg-text tk-svg-muted" aria-hidden="true">{quarterText(m.from)}</text>
    <text x={x1} y={12} textAnchor="middle" className="tk-svg-text tk-svg-muted" aria-hidden="true">{quarterText(m.to)}</text>
    <line x1={x0} x2={x0} y1={pad.t - 6} y2={H - pad.b} className="tk-svg-axis" aria-hidden="true" />
    <line x1={x1} x2={x1} y1={pad.t - 6} y2={H - pad.b} className="tk-svg-axis" aria-hidden="true" />
    {m.rows.map((r, i) => { const hot = r.id === m.moved, a = sy(r.from), b = sy(r.to), text = hot ? hlLabel : { fill: INK };
      return <Mark key={r.id} label={`${r.label}: ${pctText(r.from)} in ${quarterText(m.from)}, ${pctText(r.to)} in ${quarterText(m.to)} (${ptsText(r.to - r.from)})`} x={x1} y={b}>
        <line x1={x0} x2={x1} y1={a} y2={b} stroke={hot ? INK : MUTED} strokeWidth={lw(hot ? 2.5 : dense ? 1 : 1.5)} style={hot ? hlMark : undefined} />
        <circle cx={x0} cy={a} r={pt(2.5)} fill={hot ? INK : MUTED} /><circle cx={x1} cy={b} r={pt(2.5)} fill={hot ? INK : MUTED} />
        <text x={x0 - 8} y={ly0[i]! + 4} textAnchor="end" className="tk-svg-text" style={text} aria-hidden="true">{dense ? pctText(r.from) : `${r.label} ${pctText(r.from)}`}</text>
        <text x={x1 + 8} y={ly1[i]! + 4} className="tk-svg-text" style={text} aria-hidden="true">{dense ? `${pctText(r.to)} ${r.label} ${ptsText(r.to - r.from).replace(" points", "")}` : `${pctText(r.to)} ${r.label}`}</text>
      </Mark>; })}
  </>;
}
const tableOf = (m: SlopeModel) => ({ columns: ["Row", quarterText(m.from), quarterText(m.to), "Change"], rows: m.rows.map(r => [r.label, pctText(r.from), pctText(r.to), ptsText(r.to - r.from)]) });
export function SlopeChart({ m, look = "read", ...frame }: FrameProps & { m: SlopeModel | null; look?: Look }) {
  if (look === "data") {
    if (!m) return <p className="tk-t-data">No rows.</p>;
    const t = tableOf(m);
    return <figure className="min-w-0" data-chart="slope">
      <ChartInteraction label={frame.title}><svg viewBox={`0 0 ${W} ${heightOf(true)}`} className="tk-svg" role="img" aria-label={`${frame.title}: ${frame.note}`}><Lines m={m} dense /></svg></ChartInteraction>
      <ChartTable caption={`${frame.title}: the data behind the chart`} columns={t.columns} rows={t.rows} />
      <figcaption className="tk-t-caption tk-c-muted mt-1">Source: {frame.source}</figcaption>
    </figure>;
  }
  return <ChartFrame {...frame} isEmpty={!m || m.rows.length < 2} table={m ? tableOf(m) : { columns: [], rows: [] }}>
    {ids => <svg viewBox={`0 0 ${W} ${heightOf(false)}`} className="tk-svg" role="img" aria-labelledby={ids.title} aria-describedby={ids.note} data-chart="slope"><Lines m={m!} dense={false} /></svg>}
  </ChartFrame>;
}

