// DATA STORY FIGURES — the six template views, drawn on theme tokens. A figure renders its model at one view state (highlight, focus,
// side) and nothing else; captures are redrawn from their stored skeletons in their own colours (real hexes are data, not chrome).
import { useEffect, useId, useState, type ReactNode } from "react";
import type { AdoptionFig, BeforeAfterFig, DriftFig, FieldFig, Figure, Frame, MultiplesFig, StripFig, View } from "@/lib/data-stories/types";
import { familyName } from "@/lib/data-stories/templates/drift";
import { pctText, qText, dayText, pairStamps } from "@/lib/data-stories/text";
import { linear, ticks } from "@/lib/charts/scale";
import { ChartFrame } from "@/components/charts/Charts";
import { Receipt } from "@/components/read/StoryCard";

const INK_ = "var(--tk-text-primary)";
// Highlighting (README "Colour"): pink belongs to the lead plate only, so a highlighted mark stays ink with the yellow highlighter
// laid behind it, and rising values are drawn green.
const HL = "var(--tk-highlight-bg)", POS = "var(--tk-positive)";
const hlText = { background: HL, color: INK_ } as const;
const hlSvgText = { fill: INK_, stroke: HL, strokeWidth: 8, paintOrder: "stroke", strokeLinejoin: "round" } as const;
const hlMark = { stroke: HL, strokeWidth: 6, paintOrder: "stroke" } as const;
const INK = "var(--tk-text-primary)", MUTED = "var(--tk-text-muted)", RULE = "var(--tk-rule-hairline)", PAGE = "var(--tk-surface-page)";
const SOURCE = "Stored library captures and archive history";
const fade = "transition-opacity duration-300 motion-reduce:transition-none";

/** `pair`: a before/after shown as two captures side by side (each at most 520 px), the slider wiping the before over the after. */
export function FigureView({ fig, view, live = false, pair = false }: { fig: Figure; view: View; live?: boolean; pair?: boolean }) {
  switch (fig.kind) {
    case "multiples": return <Multiples f={fig} v={view} />;
    case "adoption": return <Adoption f={fig} v={view} />;
    case "field": return <Field f={fig} v={view} />;
    case "drift": return <Drift f={fig} v={view} />;
    case "before-after": return <BeforeAfter f={fig} v={view} live={live} pair={pair} />;
    case "strip": return <Strip f={fig} v={view} live={live} />;
  }
}

// SMALL MULTIPLES ---------------------------------------------------------------------------------
function Multiples({ f, v }: { f: MultiplesFig; v: View }) {
  const on = new Set(v.highlight), any = on.size > 0, fmt = (y: number) => (f.unit === "share" ? pctText(y) : String(y));
  const W = 200, H = 110, m = { l: 6, r: 6, t: 8, b: 18 }, sy = linear([0, f.yMax], [H - m.b, m.t]);
  const sx = (x: string) => (f.xs.length < 2 ? W / 2 : m.l + (f.xs.indexOf(x) / (f.xs.length - 1)) * (W - m.l - m.r));
  const bw = Math.max(2, (W - m.l - m.r) / Math.max(1, f.xs.length) - 3);
  const bx = (x: string) => m.l + f.xs.indexOf(x) * ((W - m.l - m.r) / Math.max(1, f.xs.length));
  return <ChartFrame level={2} title={f.title} note={f.note} source={SOURCE} isEmpty={!f.panels.length} table={{ columns: ["Panel", ...f.xs.map(x => (/Q/.test(x) ? qText(x) : x))], rows: f.panels.map(p => [p.label, ...f.xs.map(x => { const pt = p.points.find(q => q.x === x); return pt ? fmt(pt.y) : "—"; })]) }}>
    {() => <ul className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 xl:grid-cols-4" data-figure="multiples">
      {f.panels.map(p => { const hot = on.has(p.id), dim = any && !hot; const a = p.points[0], z = p.points.at(-1);
        return <li key={p.id} className={`${fade} min-w-0 ${dim ? "opacity-40" : ""}`} data-panel={p.id} data-hot={hot ? "" : undefined}>
          <p className="tk-t-data flex justify-between gap-2"><Receipt href={p.href} className="tk-tap min-h-0 truncate underline-offset-2 hover:underline" style={hot ? hlText : undefined}>{p.label}</Receipt>{f.unit === "share" && z && <span className="tk-c-secondary">{fmt(z.y)}</span>}</p>
          <svg viewBox={`0 0 ${W} ${H}`} className="tk-svg" aria-hidden="true">
            <line x1={m.l} x2={W - m.r} y1={H - m.b} y2={H - m.b} className="tk-svg-axis" />
            {f.chart === "line" ? <>
              {hot && <polyline fill="none" stroke={HL} strokeWidth={9} strokeLinejoin="round" strokeLinecap="round" points={p.points.map(q => `${sx(q.x)},${sy(q.y)}`).join(" ")} data-highlighter="" />}
              <polyline fill="none" stroke={hot && a && z && z.y > a.y ? POS : INK} strokeWidth={hot ? 2.5 : 1.5} points={p.points.map(q => `${sx(q.x)},${sy(q.y)}`).join(" ")} />
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

// ADOPTION TIMELINE ---------------------------------------------------------------------------------
function Adoption({ f, v }: { f: AdoptionFig; v: View }) {
  const on = new Set(v.highlight), any = on.size > 0, W = 420, PER = 8, S = 7, G = 2, colW = (W - 40) / Math.max(1, f.quarters.length);
  const cols = f.quarters.map(q => f.adopters.filter(a => a.first === q));
  const rows = Math.max(1, ...cols.map(c => Math.ceil(c.length / PER))), top = 70, H = top + rows * (S + G) + 30;
  const sy = linear([0, Math.max(0.05, ...f.share.map(p => p.y))], [top - 12, 14]), cx = (k: number) => 40 + k * colW + colW / 2;
  const stage = f.adopters.filter(a => on.has(a.domain)).slice(0, 6);
  return <ChartFrame level={2} title={f.title} note={f.note} source={SOURCE} receipt={{ href: f.signal.href, label: f.signal.name }} isEmpty={!f.adopters.length}
    table={{ columns: ["Brand", "First seen", "Start known", "Still shows it"], rows: f.adopters.map(a => [a.name, qText(a.first), a.censored ? "No (already there)" : "Yes", a.dropped ? "No" : "Yes"]) }}>
    {ids => <div data-figure="adoption">
      <svg viewBox={`0 0 ${W} ${H}`} className="tk-svg" role="img" aria-labelledby={ids.title} aria-describedby={ids.note}>
        <polyline fill="none" stroke={INK} strokeWidth={1.5} points={f.share.map(p => `${cx(f.quarters.indexOf(p.x))},${sy(p.y)}`).join(" ")} />
        {f.share.map(p => { const k = f.quarters.indexOf(p.x), hot = v.focus === p.x; return <g key={p.x}><circle cx={cx(k)} cy={sy(p.y)} r={hot ? 4 : 2.5} fill={INK} style={hot ? hlMark : undefined} /><text x={cx(k)} y={sy(p.y) - 7} textAnchor="middle" className="tk-svg-text" style={hot ? hlSvgText : undefined}>{pctText(p.y)}</text></g>; })}
        {cols.map((c, k) => <g key={k}>
          {c.map((a, j) => { const hot = on.has(a.domain), x = cx(k) - (PER * (S + G)) / 2 + (j % PER) * (S + G), y = top + Math.floor(j / PER) * (S + G);
            return <rect key={a.domain} x={x} y={y} width={S} height={S} className={fade} fill={a.censored || a.dropped ? "none" : hot ? POS : INK} stroke={hot ? HL : a.censored || a.dropped ? MUTED : "none"} strokeWidth={hot ? 4 : 1} paintOrder="stroke" opacity={any && !hot ? 0.3 : 1}><title>{`${a.name} · first seen ${qText(a.first)}${a.censored ? " (already there)" : ""}${a.dropped ? " · since dropped" : ""}`}</title></rect>; })}
          <text x={cx(k)} y={H - 8} textAnchor="middle" className="tk-svg-text tk-svg-muted" style={v.focus === f.quarters[k] ? hlSvgText : undefined}>{qText(f.quarters[k]!)}</text>
        </g>)}
      </svg>
      <p className="tk-t-caption tk-c-muted mt-2">Filled: first seen that quarter · outlined: already there in a first capture, or since dropped · {f.never} of {f.total} never shown</p>
      {stage.length > 0 && <ul className="mt-2 flex flex-wrap gap-2" aria-label="On stage">{stage.map(a => <li key={a.domain}><Receipt href={a.href} className="tk-chip tk-tap border px-2" style={{ borderColor: INK, background: HL }}>{a.name}</Receipt></li>)}</ul>}
    </div>}
  </ChartFrame>;
}

// BRAND FIELD ---------------------------------------------------------------------------------------
function Field({ f, v }: { f: FieldFig; v: View }) {
  const on = new Set(v.highlight), any = on.size > 0, W = 420, H = 300, m = { l: 44, r: 12, t: 14, b: 36 };
  const xs = f.points.map(p => p.x), ys = f.points.map(p => p.y), y0 = Math.min(...ys, f.centre.y), y1 = Math.max(...ys, f.centre.y);
  const sx = linear([Math.min(...xs, f.centre.x), Math.max(...xs, f.centre.x)], [m.l, W - m.r]), sy = linear([y0, y1], [H - m.b, m.t]);
  const fx = (n: number) => (f.axes.x.unit === "px" ? `${Math.round(n)}px` : pctText(n)), fy = (n: number) => (f.axes.y.unit === "px" ? `${Math.round(n)}px` : `${Math.round(n * 100)}%`);
  const ext = new Map(f.extremes.map(e => [e.domain, e.label]));
  const labelled = new Set([...f.points.filter(p => on.has(p.domain)).slice(0, 4).map(p => p.domain), ...(any ? [] : f.extremes.map(e => e.domain))]);
  return <ChartFrame level={2} title={f.title} note={f.note} source={SOURCE} isEmpty={!f.points.length} table={{ columns: ["Brand", f.axes.x.label, f.axes.y.label, "Note"], rows: f.points.map(p => [p.name, fx(p.x), fy(p.y), ext.get(p.domain) ?? ""]) }}>
    {ids => <div data-figure="field"><svg viewBox={`0 0 ${W} ${H}`} className="tk-svg" role="group" aria-labelledby={ids.title} aria-describedby={ids.note}>
      {f.points.length > 0 && <>
        {ticks(y0, y1, 4).map(t => <g key={t} aria-hidden="true"><line x1={m.l} x2={W - m.r} y1={sy(t)} y2={sy(t)} className="tk-svg-grid" /><text x={m.l - 6} y={sy(t) + 4} textAnchor="end" className="tk-svg-text tk-svg-muted">{fy(t)}</text></g>)}
        <line x1={m.l} x2={W - m.r} y1={H - m.b} y2={H - m.b} className="tk-svg-axis" />
        <text x={W - m.r} y={H - 8} textAnchor="end" className="tk-svg-text tk-svg-muted">{f.axes.x.label} →</text>
        <text x={m.l} y={m.t - 2} className="tk-svg-text tk-svg-muted">↑ {f.axes.y.label}</text>
        <line x1={sx(f.centre.x)} x2={sx(f.centre.x)} y1={m.t} y2={H - m.b} stroke={v.focus === "centre" ? INK : MUTED} strokeDasharray="3 3" />
        <line x1={m.l} x2={W - m.r} y1={sy(f.centre.y)} y2={sy(f.centre.y)} stroke={v.focus === "centre" ? INK : MUTED} strokeDasharray="3 3" />
        <text x={sx(f.centre.x) + (sx(f.centre.x) > W / 2 ? -4 : 4)} y={H - m.b - 4} textAnchor={sx(f.centre.x) > W / 2 ? "end" : "start"} className="tk-svg-text tk-svg-muted">Sector centre {fx(f.centre.x)} · {fy(f.centre.y)}</text>
        {f.points.map(p => { const hot = on.has(p.domain), px = sx(p.x), py = sy(p.y), right = px < W - 120;
          return <g key={p.domain} tabIndex={0} role="img" aria-label={`${p.name}: ${f.axes.x.label} ${fx(p.x)}, ${f.axes.y.label} ${fy(p.y)}`} className={`tk-mark ${fade}`} opacity={any && !hot ? 0.35 : 1}>
            <circle cx={px} cy={py} r={hot ? 5 : 3.5} fill={INK} style={hot ? hlMark : undefined} className="tk-svg-dot" />
            {labelled.has(p.domain) ? <text x={px + (right ? 7 : -7)} y={py + 4} textAnchor={right ? "start" : "end"} className="tk-svg-text" style={hot ? hlSvgText : undefined}>{p.name}</text>
              : <text x={Math.min(px + 8, W - 4)} y={Math.max(12, py - 8)} textAnchor={px > W - 120 ? "end" : "start"} className="tk-svg-text tk-tip" aria-hidden="true">{p.name}</text>}
          </g>; })}
      </>}
    </svg>
    <dl className="tk-t-caption tk-c-muted mt-2 grid gap-1 sm:grid-cols-2"><div><dt className="inline font-semibold">Across · {f.axes.x.label}: </dt><dd className="inline">{f.axes.x.measure}</dd></div><div><dt className="inline font-semibold">Up · {f.axes.y.label}: </dt><dd className="inline">{f.axes.y.measure}</dd></div></dl>{f.missing > 0 && <p className="tk-t-caption tk-c-muted mt-1">{f.missing} brands without both measures are not placed.</p>}
    </div>}
  </ChartFrame>;
}

// PALETTE DRIFT ------------------------------------------------------------------------------------
function Drift({ f, v }: { f: DriftFig; v: View }) {
  const on = new Set(v.highlight), any = on.size > 0;
  return <ChartFrame level={2} title={f.title} note={f.note} source={SOURCE} isEmpty={!f.bands.length} table={{ columns: ["Quarter", "Brands", "Colours (share of first screens)"], rows: f.bands.map(b => [qText(b.q), b.brands, b.swatches.map(s => `${familyName(s.id)} ${s.hex} ${pctText(s.w)}`).join("; ")]) }}>
    {() => <ol className="grid gap-2" data-figure="drift">{f.bands.map(b => { const total = b.swatches.reduce((a, s) => a + s.w, 0) || 1, hot = v.focus === b.q;
      return <li key={b.q} className="grid grid-cols-[9ch_1fr] items-center gap-2">
        <span className="tk-t-data" style={hot ? hlText : undefined}>{qText(b.q)}</span>
        <span className="flex h-8 w-full overflow-hidden border" style={{ borderColor: hot ? INK : RULE }} aria-hidden="true">
          {b.swatches.map(s => <span key={s.id} title={`${familyName(s.id)} ${s.hex} · ${pctText(s.w)}`} className={fade} style={{ width: `${(100 * s.w) / total}%`, background: s.hex, opacity: any && !on.has(s.id) ? 0.25 : 1, outline: on.has(s.id) ? `2px solid ${INK}` : undefined, outlineOffset: -2 }} />)}
        </span>
      </li>; })}</ol>}
  </ChartFrame>;
}

// CAPTURES ------------------------------------------------------------------------------------------
/** One capture redrawn: boxes from the stored skeleton, in the capture's own background, ink and accent. Upgrades to the crop when present. */
export function CaptureFrame({ fr, label, slim = false, className = "" }: { fr: Frame; label: string; slim?: boolean; className?: string }) {
  if (fr.crop && !slim) return <img src={fr.crop.src} width={fr.crop.width} height={fr.crop.height} alt={fr.crop.alt} className={`block h-auto w-full border ${className}`} style={{ borderColor: RULE }} loading="lazy" decoding="async" data-frame="crop" />;
  const bg = fr.bg ?? PAGE, ink = fr.ink ?? INK, acc = fr.accent ?? ink, tone = fr.tones.find(t => t !== fr.bg && t !== fr.ink) ?? ink;
  const boxes = slim ? fr.boxes.filter(b => b[0] === "h" || b[0] === "m" || b[0] === "c") : fr.boxes;
  return <svg viewBox={`0 0 ${fr.w} ${fr.h}`} className={`block h-auto w-full border ${className}`} style={{ borderColor: RULE }} role="img" aria-label={`${label}: redrawn from the stored layout, no screenshot`} data-frame="skeleton" preserveAspectRatio="xMidYMin meet">
    <rect width={fr.w} height={fr.h} style={{ fill: bg }} />
    {boxes.map((b, k) => { const [t, x, y, w, h] = b;
      if (t === "s") return <rect key={k} x={x} y={y} width={w} height={h} fill="none" style={{ stroke: ink }} strokeOpacity={0.12} strokeWidth={2} />;
      if (t === "h") return <rect key={k} x={x} y={y} width={w} height={h} style={{ fill: ink }} opacity={0.9} />;
      if (t === "t") { const n = Math.min(6, Math.max(1, Math.round(h / 22)));
        return <g key={k} style={{ stroke: ink }} strokeOpacity={0.45} strokeWidth={Math.max(2, Math.min(8, h / 6))}>{Array.from({ length: n }, (_, j) => <line key={j} x1={x} x2={x + w * (j === n - 1 && n > 1 ? 0.6 : 1)} y1={y + (h / n) * (j + 0.5)} y2={y + (h / n) * (j + 0.5)} />)}</g>; }
      if (t === "c") return <rect key={k} x={x} y={y} width={w} height={h} style={{ fill: acc }} />;
      if (t === "m") return <g key={k}><rect x={x} y={y} width={w} height={h} style={{ fill: tone }} opacity={0.18} /><path d={`M${x},${y} L${x + w},${y + h} M${x + w},${y} L${x},${y + h}`} style={{ stroke: ink }} strokeOpacity={0.25} strokeWidth={2} /></g>;
      return <rect key={k} x={x} y={y} width={w} height={h} fill="none" style={{ stroke: ink }} strokeOpacity={0.2} strokeWidth={2} />;
    })}
  </svg>;
}
const Swatches = ({ fr }: { fr: Frame }) => <span className="inline-flex gap-1" aria-hidden="true">{[fr.bg, fr.ink, fr.accent].filter((x): x is string => !!x).map((h, k) => <span key={k} className="ed-swatch inline-block h-3 w-3 border" style={{ background: h, borderColor: RULE }} title={h} />)}</span>;
const frameCaption = (fr: Frame, stamp = dayText(fr.at)) => `${stamp} · ${fr.source === "live" ? "live crawl" : "Wayback archive"}${fr.crop ? " · crop" : " · redrawn layout"}`;

// BEFORE AND AFTER -----------------------------------------------------------------------------------
const SIDE_POS = { before: 100, after: 0, split: 50 } as const;
function BeforeAfter({ f, v, live, pair = false }: { f: BeforeAfterFig; v: View; live: boolean; pair?: boolean }) {
  const start = pair ? SIDE_POS.after : SIDE_POS[v.side ?? "split"], [bStamp, aStamp] = pairStamps(f.before.at, f.after.at);
  const id = useId(), [pos, setPos] = useState<number>(start);
  useEffect(() => { setPos(start); }, [start]);
  const wipe = <><div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}><CaptureFrame fr={f.before} label={`${f.name}, ${bStamp}`} /></div>
    {pos > 0 && pos < 100 && <span className="absolute inset-y-0 w-0.5" style={{ left: `${pos}%`, background: INK }} />}</>;
  const on = new Set(v.highlight);
  return <ChartFrame level={2} title={f.title} note={f.note} source={SOURCE} receipt={{ href: f.href, label: f.name }} isEmpty={false} table={{ columns: ["Field", "Before", "After"], rows: f.diffs.map(d => [d.field, d.before, d.after]) }}>
    {() => <div data-figure="before-after" data-pos={pos} data-layout={pair ? "pair" : "wipe"}>
      {pair ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <figure className="m-0 min-w-0 max-w-[520px]"><CaptureFrame fr={f.before} label={`${f.name}, ${bStamp}`} />
          <figcaption className="tk-t-caption tk-c-muted mt-2 inline-flex items-center gap-2"><Swatches fr={f.before} />Before · {frameCaption(f.before, bStamp)}</figcaption></figure>
        <figure className="m-0 min-w-0 max-w-[520px]"><div className="relative"><CaptureFrame fr={f.after} label={`${f.name}, ${aStamp}`} />{wipe}</div>
          <figcaption className="tk-t-caption tk-c-muted mt-2 inline-flex items-center gap-2"><Swatches fr={f.after} />After · {frameCaption(f.after, aStamp)}{pos > 0 && <span>· before laid over {pos}%</span>}</figcaption></figure>
      </div> : <>
        <div className="relative" aria-hidden={live ? undefined : true}>
          <CaptureFrame fr={f.after} label={`${f.name}, ${aStamp}`} />{wipe}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="tk-t-caption tk-c-muted inline-flex items-center gap-2"><Swatches fr={f.before} />Before · {frameCaption(f.before, bStamp)}</span>
          <span className="tk-t-caption tk-c-muted inline-flex items-center gap-2"><Swatches fr={f.after} />After · {frameCaption(f.after, aStamp)}</span>
        </div>
      </>}
      {live && <div className={`no-print mt-2 flex flex-wrap items-center gap-2 ${pair ? "max-w-[1064px]" : ""}`}>
        <label htmlFor={`${id}-r`} className="sr-only">{pair ? "Slide the before capture over the after one" : "Slide between before and after"}</label>
        <button type="button" className="tk-btn tk-t-kicker" data-variant="secondary" aria-pressed={pos === 100} onClick={() => setPos(100)}>Before · {dayText(f.before.at)}</button>
        <input id={`${id}-r`} type="range" min={0} max={100} step={5} value={pos} onChange={e => setPos(Number(e.target.value))} className="min-h-11 min-w-0 flex-1" style={{ accentColor: INK }} aria-valuetext={pos === 100 ? "All before" : pos === 0 ? "All after" : `${pos}% before`} />
        <button type="button" className="tk-btn tk-t-kicker" data-variant="secondary" aria-pressed={pos === 0} onClick={() => setPos(0)}>After · {dayText(f.after.at)}</button>
      </div>}
      {f.diffs.length > 0 ? <table className="tk-t-data mt-3 w-full border-collapse text-left"><caption className="tk-t-caption tk-c-muted text-left">Measured differences</caption>
        <thead><tr className="tk-c-muted"><th scope="col" className="py-1 font-normal">Field</th><th scope="col" className="py-1 font-normal">Before</th><th scope="col" className="py-1 font-normal">After</th></tr></thead>
        <tbody>{f.diffs.map(d => <tr key={d.field} className="border-t" style={{ borderColor: RULE, ...(on.has(d.field) ? hlText : {}) }}><th scope="row" className="py-1 pr-2 font-normal">{d.field}</th><td className="py-1 pr-2">{d.before}</td><td className="py-1">{d.after}</td></tr>)}</tbody></table>
        : <p className="tk-t-caption tk-c-muted mt-3">The compared fields measure the same.</p>}
    </div>}
  </ChartFrame>;
}

// THE STRIP -----------------------------------------------------------------------------------------
export const STRIP_TICK_MS = 1400;
function Strip({ f, v, live }: { f: StripFig; v: View; live: boolean }) {
  const start = Math.max(0, f.frames.findIndex(x => x.id === v.focus)), [k, setK] = useState(start), [play, setPlay] = useState(false);
  useEffect(() => { setK(start); setPlay(false); }, [start]);
  useEffect(() => { if (!play) return; const t = setInterval(() => setK(x => (x + 1 >= f.frames.length ? (setPlay(false), x) : x + 1)), STRIP_TICK_MS); return () => clearInterval(t); }, [play, f.frames.length]);
  const cur = f.frames[k], on = new Set(v.highlight), markAt = new Map(f.marks.filter(m => m.after).map(m => [m.after!, m]));
  return <ChartFrame level={2} title={f.title} note={f.note} source={SOURCE} receipt={{ href: f.href, label: f.name }} isEmpty={!f.frames.length} table={{ columns: ["Capture", "Source", "Changes marked"], rows: f.frames.map(fr => [dayText(fr.at), fr.source, f.marks.filter(m => m.after === fr.id).map(m => m.label).join("; ") || "—"]) }}>
    {() => <div data-figure="strip" data-frame-index={k}>
      {cur && <div className="strip-current mx-auto max-w-[520px]"><CaptureFrame fr={cur} label={`${f.name}, ${dayText(cur.at)}`} />
        <p className="tk-t-caption tk-c-muted mt-1 flex flex-wrap items-center gap-2"><Swatches fr={cur} />{k + 1} of {f.frames.length} · {frameCaption(cur)}{markAt.get(cur.id) && <span style={hlText}>· {markAt.get(cur.id)!.label}</span>}</p></div>}
      <ol className="mt-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(f.frames.length, 16)}, minmax(0, 1fr))` }} aria-label="Captures">
        {f.frames.map((fr, j) => { const mk = markAt.get(fr.id), hot = j === k;
          return <li key={fr.id} className="min-w-0">
            {live ? <button type="button" onClick={() => { setPlay(false); setK(j); }} aria-current={hot ? "true" : undefined} aria-label={`${dayText(fr.at)}${mk ? `, ${mk.label}` : ""}`} className="block min-h-11 w-full cursor-pointer border-b-2 pb-1" style={{ borderColor: hot ? INK : mk && on.has(mk.id) ? HL : "transparent" }}>
              <CaptureFrame fr={fr} label={dayText(fr.at)} slim /></button>
              : <div className="border-b-2 pb-1" style={{ borderColor: hot ? INK : "transparent" }}><CaptureFrame fr={fr} label={dayText(fr.at)} slim /></div>}
            <span className="block h-2" aria-hidden="true">{mk && <span className="mx-auto block h-2 w-2" style={{ background: on.has(mk.id) || hot ? INK : MUTED }} />}</span>
          </li>; })}
      </ol>
      {live && <div className="no-print mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className="tk-btn tk-t-kicker" data-variant="secondary" onClick={() => { setPlay(false); setK(x => Math.max(0, x - 1)); }} disabled={k === 0}>← Earlier</button>
        <button type="button" className="tk-btn tk-t-kicker" data-variant="secondary" aria-pressed={play} onClick={() => { if (k >= f.frames.length - 1) setK(0); setPlay(p => !p); }}>{play ? "Pause" : "Play"}</button>
        <button type="button" className="tk-btn tk-t-kicker" data-variant="secondary" onClick={() => { setPlay(false); setK(x => Math.min(f.frames.length - 1, x + 1)); }} disabled={k >= f.frames.length - 1}>Later →</button>
      </div>}
    </div>}
  </ChartFrame>;
}
export const FigureNote = ({ children }: { children: ReactNode }) => <p className="tk-t-caption tk-c-muted mt-2">{children}</p>;
