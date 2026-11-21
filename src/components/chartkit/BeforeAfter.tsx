// THE CHART KIT (U3) · the before-and-after strip: two captures of one brand with a wipe between them (or side by side as a pair),
// and the strip of every capture with the changes marked. Captures are redrawn from their stored skeletons in their own colours (real
// hexes are data, not chrome). Each ships its table; dates come from labels.ts.
import { useEffect, useId, useState } from "react";
import type { BeforeAfterFig, Frame, StripFig, View } from "@/lib/data-stories/types";
import { dayText } from "@/lib/labels";
import { pairStamps } from "@/lib/data-stories/text";
import { RevealBox } from "@/components/read/Reveal";
import { ChartFrame } from "./Frame";
import { FIGURE_SOURCE, HL, INK, MUTED, PAGE, RULE, hlText } from "./ink";
import type { Look } from "./QuarterLine";

// CAPTURES ------------------------------------------------------------------------------------------
/** One capture redrawn: boxes from the stored skeleton, in the capture's own background, ink and accent. Upgrades to the crop when present. */
/** I1: a drawing with a stored hero crop reveals it on intent (RevealBox); `reveal={false}` where the frame sits inside a link or a kiosk. */
export function CaptureFrame({ fr, label, slim = false, className = "", reveal = true }: { fr: Frame; label: string; slim?: boolean; className?: string; reveal?: boolean }) {
  if (reveal && fr.reveal && !fr.crop && !slim) return <RevealBox reveal={fr.reveal} label={`${label}: redrawn from the stored layout`}><CaptureFrame fr={fr} label={label} className={className} reveal={false} /></RevealBox>;
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
function BeforeAfter({ f, v, live, pair = false }: { f: BeforeAfterFig; v: View; live: boolean; pair?: boolean; look?: Look }) {
  const start = pair ? SIDE_POS.after : SIDE_POS[v.side ?? "split"], [bStamp, aStamp] = pairStamps(f.before.at, f.after.at);
  const id = useId(), [pos, setPos] = useState<number>(start);
  useEffect(() => { setPos(start); }, [start]);
  const wipe = <><div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}><CaptureFrame fr={f.before} label={`${f.name}, ${bStamp}`} /></div>
    {pos > 0 && pos < 100 && <span className="absolute inset-y-0 w-0.5" style={{ left: `${pos}%`, background: INK }} />}</>;
  const on = new Set(v.highlight);
  return <ChartFrame level={2} title={f.title} note={f.note} source={FIGURE_SOURCE} receipt={{ href: f.href, label: f.name }} isEmpty={false} table={{ columns: ["Field", "Before", "After"], rows: f.diffs.map(d => [d.field, d.before, d.after]) }}>
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
function Strip({ f, v, live }: { f: StripFig; v: View; live: boolean; look?: Look }) {
  const start = Math.max(0, f.frames.findIndex(x => x.id === v.focus)), [k, setK] = useState(start), [play, setPlay] = useState(false);
  useEffect(() => { setK(start); setPlay(false); }, [start]);
  useEffect(() => { if (!play) return; const t = setInterval(() => setK(x => (x + 1 >= f.frames.length ? (setPlay(false), x) : x + 1)), STRIP_TICK_MS); return () => clearInterval(t); }, [play, f.frames.length]);
  const cur = f.frames[k], on = new Set(v.highlight), markAt = new Map(f.marks.filter(m => m.after).map(m => [m.after!, m]));
  return <ChartFrame level={2} title={f.title} note={f.note} source={FIGURE_SOURCE} receipt={{ href: f.href, label: f.name }} isEmpty={!f.frames.length} table={{ columns: ["Capture", "Source", "Changes marked"], rows: f.frames.map(fr => [dayText(fr.at), fr.source, f.marks.filter(m => m.after === fr.id).map(m => m.label).join("; ") || "—"]) }}>
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

/** A before/after pair or a capture strip, in either look (Read is the study figure; Data the same in the dark shell). */
export function BeforeAfterStrip({ f, v, live = false, pair = false, look = "read" }: { f: BeforeAfterFig | StripFig; v: View; live?: boolean; pair?: boolean; look?: Look }) {
  return f.kind === "strip" ? <Strip f={f} v={v} live={live} look={look} /> : <BeforeAfter f={f} v={v} live={live} pair={pair} look={look} />;
}
