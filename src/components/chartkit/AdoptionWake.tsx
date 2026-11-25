// B2 · PROPOSED FORM "adoption-wake" (src/lib/chart/forms.ts): who went first, and how big the crowd that followed was. One dot per
// adopter at the quarter it first showed the trait (vanguard filled ink with a paper ring, others outlined, a slash for brands that
// later dropped it), an "already there" hatched column at the left, and the share of read homepages as a quiet line on a right axis.
// No reader page imports this file until the owner accepts the form and a gated build makes it live.
import { useId } from "react";
import type { AdoptionFig } from "@/lib/data-stories/types";
import { pctText, quarterText } from "@/lib/labels";
import { ChartInteraction } from "./Interaction";
import { ChartTable } from "./ChartTable";
import { INK, MUTED, PAGE, RULE, lw } from "./ink";
import { useChartWidth } from "./useChartWidth";
import { seasonOf, wakeDotLine, wakeLayout, wakeOrder, wakeTicks, type WakeLayout } from "./wake-layout";
import type { Look } from "./QuarterLine";

export const WAKE_HOW = "Each dot is a brand, placed at the quarter it first showed this; filled dots are the vanguard. The line is the share of all homepages slug reads.";
export function wakeTable(fig: AdoptionFig, vanguard: ReadonlySet<string>) {
  return { columns: ["Brand", "First seen", "Vanguard", "Still there"], rows: fig.adopters.map(a => [a.name, a.censored ? "Already there at its first capture" : quarterText(a.first), vanguard.has(a.domain) ? "Yes" : "No", a.dropped ? "No" : "Yes"]) };
}
function Drawing({ l, id }: { l: WakeLayout; id: string }) {
  const base = l.plot.t + (l.height - l.plot.t - l.plot.b), a = l.columns[0]!;
  const path = l.line.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("");
  return <>
    <defs><pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke={RULE} strokeWidth="1.5" /></pattern></defs>
    <rect x={a.x} y={l.plot.t} width={a.w - 2} height={base - l.plot.t} fill={`url(#${id})`} aria-hidden="true" />
    <text x={a.x + 2} y={l.plot.t - 8} className="tk-svg-text tk-svg-muted" aria-hidden="true">Already there</text>
    <line x1={l.plot.l} x2={l.width - l.plot.r} y1={base} y2={base} className="tk-svg-axis" aria-hidden="true" />
    {path && <path d={path} fill="none" stroke={MUTED} strokeWidth={lw(1.25)} aria-hidden="true" data-wake-share="" />}
    <text x={l.width - l.plot.r + 6} y={l.plot.t + 4} className="tk-svg-text tk-svg-muted" aria-hidden="true">{pctText(l.shareMax).replace(".0%", "%")}</text>
    <text x={l.width - l.plot.r + 6} y={base} className="tk-svg-text tk-svg-muted" aria-hidden="true">0%</text>
    {wakeTicks(l).map(t => <text key={t.key} x={t.x} y={base + 16} textAnchor="middle" className="tk-svg-text tk-svg-muted" aria-hidden="true">{t.text}</text>)}
    {l.dots.map(o => <g key={o.domain} aria-hidden="true" data-wake-dot={o.domain}>
      <circle cx={o.x} cy={o.y} r={o.r} fill={o.vanguard ? INK : PAGE} stroke={o.vanguard ? PAGE : INK} strokeWidth={1} />
      {o.vanguard && <circle cx={o.x} cy={o.y} r={o.r + 0.5} fill="none" stroke={INK} strokeWidth={0.5} />}
      {o.dropped && <line x1={o.x - o.r} y1={o.y + o.r} x2={o.x + o.r} y2={o.y - o.r} stroke={o.vanguard ? PAGE : INK} strokeWidth={1} />}
    </g>)}
    {l.labels.map(t => <text key={t.domain} x={t.x} y={t.y} className="tk-svg-text" style={{ fill: INK }} aria-hidden="true" data-wake-label="">{t.text}</text>)}
  </>;
}
export function AdoptionWake({ fig, vanguard, title, note = WAKE_HOW, source, look = "read" }: { fig: AdoptionFig; vanguard: ReadonlySet<string>; title: string; note?: string; source: string; look?: Look }) {
  const [ref, width] = useChartWidth<HTMLDivElement>(), id = useId().replace(/:/g, "");
  const l = wakeLayout(fig, vanguard, width), t = wakeTable(fig, vanguard);
  const points = [...wakeOrder(l).map(o => { const [what, ...rest] = wakeDotLine(o).split(" · "); return { x: o.x, y: o.y, period: what!, lines: rest }; }),
    ...l.line.map(p => ({ x: p.x, y: p.y, period: `${fig.signal.name} · ${quarterText(p.quarter)}`, lines: [pctText(p.share), ...(p.denom ? [`of ${p.denom} homepages`] : [])] }))];
  const dated = l.dated, first = fig.adopters.find(a => !a.censored);
  const alt = `${title}. ${dated} brands first showed it in a dated quarter${first ? `, ${first.name} first (${seasonOf(first.first)})` : ""}; ${fig.adopters.length - dated} already had it at their first capture.`;
  return <figure className="min-w-0" data-chart="adoption-wake" data-look={look}>
    <h3 className={look === "data" ? "tk-t-label" : "ed-kicker"}>{title}</h3>
    <p className={look === "data" ? "tk-t-caption tk-c-muted" : "ed-small mt-1"}>{note}</p>
    <div ref={ref} className="mt-3 w-full" style={{ minHeight: l.height }}>
      <ChartInteraction label={title} points={points} width={l.width} height={l.height} spatial>
        <svg viewBox={`0 0 ${l.width} ${l.height}`} width="100%" height={l.height} className="tk-svg block" role="img" aria-label={alt}><Drawing l={l} id={`wake${id}`} /></svg>
      </ChartInteraction>
    </div>
    <ChartTable caption={`${title}: every adopter`} columns={t.columns} rows={t.rows} />
    <figcaption className={look === "data" ? "tk-t-caption tk-c-muted mt-1" : "ed-caption mt-2"}>Source: {source}</figcaption>
  </figure>;
}
