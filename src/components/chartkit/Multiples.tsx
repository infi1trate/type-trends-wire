// THE CHART KIT (U3) · small multiples: one panel per brand or sector, the same y scale, lines or bars by quarter. Read is the study
// figure; Data draws the same panels with thinner lines for the dense view. The table carries every value (labels.ts formats).
import type { MultiplesFig, View } from "@/lib/data-stories/types";
import { linear } from "@/lib/charts/scale";
import { pctText, quarterText as qText } from "@/lib/labels";
import { Receipt } from "@/components/read/StoryCard";
import { ChartFrame } from "./Frame";
import { FIGURE_SOURCE, HL, INK, MUTED, POS, fade, hlMark, hlText } from "./ink";
import type { Look } from "./QuarterLine";

// SMALL MULTIPLES ---------------------------------------------------------------------------------
export function SmallMultiples({ f, v, look = "read" }: { f: MultiplesFig; v: View; look?: Look }) {
  const on = new Set(v.highlight), any = on.size > 0, dense = look === "data", fmt = (y: number) => (f.unit === "share" ? pctText(y) : String(y));
  const W = 200, H = 110, m = { l: 6, r: 6, t: 8, b: 18 }, sy = linear([0, f.yMax], [H - m.b, m.t]);
  const sx = (x: string) => (f.xs.length < 2 ? W / 2 : m.l + (f.xs.indexOf(x) / (f.xs.length - 1)) * (W - m.l - m.r));
  const bw = Math.max(2, (W - m.l - m.r) / Math.max(1, f.xs.length) - 3);
  const bx = (x: string) => m.l + f.xs.indexOf(x) * ((W - m.l - m.r) / Math.max(1, f.xs.length));
  return <ChartFrame level={2} title={f.title} note={f.note} source={FIGURE_SOURCE} isEmpty={!f.panels.length} table={{ columns: ["Panel", ...f.xs.map(x => (/Q/.test(x) ? qText(x) : x))], rows: f.panels.map(p => [p.note ? `${p.label} (${p.note.toLowerCase()})` : p.label, ...f.xs.map(x => { const pt = p.points.find(q => q.x === x); return pt ? fmt(pt.y) : "—"; })]) }}>
    {() => <ul className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 xl:grid-cols-4" data-figure="multiples" data-look={look}>
      {f.panels.map(p => { const hot = on.has(p.id), dim = any && !hot; const a = p.points[0], z = p.points.at(-1);
        return <li key={p.id} className={`${fade} min-w-0 ${dim ? "opacity-40" : ""}`} data-panel={p.id} data-hot={hot ? "" : undefined}>
          <p className="tk-t-data flex justify-between gap-2"><Receipt href={p.href} drawer className="tk-tap min-h-0 truncate underline-offset-2 hover:underline" style={hot ? hlText : undefined}>{p.label}</Receipt>{f.unit === "share" && z && <span className="tk-c-secondary">{fmt(z.y)}</span>}</p>
          {p.note && <p className="tk-t-caption tk-c-muted" data-panel-note="">{p.note}</p>}
          <svg viewBox={`0 0 ${W} ${H}`} className="tk-svg" aria-hidden="true">
            <line x1={m.l} x2={W - m.r} y1={H - m.b} y2={H - m.b} className="tk-svg-axis" />
            {f.chart === "line" ? <>
              {hot && <polyline fill="none" stroke={HL} strokeWidth={9} strokeLinejoin="round" strokeLinecap="round" points={p.points.map(q => `${sx(q.x)},${sy(q.y)}`).join(" ")} data-highlighter="" />}
              <polyline fill="none" stroke={hot && a && z && z.y > a.y ? POS : INK} strokeWidth={hot ? 2.5 : dense ? 1 : 1.5} points={p.points.map(q => `${sx(q.x)},${sy(q.y)}`).join(" ")} />
              {p.points.map(q => <circle key={q.x} cx={sx(q.x)} cy={sy(q.y)} r={2.5} fill={INK} />)}
            </> : <>
              {p.points.map(q => <rect key={q.x} x={bx(q.x)} y={sy(q.y)} width={bw} height={Math.max(0, H - m.b - sy(q.y))} fill={INK} style={hot ? hlMark : undefined} />)}
              {(p.marks ?? []).filter(q => q.y > 0).map(q => <line key={q.x} x1={bx(q.x)} x2={bx(q.x) + bw} y1={sy(q.y)} y2={sy(q.y)} stroke={MUTED} strokeWidth={3} />)}
            </>}
            {a && <text x={m.l} y={H - 4} className="tk-svg-text tk-svg-muted">{/Q/.test(f.xs[0] ?? "") ? f.xs[0]!.slice(0, 4) : f.xs[0]}</text>}
            <text x={W - m.r} y={H - 4} textAnchor="end" className="tk-svg-text tk-svg-muted">{/Q/.test(f.xs.at(-1) ?? "") ? f.xs.at(-1)!.slice(0, 4) : f.xs.at(-1)}</text>
          </svg>
        </li>; })}
    </ul>}
  </ChartFrame>;
}

