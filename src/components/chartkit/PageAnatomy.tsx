// B2 · PROPOSED FORM "page-anatomy" (src/lib/chart/forms.ts): how homepages are built. One page as a vertical strip of its sections
// (band height = share of the page, one fill per role, hero solid ink); many pages as strips side by side sorted by where a chosen role
// starts, under the typical page; over time, the typical page per year. No reader page imports this file until the owner accepts it.
import type { Section } from "@/lib/structure";
import { STRUCTURE_FLOOR } from "@/lib/structure";
import { ChartInteraction } from "./Interaction";
import { ChartTable } from "./ChartTable";
import { INK, PAGE } from "./ink";
import { useChartWidth } from "./useChartWidth";
import { FILLS, STRUCTURE_BEGAN, bandLine, fillOf, multiplesLayout, roleName, sortByRole, stripBands, textOn, typicalPage, typicalSections, type Page } from "./anatomy-layout";
import type { Look } from "./QuarterLine";

export const ANATOMY_HOW = "Each strip is one homepage, top to bottom; each band is a section, as tall as its share of the page.";
type Pt = { x: number; y: number; period: string; lines: string[] };
function Strip({ sections, name, x, w, h, labels, top = 0, out }: { sections: readonly Section[] | null; name: string; x: number; w: number; h: number; labels: boolean; top?: number; out: Pt[] }) {
  const bands = stripBands(sections, h);
  let last = -Infinity;
  return <g data-anatomy-strip={name}>
    {bands.map(b => { const f = fillOf(b.role), ty = top + b.y + Math.min(b.h / 2 + 4, b.h - 2), show = labels && b.h >= 12 && ty - last >= 13;
      if (show) last = ty;
      out.push({ x: x + w / 2, y: top + b.y + b.h / 2, period: name, lines: bandLine(name, b, bands.length).split(" · ").slice(1) });
      return <g key={b.index} aria-hidden="true" data-role={b.role}>
        <rect x={x} y={top + b.y} width={w} height={Math.max(0.5, b.h)} fill={FILLS[f]} stroke={INK} strokeWidth={0.75} />
        {show && (w - 12 >= roleName(b.role).length * 7.4
          ? <text x={x + 6} y={ty} className="tk-svg-text" style={{ fill: textOn(f) === "paper" ? PAGE : INK }}>{roleName(b.role)}</text>
          : <text x={x + w + 6} y={ty} className="tk-svg-text" style={{ fill: INK }}>{roleName(b.role)}</text>)}
      </g>; })}
  </g>;
}
const tableOf = (pages: readonly Page[]) => ({ columns: ["Brand", "Sections, top to bottom"], rows: pages.map(p => [p.name, stripBands(p.sections, 1).map(b => `${roleName(b.role)} ${Math.round(b.share * 100)}%`).join(", ") || "not read"]) });
function Shell({ title, note, source, look, height, points, width, alt, table, children, refEl, kind, fixed = false }: { fixed?: boolean; title: string; note: string; source: string; look: Look; height: number; width: number; points: Pt[]; alt: string; table: { columns: string[]; rows: (string | number)[][] }; children: React.ReactNode; refEl: React.Ref<HTMLDivElement>; kind: string }) {
  return <figure className="min-w-0" data-chart="page-anatomy" data-anatomy={kind} data-look={look}>
    <h3 className={look === "data" ? "tk-t-label" : "ed-kicker"}>{title}</h3>
    <p className={look === "data" ? "tk-t-caption tk-c-muted" : "ed-small mt-1"}>{note}</p>
    <div ref={refEl} className="mt-3 w-full" style={{ minHeight: height }}>
      <ChartInteraction label={title} points={points} width={width} height={height} spatial>
        <svg viewBox={`0 0 ${width} ${height}`} width={fixed ? width : "100%"} height={height} className="tk-svg block" role="img" aria-label={alt}>{children}</svg>
      </ChartInteraction>
    </div>
    <ChartTable caption={`${title}: every section`} columns={table.columns} rows={table.rows} />
    <figcaption className={look === "data" ? "tk-t-caption tk-c-muted mt-1" : "ed-caption mt-2"}>Source: {source}</figcaption>
  </figure>;
}
/** One page: the brand page's "How the page is built" strip. */
export function PageAnatomy({ page, title, note = ANATOMY_HOW, source, look = "read" }: { page: Page; title: string; note?: string; source: string; look?: Look }) {
  const [ref] = useChartWidth<HTMLDivElement>(), H = 360, W = 240, pts: Pt[] = [];
  const body = <Strip sections={page.sections} name={page.name} x={0} w={64} h={H} labels out={pts} />;
  return <Shell kind="one" fixed refEl={ref} title={title} note={note} source={source} look={look} height={H} width={W} points={pts} table={tableOf([page])} alt={`${title}: ${stripBands(page.sections, 1).map(b => roleName(b.role)).join(", ") || "no sections read"}`}>{body}</Shell>;
}
/** Many pages: the typical page, then one strip per brand sorted by where `sortRole` starts. Null below 15 pages read. */
export function PageAnatomyMany({ pages, sortRole = "pricing", title, note = ANATOMY_HOW, source, look = "read" }: { pages: readonly Page[]; sortRole?: string; title: string; note?: string; source: string; look?: Look }) {
  const [ref, width] = useChartWidth<HTMLDivElement>(), sorted = sortByRole(pages, sortRole), lay = multiplesLayout(sorted.length, Math.max(200, width - 140));
  if (!lay) return <p className="ed-small" data-anatomy-floor="">Too few pages read here to compare yet: fewer than {STRUCTURE_FLOOR}.</p>;
  const H = width < 600 ? 200 : 260, rowH = H + 12, height = lay.rows * rowH + 8, pts: Pt[] = [], typ = typicalSections(typicalPage(sorted));
  return <Shell kind="many" refEl={ref} title={title} note={`${note} Sorted by where ${roleName(sortRole).toLowerCase()} starts; the first strip is the typical page.`} source={source} look={look} height={height} width={width} points={pts} table={tableOf(sorted)} alt={`${title}: ${sorted.length} homepages, sorted by where ${roleName(sortRole)} starts; the typical page runs ${typ.map(s => roleName(s.r)).join(", ")}.`}>
    <Strip sections={typ} name="The typical page" x={0} w={36} h={H} labels out={pts} />
    {sorted.map((p, i) => { const r = Math.floor(i / lay.perRow), c = i % lay.perRow;
      return <Strip key={p.domain} sections={p.sections} name={p.name} x={140 + c * (lay.strip + lay.gap)} w={lay.strip} h={H} top={r * rowH} labels={false} out={pts} />; })}
  </Shell>;
}
/** Over time: the typical page per year read (at most six). Before 15 pages were read, says when slug began reading. */
export function PageAnatomyYears({ years, title, note = ANATOMY_HOW, source, look = "read" }: { years: readonly { label: string; pages: readonly Page[] }[]; title: string; note?: string; source: string; look?: Look }) {
  const [ref, width] = useChartWidth<HTMLDivElement>(), ok = years.filter(y => y.pages.length >= STRUCTURE_FLOOR).slice(-6), H = 300, pts: Pt[] = [];
  const colW = Math.min(120, Math.floor(width / Math.max(1, ok.length))), stripW = Math.min(48, colW - 70 > 20 ? 48 : 24);
  const begun = ok.length <= 1 ? ` Over time starts here: ${STRUCTURE_BEGAN}.` : "";
  return <Shell kind="years" refEl={ref} title={title} note={`${note}${begun}`} source={source} look={look} height={H + 20} width={width} points={pts} table={{ columns: ["Year", "Typical page"], rows: ok.map(y => [y.label, typicalPage(y.pages).map(t => `${roleName(t.role)} ${Math.round(t.share * 100)}%`).join(", ")]) }} alt={`${title}: ${ok.map(y => y.label).join(", ") || "no year read"}.`}>
    {ok.map((y, i) => <g key={y.label}><Strip sections={typicalSections(typicalPage(y.pages))} name={`Typical page, ${y.label}`} x={i * colW} w={stripW} h={H} labels={i === ok.length - 1 || colW >= 110} top={0} out={pts} />
      <text x={i * colW} y={H + 16} className="tk-svg-text tk-svg-muted" aria-hidden="true">{y.label} · {y.pages.length}</text></g>)}
  </Shell>;
}
