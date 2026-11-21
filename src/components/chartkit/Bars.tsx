// THE CHART KIT (U3) · bars. Read: ranked horizontal bars in a ChartFrame, filled by stage. Data: one column per quarter, well-covered
// quarters solid and the rest faint (the receipt drawer's share by quarter). Both ship their table; shares are formatted by labels.ts.
import { useGrow } from "@/components/brand/Motion";
import { linear } from "@/lib/charts/scale";
import { pctText, quarterText } from "@/lib/labels";
import { ChartFrame, Mark, STAGE_FILL, W, type FrameProps } from "./Frame";
import { ChartTable } from "./ChartTable";

export type Bar = { id: string; label: string; value: number; stage?: string | null };
function RankBars({ bars, format, valueLabel, ...frame }: FrameProps & { bars: Bar[]; format: (v: number) => string; valueLabel: string }) {
  const [growRef, grow] = useGrow<SVGSVGElement>();
  const row = 28, m = { l: 150, r: 52, t: 6, b: 6 }, H = m.t + m.b + bars.length * row;
  const sx = linear([0, Math.max(...bars.map(b => b.value), 0.0001)], [m.l, W - m.r]);
  return <ChartFrame {...frame} isEmpty={!bars.length} table={{ columns: ["Signal", valueLabel, "Stage"], rows: bars.map(b => [b.label, format(b.value), b.stage ?? "Not staged"]) }}>
    {ids => <svg ref={growRef} viewBox={`0 0 ${W} ${H}`} className={`tk-svg ${grow}`.trim()} role="group" aria-labelledby={ids.title} aria-describedby={ids.note}>
      {bars.map((b, i) => { const y = m.t + i * row; return <Mark key={b.id} label={`${b.label}: ${format(b.value)}${b.stage ? `, ${b.stage}` : ""}`} x={sx(b.value)} y={y}>
        <text x={m.l - 8} y={y + 18} textAnchor="end" className="tk-svg-text" aria-hidden="true">{b.label.length > 20 ? `${b.label.slice(0, 19)}…` : b.label}</text>
        <rect x={m.l} y={y + 6} width={Math.max(1, sx(b.value) - m.l)} height={row - 12} style={{ fill: STAGE_FILL(b.stage) }} className="tk-svg-bar" />
        <text x={sx(b.value) + 6} y={y + 18} className="tk-svg-text" aria-hidden="true">{format(b.value)}</text>
      </Mark>; })}
      <line x1={m.l} x2={m.l} y1={m.t} y2={H - m.b} className="tk-svg-axis" aria-hidden="true" />
    </svg>}
  </ChartFrame>;
}


export type QuarterBar = { q: string; share: number | null; usable: boolean };
function QuarterBars({ label, points: pts }: { label: string; points: QuarterBar[] }) {
  const max = Math.max(0.01, ...pts.map(p => p.share ?? 0)), CW = 520, H = 120, bw = CW / Math.max(1, pts.length);
  return <figure className="px-3">
    <svg viewBox={`0 0 ${CW} ${H + 16}`} className="h-auto w-full" role="img" aria-label={`${label}: share of tracked homepages by quarter`}>
      <line x1="0" x2={CW} y1={H} y2={H} stroke="var(--sys-color-rule)" />
      {pts.map((p, i) => { const h = ((p.share ?? 0) / max) * (H - 8); return <rect key={p.q} x={i * bw + 1} y={H - h} width={Math.max(1, bw - 2)} height={h} fill={p.usable ? "var(--sys-color-ink)" : "var(--sys-color-ink-muted)"} opacity={p.usable ? 1 : 0.4} />; })}
      {pts.length > 0 && <><text x="0" y={H + 13} fontSize="10" fill="var(--sys-color-ink-muted)">{pts[0]!.q}</text><text x={CW} y={H + 13} fontSize="10" textAnchor="end" fill="var(--sys-color-ink-muted)">{pts[pts.length - 1]!.q}</text></>}
    </svg>
    <ChartTable caption={`${label}: share of tracked homepages by quarter`} columns={["Quarter", "Share", "Well covered"]} rows={pts.map(p => [quarterText(p.q), p.share == null ? "–" : pctText(p.share), p.usable ? "yes" : "no"])} />
    <figcaption className="label text-compare-muted">SOLID = WELL COVERED · FAINT = TOO FEW HOMEPAGES TO USE</figcaption>
  </figure>;
}

export type BarsProps =
  | (FrameProps & { look: "read"; bars: Bar[]; format: (v: number) => string; valueLabel: string })
  | { look: "data"; label: string; points: QuarterBar[] };
/** Bars in either look. */
export function Bars(p: BarsProps) {
  if (p.look === "data") return <QuarterBars label={p.label} points={p.points} />;
  const { look: _l, ...rest } = p;
  return <RankBars {...rest} />;
}
