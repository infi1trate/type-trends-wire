// L2 · PROPOSED FORM, specimen only (src/lib/chart/forms.ts "dot-range"): one dot per row with a line for its range, sorted, at most
// twelve rows; the widest range in the highlighter. No reader page imports this file until the owner accepts the form and a gated
// build makes it live. Tokens only; the frame ships its table for screen readers and each row takes keyboard focus.
import { linear, ticks } from "@/lib/charts/scale";
import { pctText, quarterText } from "@/lib/labels";
import type { DotRangeModel } from "@/lib/chart/specimens";
import { ChartFrame, Mark, W, type FrameProps } from "./Frame";
import { ChartTable } from "./ChartTable";
import { INK, MUTED, RULE, hlMark, hlSvgText, lw, pt } from "./ink";
import type { Look } from "./QuarterLine";

/** Text on the highlighter takes the highlighter's own text role, so it reads in both looks. */
const hlLabel = { ...hlSvgText, fill: "var(--tk-highlight-fg)" } as const;

function Rows({ m, dense, label }: { m: DotRangeModel; dense: boolean; label: string }) {
  const row = dense ? 18 : 26, pad = { l: dense ? 120 : 150, r: dense ? 110 : 24, t: 8, b: 22 }, H = pad.t + pad.b + m.rows.length * row;
  const max = Math.max(...m.rows.map(r => r.hi), 0.01), sx = linear([0, max], [pad.l, W - pad.r]);
  return <svg viewBox={`0 0 ${W} ${H}`} className="tk-svg" role="group" aria-label={label}>
    {ticks(0, max, 4).map(t => <g key={t} aria-hidden="true"><line x1={sx(t)} x2={sx(t)} y1={pad.t} y2={H - pad.b} stroke={RULE} strokeDasharray="2 3" /><text x={sx(t)} y={H - 6} textAnchor="middle" className="tk-svg-text tk-svg-muted">{pctText(t).replace(".0%", "%")}</text></g>)}
    {m.rows.map((r, i) => { const y = pad.t + i * row + row / 2, hot = r.id === m.widest;
      return <Mark key={r.id} label={`${r.label}: ${pctText(r.value)} now; next quarter between ${pctText(r.lo)} and ${pctText(r.hi)}`} x={sx(r.hi)} y={y}>
        <text x={pad.l - 8} y={y + 4} textAnchor="end" className="tk-svg-text" style={hot ? hlLabel : { fill: INK }} aria-hidden="true">{r.label.length > 22 ? `${r.label.slice(0, 21)}…` : r.label}</text>
        <line x1={sx(r.lo)} x2={sx(r.hi)} y1={y} y2={y} stroke={hot ? INK : MUTED} strokeWidth={lw(hot ? 2.5 : 1.5)} strokeLinecap="round" style={hot ? hlMark : undefined} />
        <circle cx={sx(r.value)} cy={y} r={pt(3)} fill={INK} />
        {dense && <text x={W - pad.r + 8} y={y + 4} className="tk-svg-text tk-svg-muted" aria-hidden="true">{`${pctText(r.lo)} · ${pctText(r.value)} · ${pctText(r.hi)}`}</text>}
      </Mark>; })}
  </svg>;
}
const tableOf = (m: DotRangeModel) => ({ columns: ["Signal", "Share now", `Low, ${m.quarter ? quarterText(m.quarter) : "next quarter"}`, `High, ${m.quarter ? quarterText(m.quarter) : "next quarter"}`], rows: m.rows.map(r => [r.label, pctText(r.value), pctText(r.lo), pctText(r.hi)]) });
export function DotRange({ m, look = "read", ...frame }: FrameProps & { m: DotRangeModel; look?: Look }) {
  if (look === "data") {
    const t = tableOf(m);
    return <figure className="min-w-0" data-chart="dot-range" role="img" aria-label={`${frame.title}: ${frame.note}`}>
      <Rows m={m} dense label={frame.title} />
      <ChartTable caption={`${frame.title}: the data behind the chart`} columns={t.columns} rows={t.rows} />
      <figcaption className="tk-t-caption tk-c-muted mt-1">Source: {frame.source}</figcaption>
    </figure>;
  }
  return <ChartFrame {...frame} isEmpty={m.rows.length < 2} table={tableOf(m)}>{() => <div data-chart="dot-range"><Rows m={m} dense={false} label={frame.title} /></div>}</ChartFrame>;
}
