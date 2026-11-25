// The three illustration styles (brand/README.md, "Photography and illustration"), drawn with the kit's own filters
// (brand/illustration/slug-filters.svg, inlined from filters.gen.ts once per page) over the page's stored data. No photograph is
// fetched or invented: a picture is a section crop printed in one ink through <Treated>, or the stored layout redrawn.
// Rules built in (lib/illustration.ts): seeded and deterministic; one per viewport and never inside a list; the filtered area is
// at most 900 × 600; filters are never animated; Save-Data / reduced data draw flat; the number, the brand and the date stay in
// type, undistorted, outside the filtered group; light from the top left.
import { createContext, useContext, useId, type CSSProperties, type ReactNode } from "react";
import { ChartInteraction } from "@/components/chartkit/Interaction";
import { quarterText } from "@/lib/labels";
import { FILTER_DEFS } from "./filters.gen";
import { ILLUSTRATION_MAX, seedOf, softSize, stripShifts, stripsOf, tapeOf, tiltOf, trailGeom, type TrailPoint } from "@/lib/illustration";
import { MOTION_MS } from "@/lib/motion";
import { useFirstView } from "./Motion";
// L1 · illustration motifs are a living setting: a style outside the live set draws nothing (today all three are in it).
import { LIVE_VALUES } from "@/lib/living/editions";
const motifOn = (s: string) => LIVE_VALUES.motifs.includes(s);

const Scope = createContext(false);
/** The kit's filter definitions, once. Pages with an illustration render it (an illustration outside a scope renders its own). */
export function SlugFilters() {
  return <svg width="0" height="0" aria-hidden="true" focusable="false" className="tk-treat-defs" data-slug-filters="" dangerouslySetInnerHTML={{ __html: `<defs>${FILTER_DEFS}</defs>` }} />;
}
export function FiltersScope({ children }: { children: ReactNode }) {
  return <Scope.Provider value={true}><SlugFilters />{children}</Scope.Provider>;
}
const OwnDefs = () => (useContext(Scope) ? null : <SlugFilters />);
/** The filtered group: CSS applies the kit filter, so html[data-save-data] and prefers-reduced-data can drop it (flat mode). */
const F = ({ id, children, style }: { id: string; children: ReactNode; style?: CSSProperties }) => <g className="ill-f" style={{ ["--ill-f" as string]: `url(#${id})`, ...style }} data-filter={id}>{children}</g>;

// ——— THE TRAIL ——————————————————————————————————————————————————————————————————————————————————————
export type TrailProps = {
  /** The same points a LineChart series takes. */
  points: TrailPoint[];
  /** The accessible name (what the line is). */
  label: string;
  format: (v: number) => string;
  /** SVG units; the drawing scales to its box. */
  w?: number; h?: number;
  ink?: "green" | "pink" | "yellow";
  /** The last value as a sticker at the head of the trail. */
  sticker?: boolean;
  className?: string;
  seed?: number | string;
};
/** The chart line as a wet, raised trail: gumballs at the measured points, the last value as a sticker. Table fallback kept. */
/** From this far across, a trail's value label is anchored by its right edge. */
export const STICKER_END_FROM = 0.55;
export function Trail({ points, label, format, w = 640, h = 360, ink = "green", sticker = true, className = "", seed = label }: TrailProps) {
  const g = trailGeom(points, Math.min(w, ILLUSTRATION_MAX.w), Math.min(h, ILLUSTRATION_MAX.h), 28), last = points.at(-1), uid = useId().replace(/:/g, "");
  const [ref, on] = useFirstView<HTMLElement>(MOTION_MS.draw), ball = ink === "green" ? "slug-ball1" : ink === "pink" ? "slug-ball0" : "slug-ball3", tilt = (seedOf(seed) % 5) - 2;
  const head = g.pts.at(-1);
  if (!motifOn("trail")) return null;
  return <figure ref={ref} className={`ill ill-trail relative min-w-0 ${on ? "m-on" : ""} ${className}`.trim()} data-illustration="trail" style={{ maxWidth: ILLUSTRATION_MAX.w }}>
    <OwnDefs />
    <ChartInteraction label={label} width={Math.min(w, ILLUSTRATION_MAX.w)} height={Math.min(h, ILLUSTRATION_MAX.h)} points={g.pts.map(([x, y], i) => ({ x, y, period: quarterText(points[i]?.x ?? ""), lines: [`${label}: ${format(points[i]?.y ?? 0)}`] }))}>
    <svg viewBox={`0 0 ${g.pts.length ? Math.min(w, ILLUSTRATION_MAX.w) : w} ${Math.min(h, ILLUSTRATION_MAX.h)}`} className="block h-full w-full overflow-visible" role="img" aria-label={`${label}: ${points.map(p => `${p.x} ${format(p.y)}`).join(", ")}`} preserveAspectRatio="xMidYMid meet">
      {g.d && <>
        {/* A real, soft contact shadow below the trail (light from the top left). */}
        <F id="slug-soft"><path d={g.d} transform="translate(6 10)" fill="none" stroke="var(--tk-shadow-ink)" strokeOpacity={0.28} strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" /></F>
        <F id="slug-trail"><path d={g.d} pathLength={100} className="ill-draw" fill="none" stroke={`var(--tk-gumball-${ink}-base)`} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" /></F>
        {g.pts.map(([x, y], i) => <g key={`${uid}-${i}`} className="ill-stick" style={{ ["--at" as string]: g.at[i], transformOrigin: `${x}px ${y}px` }}>
          <circle cx={x + 3} cy={y + 4} r={11} fill="var(--tk-shadow-ink)" opacity={0.85} />
          <circle cx={x} cy={y} r={11} fill={`url(#${ball})`} stroke="var(--tk-shadow-ink)" strokeWidth={2} />
        </g>)}
      </>}
      {points[0] && g.pts[0] && <g aria-hidden="true" transform={`translate(${g.pts[0][0]}, ${Math.max(32, g.pts[0][1] - 28)})`}><rect x="-6" y="-26" width="76" height="34" rx="17" fill="var(--sys-color-page)" stroke="var(--sys-color-ink)" strokeWidth="3" /><text x="32" y="0" textAnchor="middle" className="tk-svg-text">{format(points[0].y)}</text></g>}
    </svg>
    <div className="trail-periods tk-t-kicker" aria-hidden="true"><span>{quarterText(points[0]?.x ?? "")}</span><span>{quarterText(last?.x ?? "")}</span></div>
    </ChartInteraction>
    {sticker && last && head && (() => {
      // E5 · a value near the right edge is anchored by its right side, so the label never runs past the chart (or the page) on phones.
      const fx = head[0] / Math.min(w, ILLUSTRATION_MAX.w), end = fx > STICKER_END_FROM;
      return <span className="c-sticker ill-sticker pointer-events-none absolute" aria-hidden="true" data-container="sticker" data-anchor={end ? "end" : undefined}
        style={{ ...(end ? { right: `max(0.25rem, calc(${((1 - fx) * 100).toFixed(2)}% - 1.5rem))` } : { left: `${fx * 100}%` }), top: `${(head[1] / Math.min(h, ILLUSTRATION_MAX.h)) * 100}%`, ["--tilt" as string]: `${tilt * 2 + 6}deg` }}>{format(last.y)}</span>;
    })()}
    <table className="sr-only" data-chart-table=""><caption>{label}: the data behind the trail</caption><thead><tr><th scope="col">Point</th><th scope="col">Value</th></tr></thead>
      <tbody>{points.map(p => <tr key={p.x}><th scope="row">{p.x}</th><td>{format(p.y)}</td></tr>)}</tbody></table>
  </figure>;
}

// ——— CUT AND PASTE ——————————————————————————————————————————————————————————————————————————————————
export type CutProps = {
  seed: number | string;
  /** The picture: a crop printed in one ink (<Treated>), or a capture redrawn from its stored layout. */
  picture: ReactNode;
  /** One pencil note from a real fact (a date, a share). Set in type; only the pencil mark is drawn. */
  note?: string | null;
  /** The headline, cut into strips (rendered by the cover, which owns the h1). */
  className?: string;
};
const TAPE_POS: Record<string, CSSProperties> = { tl: { left: "-4%", top: "-3%" }, tr: { right: "-4%", top: "-3%" }, bl: { left: "-4%", bottom: "-3%" }, br: { right: "-4%", bottom: "-3%" } };
/** A paper collage: a sheet (the paper filter, a short soft shadow), the picture taped at two corners, a pencil note. */
export function CutAndPaste({ seed, picture, note, className = "" }: CutProps) {
  const s = seedOf(seed), tilt = tiltOf(s), tapes = tapeOf(s);
  if (!motifOn("cut")) return null;
  return <figure className={`ill ill-cut relative min-w-0 ${className}`.trim()} data-illustration="cut" style={{ maxWidth: ILLUSTRATION_MAX.w, ["--tilt" as string]: `${tilt}deg` }}>
    <OwnDefs />
    {/* The sheet: cut paper with grain and a short real shadow. */}
    <svg className="ill-sheet absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 900 600" preserveAspectRatio="none" aria-hidden="true">
      <F id="slug-paper"><rect x="18" y="18" width="864" height="564" fill="var(--tk-surface-page)" /></F>
    </svg>
    {note && <figcaption className="ill-note relative" data-pencil-note="">
      <svg className="ill-pencil absolute" viewBox="0 0 120 60" aria-hidden="true"><F id="slug-pencil"><path d="M8 44 C 30 10, 70 6, 104 22 M96 12 L106 23 L92 30" fill="none" stroke="var(--tk-text-primary)" strokeWidth={3} strokeLinecap="round" /></F></svg>
      <span className="ill-note-text">{note}</span>
    </figcaption>}
    <div className="ill-pic relative" style={{ transform: `rotate(${tilt}deg)` }}>
      <div className="ill-pic-frame">{picture}</div>
      {tapes.map(t => <span key={t.corner} className="ill-tape absolute" aria-hidden="true" style={{ ...TAPE_POS[t.corner], width: `${t.length * 100}%`, transform: `rotate(${t.angle}deg)` }} />)}
    </div>
  </figure>;
}
/** The headline cut into two or three strips (the cover's h1 holds them; screen readers hear one headline). */
export function HeadlineStrips({ text, seed, className = "" }: { text: string; seed: number | string; className?: string }) {
  const s = seedOf(seed), strips = stripsOf(text, s), shifts = stripShifts(s, strips.length);
  return <span className={`ill-strips ${className}`.trim()} data-strips={strips.length}>
    <span className="sr-only">{text}</span>
    {strips.map((t, i) => <span key={i} aria-hidden="true" className="ill-strip" style={{ transform: `translateX(${shifts[i]!.dx}px) rotate(${shifts[i]!.rot}deg)` }}>{t}</span>)}
  </span>;
}

// ——— SOFT OBJECTS ———————————————————————————————————————————————————————————————————————————————————
export type SoftProps = {
  /** A number or a short word: the object. Its value is also set in type nearby (the cover's caption), undistorted. */
  text: string;
  seed: number | string;
  /** The object's ink and the print's second ink. */
  ink?: "pink" | "green" | "yellow";
  print?: "yellow" | "pink";
  label: string;
  className?: string;
};
/** A number or short word as an inflated object (the puff filters) resting on a two-ink halftone print. */
export function SoftObject({ text, seed, ink = "pink", print = "yellow", label, className = "" }: SoftProps) {
  const s = seedOf(seed), tilt = tiltOf(s), size = softSize(text), dots = print === "yellow" ? "slug-dotsY" : "slug-dotsP";
  if (!motifOn("soft")) return null;
  return <figure className={`ill ill-soft relative min-w-0 ${className}`.trim()} data-illustration="soft" style={{ maxWidth: ILLUSTRATION_MAX.w }}>
    <OwnDefs />
    <svg viewBox="0 0 900 600" className="block h-auto w-full" role="img" aria-label={label}>
      {/* The two-ink print: paper, one ink in a halftone, the ink's dots over it. */}
      <rect width="900" height="600" fill="var(--tk-surface-page)" />
      <rect width="900" height="600" fill={`url(#${dots})`} opacity={0.9} />
      <rect x="0" y="380" width="900" height="220" fill="url(#slug-dots)" opacity={0.35} />
      {/* A real, soft contact shadow under the object, falling right (light from the top left). */}
      <F id="slug-soft"><ellipse cx="480" cy={300 + size * 0.42} rx={Math.min(400, size * 0.3 * [...text].length)} ry={26} fill="var(--tk-shadow-ink)" opacity={0.35} /></F>
      <g transform={`rotate(${tilt} 450 300)`} className="ill-object">
        <F id="slug-puffBig"><text x="450" y={300 + size * 0.34} textAnchor="middle" fontSize={size} fontWeight={900} style={{ fontFamily: "var(--tk-font-display)", fill: `var(--tk-gumball-${ink}-base)` }}>{text}</text></F>
      </g>
    </svg>
  </figure>;
}
