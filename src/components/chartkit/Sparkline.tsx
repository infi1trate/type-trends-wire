// THE CHART KIT (U3) · the sparkline. Read: a 96×24 share line in the text colour with an end dot (signal lists, editions,
// leading indicators). Data: the terminal's 64×16 rank line, inverted so climbing goes up, with a highlighter square at the end when it
// rose; `large` is the same rank line at panel size with its axis labels. Every look carries its values for screen readers.
import { ChartInteraction } from "./Interaction";
import { pctText, quarterText } from "@/lib/labels";
import { ChartTable } from "./ChartTable";
import { CHART, lw, pt } from "./ink";

/** `what`: how the line is read aloud (default "share by quarter, N quarters"). */
/** `stretch` (S1 polish, the Signals rows): the line fills whatever box CSS gives the drawing, with the stroke and end dot kept at their
 *  drawn size, so a wider column draws a wider line at the same height. */
function ReadSpark({ points, label, w = 96, h = 24, what, stretch = false }: { points: number[] | undefined; label: string; w?: number; h?: number; what?: string; stretch?: boolean }) {
  const p = points ?? [];
  if (p.length < 2) return <span className="ed-caption" aria-label={`${label}: not enough history`}>—</span>;
  const W = w, H = h, max = Math.max(...p, 0.01), min = Math.min(...p, 0), r1 = (n: number) => Math.round(n * 10) / 10, x = (i: number) => r1(2 + (i / (p.length - 1)) * (W - 4)), y = (v: number) => r1(H - 2 - ((v - min) / Math.max(0.0001, max - min)) * (H - 4));
  const name = `${label}: ${what ?? `share by quarter, ${p.length} quarters`}`;
  if (stretch) return <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} preserveAspectRatio="none" role="img" aria-label={name} className="inline-block max-w-full align-middle" overflow="visible" data-spark-stretch="">
    <polyline fill="none" stroke="currentColor" strokeWidth={lw(3)} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" points={p.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
    <path d={`M${x(p.length - 1)} ${y(p[p.length - 1]!)}h0`} fill="none" stroke="currentColor" strokeWidth={pt(4) * 2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
  </svg>;
  return <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={name} className="inline-block h-auto max-w-full align-middle" overflow="visible">
    <polyline fill="none" stroke="currentColor" strokeWidth={lw(3)} strokeLinejoin="round" strokeLinecap="round" points={p.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
    <circle cx={x(p.length - 1)} cy={y(p[p.length - 1]!)} r={pt(4)} fill="currentColor" />
  </svg>;
}
/** 64×16 sparkline of popularity rank, inverted so climbing goes up. */
function RankSpark({ ranks }: { ranks: number[] | undefined }) {
  if (!ranks || ranks.length < 2) return <span className="text-g500">—</span>;
  const w = 64, h = 16;
  const min = Math.min(...ranks), max = Math.max(...ranks);
  const span = max - min || 1;
  const pts: [number, number][] = ranks.map((r, i) => [(i / (ranks.length - 1)) * (w - 3) + 1, ((r - min) / span) * (h - 3) + 1.5] as [number, number]);
  const rising = ranks[ranks.length - 1]! < ranks[0]!;
  const last = pts[pts.length - 1]!;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="inline-block align-middle">
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="var(--sys-color-ink)" strokeWidth={lw(1)} />
      {rising && <rect x={last[0] - 1} y={last[1] - 1} width="2" height="2" fill="var(--sys-color-highlight)" />}
    </svg>
  );
}

function RankLine({ points }: { points: { date: string; rank: number }[] }) {
  if (points.length < 2) return <p className="t-say py-6 text-g500">Only {points.length} daily snapshot so far; the line draws once a second day is collected.</p>;
  const w = 456, h = 160, pl = 36, pb = 18, pt = 6;
  const first = points[0]!, lastP = points[points.length - 1]!;
  const ranks = points.map((p) => p.rank);
  const min = Math.min(...ranks), max = Math.max(...ranks);
  const span = max - min || 1;
  const x = (i: number) => pl + (i / (points.length - 1)) * (w - pl - 4);
  const y = (r: number) => pt + ((r - min) / span) * (h - pt - pb);
  const grid = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(min + t * span));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={`Popularity rank from #${first.rank} to #${lastP.rank}`}>
      {grid.map((g) => (
        <g key={g}>
          <line x1={pl} x2={w} y1={y(g)} y2={y(g)} stroke="var(--sys-color-rule)" strokeWidth={CHART.scale} />
          <text x={pl - 4} y={y(g) + 3} textAnchor="end" fontSize="9" fill="var(--sys-color-ink-muted)">#{g}</text>
        </g>
      ))}
      <text x={pl} y={h - 4} fontSize="9" fill="var(--sys-color-ink-muted)">{first.date}</text>
      <text x={w - 4} y={h - 4} fontSize="9" textAnchor="end" fill="var(--sys-color-ink-muted)">{lastP.date}</text>
      <polyline points={points.map((p, i) => `${x(i)},${y(p.rank)}`).join(" ")} fill="none" stroke="var(--sys-color-ink)" strokeWidth={lw(1)} />
      <rect x={x(points.length - 1) - 1.5} y={y(lastP.rank) - 1.5} width="3" height="3" fill="var(--sys-color-highlight)" />
    </svg>
  );
}


export type SparklineProps =
  | { look: "read"; values: number[] | undefined; label: string; w?: number; h?: number; what?: string; format?: (v: number) => string; stretch?: boolean; interactive?: boolean; periods?: string[] | undefined; counts?: (string | null)[] | undefined }
  | { look: "data"; values: number[] | undefined; label?: string }
  | { look: "data"; large: true; points: { date: string; rank: number }[] };
/** A sparkline in either look. */
export function Sparkline(p: SparklineProps) {
  if (p.look === "read") {
    const { look: _l, values, format = pctText, interactive = false, periods, counts, ...rest } = p;
    const valuesList = values ?? [], W = rest.w ?? 96, H = rest.h ?? 24, max = Math.max(...valuesList, .01), min = Math.min(...valuesList, 0);
    return <><ChartInteraction enabled={Boolean(interactive || rest.stretch || W > 240)} width={W} height={H} label={rest.label} points={valuesList.map((v, i) => ({ x: 2 + i / Math.max(1,valuesList.length - 1) * (W - 4), y: H - 2 - (v - min) / Math.max(.0001,max-min)*(H-4), period: quarterText(periods?.[i] ?? ""), lines: [[rest.label, format(v), counts?.[i]].filter(Boolean).join(" · ")] }))}><ReadSpark points={values} {...rest} /></ChartInteraction>{values && values.length >= 2 && <span className="sr-only">{values.map(format).join(", ")}</span>}</>;
  }
  if ("large" in p) {
    const ranks = p.points.map(p => p.rank), min = Math.min(...ranks), max = Math.max(...ranks);
    return <><ChartInteraction width={456} height={160} label="Popularity rank by day" points={p.points.map((p,i) => ({ x: 36 + i / Math.max(1,ranks.length-1)*416, y: 6 + (p.rank-min)/Math.max(1,max-min)*136, period: p.date, lines: [`Rank ${p.rank.toFixed(1)}`] }))}><RankLine points={p.points} /></ChartInteraction>{p.points.length >= 2 && <ChartTable caption="Popularity rank by day" columns={["Day", "Rank"]} rows={p.points.map(x => [x.date, `#${x.rank}`])} />}</>;
  }
  return <><RankSpark ranks={p.values} />{p.values && p.values.length >= 2 && <span className="sr-only">{`${p.label ?? "Rank"}: ${p.values.map(r => `#${r}`).join(", ")}`}</span>}</>;
}
