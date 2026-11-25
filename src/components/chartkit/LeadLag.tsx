// B2 · PROPOSED FORM "lead-lag" (src/lib/chart/forms.ts): do the leaders lead? The vanguard's share and everyone else's on one axis,
// the gap filled green where the vanguard is ahead and pink where it is behind, and the measured lag written as a bracket. Quarters
// with fewer than 15 vanguard brands read are dotted. No reader page imports this file until the owner accepts the form.
import { pctText, quarterText } from "@/lib/labels";
import { ChartInteraction } from "./Interaction";
import { ChartTable } from "./ChartTable";
import { INK, MUTED, lw, pt } from "./ink";
import { useChartWidth } from "./useChartWidth";
import { LEAD_FLOOR, gapAreas, lagOf, lagText, leadLine, leadPoints, type LeadRow } from "./leadlag-layout";
import type { Look } from "./QuarterLine";

export const LEAD_HOW = "The dark line is the vanguard, the light line everyone else; green where the vanguard is ahead, pink where it is behind.";
const GREEN = "color-mix(in srgb, var(--sys-color-positive) 35%, transparent)", PINK = "color-mix(in srgb, var(--tk-accent-1) 55%, transparent)";
export function leadTable(rows: readonly LeadRow[]) {
  return { columns: ["Quarter", "Vanguard", "Vanguard read", "Everyone else", "Everyone else read"], rows: leadPoints(rows).map(p => [quarterText(p.quarter), p.v == null ? "not read" : pctText(p.v), p.vn, p.r == null ? "not read" : pctText(p.r), p.rn]) };
}
export function LeadLagDrawing({ rows, width, height, compact = false }: { rows: readonly LeadRow[]; width: number; height: number; compact?: boolean }) {
  const ps = leadPoints(rows), lag = lagOf(ps), pad = compact ? { l: 2, r: 2, t: 4, b: 4 } : { l: 8, r: 44, t: 28, b: 24 };
  const max = Math.max(0.05, ...ps.flatMap(p => [p.v ?? 0, p.r ?? 0])), n = Math.max(1, ps.length - 1);
  const x = (i: number) => pad.l + (i / n) * (width - pad.l - pad.r), y = (v: number) => height - pad.b - (v / max) * (height - pad.t - pad.b);
  const both = ps.map((p, i) => ({ i, p })).filter(o => o.p.v != null && o.p.r != null);
  const areas = gapAreas(both.map(o => ({ x: x(o.i), v: y(o.p.v!), r: y(o.p.r!) })));
  const seg = (key: "v" | "r") => ps.map((p, i) => ({ p, i })).filter(o => o.p[key] != null).slice(1).map((o, k, all) => { const prev = k ? all[k - 1]! : ps.map((p, i) => ({ p, i })).filter(z => z.p[key] != null)[0]!; return { a: prev, b: o, thin: key === "v" && (o.p.thin || prev.p.thin) }; });
  const at = (q: string | null) => (q ? ps.findIndex(p => p.quarter === q) : -1);
  return <>
    {!compact && <line x1={pad.l} x2={width - pad.r} y1={height - pad.b} y2={height - pad.b} className="tk-svg-axis" aria-hidden="true" />}
    {areas.map((a, i) => <polygon key={i} points={a.points.map(p => p.join(",")).join(" ")} fill={a.ahead ? GREEN : PINK} aria-hidden="true" data-gap={a.ahead ? "ahead" : "behind"} />)}
    {seg("r").map((s, i) => <line key={`r${i}`} x1={x(s.a.i)} y1={y(s.a.p.r!)} x2={x(s.b.i)} y2={y(s.b.p.r!)} stroke={MUTED} strokeWidth={lw(compact ? 1 : 1.5)} aria-hidden="true" />)}
    {seg("v").map((s, i) => <line key={`v${i}`} x1={x(s.a.i)} y1={y(s.a.p.v!)} x2={x(s.b.i)} y2={y(s.b.p.v!)} stroke={INK} strokeWidth={lw(compact ? 1.25 : 2)} strokeDasharray={s.thin ? "2 3" : undefined} aria-hidden="true" data-thin={s.thin ? "" : undefined} />)}
    {!compact && lag && (() => { const a = at(lag.vanAt), b = lag.kind === "not-yet" ? -1 : at(lag.restAt), yy = y(lag.level), x0 = a >= 0 ? x(a) : x(0), x1 = b >= 0 ? x(b) : width - pad.r;
      const label = lag.kind === "not-yet" ? "not yet" : lagText(lag), tx = Math.min(width - pad.r - label.length * 6.6, Math.max(pad.l, (x0 + x1) / 2 - label.length * 3.3));
      return <g aria-hidden="true" data-lag={lag.kind}>
        <line x1={x0} x2={x1} y1={yy} y2={yy} stroke={INK} strokeWidth={1} strokeDasharray={lag.kind === "not-yet" ? "4 3" : undefined} />
        <line x1={x0} x2={x0} y1={yy - 5} y2={yy + 5} stroke={INK} />{lag.kind !== "not-yet" && <line x1={x1} x2={x1} y1={yy - 5} y2={yy + 5} stroke={INK} />}
        <text x={tx} y={Math.max(12, yy - 8)} className="tk-svg-text" style={{ fill: INK }}>{label}</text>
      </g>; })()}
    {!compact && <><text x={width - pad.r + 6} y={pad.t + 4} className="tk-svg-text tk-svg-muted" aria-hidden="true">{Math.round(max * 100)}%</text>
      <text x={pad.l} y={height - 6} className="tk-svg-text tk-svg-muted" aria-hidden="true">{ps[0] ? quarterText(ps[0].quarter) : ""}</text>
      <text x={width - pad.r} y={height - 6} textAnchor="end" className="tk-svg-text tk-svg-muted" aria-hidden="true">{ps.at(-1) ? quarterText(ps.at(-1)!.quarter) : ""}</text></>}
    {!compact && ps.map((p, i) => p.v != null ? <circle key={i} cx={x(i)} cy={y(p.v)} r={pt(1.5)} fill={INK} aria-hidden="true" /> : null)}
  </>;
}
export function LeadLag({ rows, name, title, note = LEAD_HOW, source, look = "read" }: { rows: readonly LeadRow[]; name: string; title: string; note?: string; source: string; look?: Look }) {
  const [ref, width] = useChartWidth<HTMLDivElement>(), height = width < 600 ? 220 : 280;
  const ps = leadPoints(rows), lag = lagOf(ps), t = leadTable(rows), thin = ps.some(p => p.thin);
  const n = Math.max(1, ps.length - 1), max = Math.max(0.05, ...ps.flatMap(p => [p.v ?? 0, p.r ?? 0]));
  const points = ps.map((p, i) => ({ x: 8 + (i / n) * (width - 52), y: height - 24 - ((p.v ?? p.r ?? 0) / max) * (height - 52), period: name, lines: leadLine(p, quarterText(p.quarter)).split(" · ") }));
  const alt = `${title}. ${lag ? `Measured lag: ${lagText(lag)}.` : ""} Latest: ${ps.at(-1) ? leadLine(ps.at(-1)!, quarterText(ps.at(-1)!.quarter)) : "no reading"}.`;
  return <figure className="min-w-0" data-chart="lead-lag" data-look={look}>
    <h3 className={look === "data" ? "tk-t-label" : "ed-kicker"}>{title}</h3>
    <p className={look === "data" ? "tk-t-caption tk-c-muted" : "ed-small mt-1"}>{note}</p>
    <div ref={ref} className="mt-3 w-full" style={{ minHeight: height }}>
      <ChartInteraction label={title} points={points} width={width} height={height}>
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} className="tk-svg block" role="img" aria-label={alt}><LeadLagDrawing rows={rows} width={width} height={height} /></svg>
      </ChartInteraction>
    </div>
    <ChartTable caption={`${title}: both groups by quarter`} columns={t.columns} rows={t.rows} />
    <figcaption className={look === "data" ? "tk-t-caption tk-c-muted mt-1" : "ed-caption mt-2"}>Source: {source}.{thin ? ` Dotted: fewer than ${LEAD_FLOOR} vanguard brands read that quarter.` : ""}</figcaption>
  </figure>;
}
/** The small lead-and-lag in a table row (the held study's ranking). */
export const LeadLagSpark = ({ rows, label }: { rows: readonly LeadRow[]; label: string }) =>
  <svg viewBox="0 0 120 28" width="120" height="28" role="img" aria-label={label} data-chart="lead-lag-spark"><LeadLagDrawing rows={rows} width={120} height={28} compact /></svg>;
