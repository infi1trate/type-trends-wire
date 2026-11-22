// L2 · THE CHART REGISTRY (pure). Every chart form the product can draw, in one list: its data shapes (this is N3's figure table, the
// only one: SHAPE_FORMS and FIGURE_SHAPE are derived from it), when to use it and when not, the least data it needs, its Read and Data
// looks, how it reads without sight, the modules that draw it, and its status. The graphics desk's chart choice and the study builder
// read it; forms.test.ts fails when a component draws a chart that is not listed here, or when a reader page imports a proposed form.
// A form goes live only in a build that passed the gate after the owner accepted its proposal (`liveIn` is then that build's edition).

export const FORM_STATUSES = ["live", "proposed"] as const;
export type FormStatus = (typeof FORM_STATUSES)[number];
/** The data shapes. The first six are N3's study-figure shapes; the rest are the shapes the terminal and the front page draw. */
export const SHAPES = [
  "series per panel", "share over quarters", "brands on two axes", "bands over quarters", "two captures", "frames in time",
  "values per row", "one series inline", "parts of a whole", "sites on two measures", "sites in tag space", "counts over years",
  "ranks over years", "colours of one site", "scores per row", "two points per row", "value with range per row",
] as const;
export type Shape = (typeof SHAPES)[number];
export type ChartForm = {
  id: string; name: string; status: FormStatus;
  /** Each shape it fits, and the name the graphics desk uses for it there. */
  fits: readonly { shape: Shape; desk: string }[];
  use: string; avoid: string; least: string; /** Most rows it draws before it stops reading (null: no limit). */ most: number | null;
  looks: { read: string | null; data: string | null };
  access: { table: string; alt: string };
  /** The files that draw it (paths from the project root). */ modules: readonly string[];
  /** The design edition in which it went live (colophon); null while proposed. */ liveIn: number | null;
};
const K = "src/components/chartkit/", T = "src/components/terminal/";
const ALT = "Name what is measured, the span and the latest value; the table carries every number.";

export const FORMS: readonly ChartForm[] = [
  // THE KIT (U3) -----------------------------------------------------------------------------------------------------------------
  { id: "quarter-line", name: "Quarter line", status: "live", fits: [{ shape: "share over quarters", desk: "quarter line" }],
    use: "One signal's share by quarter, with its forecast.", avoid: "More than four lines, or fewer than three quarters.", least: "3 quarters, 2 of them well covered", most: 4,
    looks: { read: "One labelled line with a faint forecast", data: "Cone: fitted line, backtest and projection band" },
    access: { table: "Quarter, share, homepages, well covered", alt: ALT }, modules: [`${K}QuarterLine.tsx`, "src/components/data/Figures.tsx"], liveIn: 0 },
  { id: "small-multiples", name: "Small multiples", status: "live", fits: [{ shape: "series per panel", desk: "line" }],
    use: "The same measure for several brands or sectors on one scale.", avoid: "A single series, or panels with different units.", least: "2 panels of 3 points", most: 12,
    looks: { read: "One panel per row, highlighted panel in the highlighter", data: "The same panels with thinner lines" },
    access: { table: "Panel, then one column per point", alt: "Name the measure, the panels and the shared scale." }, modules: [`${K}Multiples.tsx`], liveIn: 0 },
  { id: "bars", name: "Bars", status: "live", fits: [{ shape: "series per panel", desk: "bars" }, { shape: "values per row", desk: "bars" }],
    use: "Ranking up to twelve rows on one measure, or panels with few points.", avoid: "Change over many quarters (use a line).", least: "1 row", most: 12,
    looks: { read: "Ranked horizontal bars filled by stage", data: "One column per quarter, thin quarters faint" },
    access: { table: "Row, value, stage", alt: "Name the measure, the top row and its value." }, modules: [`${K}Bars.tsx`], liveIn: 0 },
  { id: "sparkline", name: "Sparkline", status: "live", fits: [{ shape: "one series inline", desk: "sparkline" }],
    use: "A trend beside a number in a row or a card.", avoid: "Any figure a reader must read values from.", least: "3 points", most: 1,
    looks: { read: "A small line at the row's height", data: "Rank line or rank spark" },
    access: { table: "Point, value", alt: "Say the direction and the latest value in words." }, modules: [`${K}Sparkline.tsx`], liveIn: 0 },
  { id: "before-after-strip", name: "Before-and-after strip", status: "live", fits: [{ shape: "two captures", desk: "before and after" }, { shape: "frames in time", desk: "strip" }],
    use: "What a page looked like before and after a change, or a run of captures.", avoid: "Anything without stored captures.", least: "2 captures", most: 8,
    looks: { read: "Two frames side by side with the changed fields", data: "The same frames, slimmer, with the diff table" },
    access: { table: "Field, before, after", alt: "Name the brand, both dates and what changed." }, modules: [`${K}BeforeAfter.tsx`], liveIn: 0 },
  { id: "two-axis-scatter", name: "Two-axis scatter", status: "live", fits: [{ shape: "brands on two axes", desk: "scatter" }],
    use: "Where rows sit on two measures (share against momentum, a brand field).", avoid: "Fewer than five points, or one measure.", least: "5 points", most: 60,
    looks: { read: "Gumball points with direct labels where they fit", data: null },
    access: { table: "Row, first measure, second measure, stage", alt: "Name both measures and the points that stand out." }, modules: [`${K}Frame.tsx`, "src/components/data/Figures.tsx"], liveIn: 0 },
  { id: "donut", name: "Donut", status: "live", fits: [{ shape: "parts of a whole", desk: "donut" }],
    use: "A handful of parts that add up to one whole.", avoid: "More than six parts, or parts that do not add up.", least: "2 parts", most: 6,
    looks: { read: "Ring of parts with the total in the middle", data: null },
    access: { table: "Part, count, share", alt: "Name the whole and the largest part." }, modules: [`${K}Frame.tsx`], liveIn: 0 },
  { id: "bands", name: "Bands over quarters", status: "live", fits: [{ shape: "bands over quarters", desk: "bands" }],
    use: "How a mix (palette families, type classes) shifts quarter by quarter.", avoid: "One series, or more than eight bands.", least: "3 quarters of 2 bands", most: 8,
    looks: { read: "Stacked bands, highlighted band in the highlighter", data: "The same bands with the values" },
    access: { table: "Quarter, then one column per band", alt: "Name the mix, the span and the band that moved most." }, modules: ["src/components/data/Figures.tsx"], liveIn: 0 },
  // THE SPECIAL FORMS (terminal) -------------------------------------------------------------------------------------------------
  { id: "whitespace-scatter", name: "Whitespace scatter", status: "live", fits: [{ shape: "sites on two measures", desk: "whitespace scatter" }],
    use: "Every crawled site by whitespace and text density.", avoid: "Anything but crawl measures.", least: "10 sites", most: null,
    looks: { read: null, data: "Dense dot field with sector filter" },
    access: { table: "Site, whitespace, text density", alt: "Name both measures and the site count." }, modules: [`${T}CrawlCharts.tsx`], liveIn: 0 },
  { id: "vibe-map", name: "Vibe map", status: "live", fits: [{ shape: "sites in tag space", desk: "vibe map" }],
    use: "Sites placed by their AI tags, clustered.", avoid: "Any claim about a single measured field.", least: "20 sites with tags", most: null,
    looks: { read: null, data: "Projected map with clusters and keyboard focus" },
    access: { table: "Site, cluster, nearest sites", alt: "Name the clusters and the sector shown." }, modules: [`${T}VibeMap.tsx`], liveIn: 0 },
  { id: "library-history", name: "Library history", status: "live", fits: [{ shape: "counts over years", desk: "library history" }],
    use: "How the library's captures and redesigns spread over the years.", avoid: "Shares (it draws counts).", least: "2 years", most: null,
    looks: { read: null, data: "Small history sparks and redesigns per year" },
    access: { table: "Year or quarter, count", alt: "Name the measure and the years covered." }, modules: [`${T}LibraryHistory.tsx`], liveIn: 0 },
  { id: "font-rank-flow", name: "Font-rank flow", status: "live", fits: [{ shape: "ranks over years", desk: "font-rank flow" }],
    use: "The top headline typefaces year by year, and how they swap places.", avoid: "Fewer than two years of ranks.", least: "2 years of 3 ranks", most: 10,
    looks: { read: null, data: "Rank lines between yearly columns" },
    access: { table: "Year, rank, typeface", alt: "Name the top typeface now and then." }, modules: [`${T}LibraryHistory.tsx`], liveIn: 0 },
  { id: "palette-strip", name: "Palette strip", status: "live", fits: [{ shape: "colours of one site", desk: "palette strip" }],
    use: "A site's main colours by how much of the page they cover.", avoid: "Comparing sites' shares (use bars).", least: "1 colour", most: 5,
    looks: { read: null, data: "Proportional colour strip and chips with hex values" },
    access: { table: "Colour, hex, share of page", alt: "List the colours by name and share." }, modules: [`${T}LibrarySite.tsx`, `${T}Rebrands.tsx`, `${T}LibraryShared.tsx`], liveIn: 0 },
  { id: "score-bars", name: "Score bars", status: "live", fits: [{ shape: "scores per row", desk: "score bars" }],
    use: "A small bar beside a score in a table row.", avoid: "As a figure on its own.", least: "1 row", most: null,
    looks: { read: null, data: "A thin bar in the cell, value beside it" },
    access: { table: "The table it sits in", alt: "The cell's number is the text; the bar is decoration." }, modules: [`${T}Forecast.tsx`, `${T}LibraryShared.tsx`], liveIn: 0 },
  // PROPOSED (L2): specimens on /brand/system only ---------------------------------------------------------------------------------
  { id: "slope", name: "Slope chart", status: "proposed", fits: [{ shape: "two points per row", desk: "slope" }],
    use: "Each row at two points in time (each sector's share, then and now); sector against sector, white space.", avoid: "More than two points in time, or more than ten rows.", least: "2 rows at both points", most: 10,
    looks: { read: "Lines labelled at both ends, the row that moved most in the highlighter", data: "The same lines with both values and the change" },
    access: { table: "Row, then, now, change", alt: "Name both dates, the row that moved most and by how much." }, modules: [`${K}Slope.tsx`], liveIn: null },
  { id: "dot-range", name: "Dot with range", status: "proposed", fits: [{ shape: "value with range per row", desk: "dot with range" }],
    use: "One value per row with its range (a share with next quarter's forecast low and high); breakouts, stage shifts.", avoid: "Rows without a range, or more than twelve.", least: "2 rows with a range", most: 12,
    looks: { read: "Sorted dots on range lines, labels on the left", data: "The same rows with low, value and high printed" },
    access: { table: "Row, value, low, high", alt: "Name the value, what the range is and the widest range." }, modules: [`${K}DotRange.tsx`], liveIn: null },
];

export const formById = (id: string) => FORMS.find(f => f.id === id) ?? null;
export const liveForms = () => FORMS.filter(f => f.status === "live");
export const proposedForms = () => FORMS.filter(f => f.status === "proposed");
/** Files that draw a proposed form: no reader route or reader component may import them. */
export const PROPOSED_MODULES = new Set(proposedForms().flatMap(f => f.modules));

// N3's figure table, derived (one table, not two): each study shape → the live forms' desk names, in registry order.
const STUDY_SHAPES = ["series per panel", "share over quarters", "brands on two axes", "bands over quarters", "two captures", "frames in time"] as const;
type StudyShape = (typeof STUDY_SHAPES)[number];
export const SHAPE_FORMS = Object.fromEntries(STUDY_SHAPES.map(s => [s, liveForms().flatMap(f => f.fits.filter(x => x.shape === s).map(x => x.desk))])) as unknown as Record<StudyShape, readonly string[]>;
export const FIGURE_SHAPE: Record<string, StudyShape> = { multiples: "series per panel", adoption: "share over quarters", field: "brands on two axes", drift: "bands over quarters", "before-after": "two captures", strip: "frames in time" };
/** The registry form behind a desk name for a shape (live or proposed), or null. */
export const formOfDesk = (desk: string, shape?: string): ChartForm | null =>
  FORMS.find(f => f.fits.some(x => x.desk === desk.trim().toLowerCase() && (!shape || x.shape === shape))) ?? null;
/** Proposed forms that would fit a shape. */
export const proposedFor = (shape: string) => proposedForms().filter(f => f.fits.some(x => x.shape === shape));
/** The study builder's choice for a small-multiples figure: lines need three points; bars take at most twelve panels' points. */
export const multiplesChart = (points: number, wanted: "line" | "bars"): "line" | "bars" => (wanted === "line" && points < 3 ? "bars" : wanted);
/** Colophon: live forms grouped by the edition they went live in, oldest first; proposed forms never appear. */
export function formsByEdition(): { edition: number; forms: string[] }[] {
  const m = new Map<number, string[]>();
  for (const f of liveForms()) if (f.liveIn != null) m.set(f.liveIn, [...(m.get(f.liveIn) ?? []), f.name]);
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([edition, forms]) => ({ edition, forms }));
}
/** The registry as plain rows (the /desk Graphics panel, the memory and the report). */
export const registryRows = () => FORMS.map(f => ({ id: f.id, name: f.name, status: f.status, shapes: f.fits.map(x => x.shape), least: f.least, most: f.most, use: f.use, avoid: f.avoid, read: f.looks.read, data: f.looks.data }));
/** The proposed registry form a graphics proposal names (“The registry's proposed form “Slope chart” (slope)”), or null. */
export function chartFormOfProposal(text: string): ChartForm | null {
  const m = /registry's proposed form “[^”]+” \(([a-z-]+)\)/.exec(text);
  const f = m ? formById(m[1]!) : null;
  return f && f.status === "proposed" ? f : null;
}
