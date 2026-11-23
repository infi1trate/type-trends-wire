// DATA STORY FIGURES — the six template views, drawn on theme tokens. A figure renders its model at one view state (highlight, focus,
// side) and nothing else; captures are redrawn from their stored skeletons in their own colours (real hexes are data, not chrome).
// U3: small multiples and the before-and-after strip are chart-kit components (src/components/chartkit), shared with the Data view;
// the three study-only views (adoption, field, drift) stay here and draw with the kit's frame and inks.
import type { ReactNode } from "react";
import type { AdoptionFig, DriftFig, DriftPair, FieldFig, Figure, View } from "@/lib/data-stories/types";
import { familyName } from "@/lib/data-stories/templates/drift";
import { pctText, quarterText as qText } from "@/lib/labels";
import { linear, ticks } from "@/lib/charts/scale";
import { ChartFrame, SmallMultiples, BeforeAfterStrip } from "@/components/chartkit";
import { FIGURE_SOURCE, HL, INK, MUTED, POS, RULE, fade, hlMark, hlSvgText, hlText } from "@/components/chartkit/ink";
import { Receipt } from "@/components/read/StoryCard";
export { CaptureFrame, STRIP_TICK_MS } from "@/components/chartkit/BeforeAfter";

/** `pair`: a before/after shown as two captures side by side (each at most 520 px), the slider wiping the before over the after. */
export function FigureView({ fig, view, live = false, pair = false }: { fig: Figure; view: View; live?: boolean; pair?: boolean }) {
  switch (fig.kind) {
    case "multiples": return <SmallMultiples f={fig} v={view} />;
    case "adoption": return <Adoption f={fig} v={view} />;
    case "field": return <Field f={fig} v={view} />;
    case "drift": return <Drift f={fig} v={view} />;
    case "before-after": case "strip": return <BeforeAfterStrip f={fig} v={view} live={live} pair={pair} />;
  }
}

// ADOPTION TIMELINE ---------------------------------------------------------------------------------
function Adoption({ f, v }: { f: AdoptionFig; v: View }) {
  const on = new Set(v.highlight), any = on.size > 0, W = 420, PER = 8, S = 7, G = 2, colW = (W - 40) / Math.max(1, f.quarters.length);
  const cols = f.quarters.map(q => f.adopters.filter(a => a.first === q));
  const rows = Math.max(1, ...cols.map(c => Math.ceil(c.length / PER))), top = 70, H = top + rows * (S + G) + 30;
  const sy = linear([0, Math.max(0.05, ...f.share.map(p => p.y))], [top - 12, 14]), cx = (k: number) => 40 + k * colW + colW / 2;
  const stage = f.adopters.filter(a => on.has(a.domain)).slice(0, 6);
  return <ChartFrame level={2} title={f.title} note={f.note} source={FIGURE_SOURCE} receipt={{ href: f.signal.href, label: f.signal.name }} isEmpty={!f.adopters.length}
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
  return <ChartFrame level={2} title={f.title} note={f.note} source={FIGURE_SOURCE} isEmpty={!f.points.length} table={{ columns: ["Brand", f.axes.x.label, f.axes.y.label, "Note"], rows: f.points.map(p => [p.name, fx(p.x), fy(p.y), ext.get(p.domain) ?? ""]) }}>
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
  return <ChartFrame level={2} title={f.title} note={f.note} source={FIGURE_SOURCE} isEmpty={!f.bands.length} table={{ columns: [f.rowHead ?? "Quarter", f.rowHead ? "Count" : "Brands", "Colours (share of first screens)"], rows: f.bands.map(b => [qText(b.q), b.brands, [b.swatches.map(s => s.label ?? `${familyName(s.id)} ${s.hex} ${pctText(s.w)}`).join("; "), b.note ?? "", ...(b.links?.length ? [b.links.map(l => l.label).join(", ")] : []), ...(b.pairs ?? []).map(pairText)].filter(Boolean).join(". ")]) }}>
    {() => <ol className="grid gap-2" data-figure="drift">{f.bands.map(b => { const total = b.swatches.reduce((a, s) => a + s.w, 0) || 1, hot = v.focus === b.q;
      return <li key={b.q} className={f.rowHead ? "grid grid-cols-1 items-center gap-1 sm:grid-cols-[16rem_1fr] sm:gap-2" : "grid grid-cols-[9ch_1fr] items-center gap-2"}>
        <span className="tk-t-data" style={hot ? hlText : undefined}>{qText(b.q)}</span>
        {b.cells ? <DriftCells cells={b.cells} lit={b.lit} hot={hot} />
          : <span className="flex h-8 w-full overflow-hidden border" style={{ borderColor: hot ? INK : RULE }} aria-hidden="true">
          {b.swatches.map(s => <span key={s.id} title={s.label ?? `${familyName(s.id)} ${s.hex} · ${pctText(s.w)}`} className={fade} style={{ width: `${(100 * s.w) / total}%`, background: s.hex, opacity: any && !on.has(s.id) ? 0.25 : 1, outline: on.has(s.id) ? `2px solid ${INK}` : undefined, outlineOffset: -2 }} />)}
        </span>}
        {b.note && <p className="tk-t-caption tk-c-muted" style={{ gridColumn: "1 / -1" }} data-band-note="">{b.note}</p>}
        {b.links?.length ? <p className="tk-t-caption" style={{ gridColumn: "1 / -1" }} data-band-links="">{b.links.map((l, k) => <span key={l.href}>{k ? " · " : ""}<a href={l.href} target="_blank" rel="noopener" className="underline underline-offset-2" style={{ color: INK }}>{l.label}</a></span>)}</p> : null}
        {b.pairs?.length ? <DriftPairs pairs={b.pairs} /> : null}
      </li>; })}</ol>}
  </ChartFrame>;
}
/** W3d · the strip as equal cells, one per item in its own measured hex (the icon wall): one row of 100 from 640 px, rows of 25 below;
 *  `lit` keeps cells [from, to) at full strength and fades the rest, as a highlighted swatch does. */
function DriftCells({ cells, lit, hot }: { cells: string[]; lit?: [number, number] | undefined; hot: boolean }) {
  return <span className="grid w-full overflow-hidden border grid-cols-[repeat(25,minmax(0,1fr))] sm:grid-cols-[repeat(100,minmax(0,1fr))]" style={{ borderColor: hot ? INK : RULE }} aria-hidden="true" data-cells={cells.length}>
    {cells.map((hex, k) => <span key={k} className={`block h-3 sm:h-8 ${fade}`} style={{ background: hex, opacity: lit && (k < lit[0] || k >= lit[1]) ? 0.25 : 1 }} />)}
  </span>;
}
/** W3c · a brand's accent beside the work that holds it: the two swatches, the share, the thumbnail (inside 64 px, sized before it
 *  loads) and the full credit, the title the only link to the museum's own page. */
const pairText = (p: DriftPair) => `${p.domain} ${p.brandHex} beside ${p.credit} (${p.workHex}, holds ${Math.round(p.share * 100)}% of the picture)`;
const chip = (hex: string) => <span className="inline-block h-3 w-3 border" style={{ background: hex, borderColor: RULE, flexShrink: 0 }} aria-hidden="true" />;
function DriftPairs({ pairs }: { pairs: DriftPair[] }) {
  return <ul className="grid gap-2 sm:grid-cols-3" style={{ gridColumn: "1 / -1" }} data-pairs="">{pairs.map(p => <li key={p.domain} className="flex min-w-0 gap-2" style={{ alignItems: "flex-start" }}>
    <span className="block" style={{ width: 64, flexShrink: 0 }}>{p.thumb ? <img src={p.thumb} width={p.width} height={p.height} loading="lazy" decoding="async" alt="" className="block border" style={{ width: p.width, height: p.height, borderColor: RULE }} /> : null}</span>
    <span className="tk-t-caption min-w-0" style={{ overflowWrap: "anywhere" }}>
      <span className="flex items-center gap-1">{chip(p.brandHex)}<Receipt href={p.brandHref} className="tk-tap">{p.domain}</Receipt></span>
      <span className="flex items-center gap-1">{chip(p.workHex)}<span>holds {Math.round(p.share * 100)}% of the picture</span></span>
      <span className="tk-c-muted">{p.artist ? `${p.artist.replace(/\.$/, "")}. ` : ""}<a href={p.href} target="_blank" rel="noopener" title={p.credit} className="underline underline-offset-2" style={{ color: INK }}>{p.title}</a>{p.date ? `, ${p.date}` : ""}. {p.museum}.</span>
    </span>
  </li>)}</ul>;
}

export const FigureNote = ({ children }: { children: ReactNode }) => <p className="tk-t-caption tk-c-muted mt-2">{children}</p>;
