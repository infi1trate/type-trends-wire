// D1b · TODAY'S LEFT-COLUMN TOP-UP (pure). From 1024 px Today has two columns, and with a short week the left one ended about 450 px
// above the rail (23 Nov: 473, 470 and 453 px at 1024, 1280 and 1440). The server already knows what each column holds (how many story
// rows, which rail parts, how many rows in each), and each part's height by kind is fixed by the design, so it chooses here, before the
// first byte, how many of the stories from before this week (at most TOP_UP_MAX) to show under "Before this week" so that the left column
// ends within TOP_UP_TOLERANCE_PX of the rail at 1024, 1280 and 1440 px. Nothing is measured in the browser, so nothing moves on load.

export const TOP_UP_MAX = 5;
export const TOP_UP_TOLERANCE_PX = 160;
export const TOP_UP_WIDTHS = [1024, 1280, 1440] as const;
export type TopUpWidth = (typeof TOP_UP_WIDTHS)[number];
type Heights = {
  /** One story row in the left column (number, title, line, chips); at 1024 px titles and lines wrap, so the row is taller on average. */
  storyRow: number;
  /** A day group: its top margin and kicker heading. */
  group: number;
  /** Everything else in the left column (the column heading, the Morning Line link, the margins between its blocks). */
  leftFixed: number;
  studiesHead: number; studyRow: number; editionsHead: number; editionRow: number;
  chart: number; strip: number; exploreHead: number; exploreRow: number; collectionsHead: number; collectionRow: number;
  /** The rail's own margins. */
  railFixed: number;
};
/** Measured on the preview with real rows (23 Nov 2026, 07:40 UTC), px. */
export const FRONT_HEIGHTS: Readonly<Record<TopUpWidth, Heights>> = {
  1024: { storyRow: 110, group: 48, leftFixed: 137, studiesHead: 54, studyRow: 50, editionsHead: 28, editionRow: 45, chart: 495, strip: 245, exploreHead: 106, exploreRow: 93, collectionsHead: 133, collectionRow: 51, railFixed: 32 },
  1280: { storyRow: 93, group: 48, leftFixed: 135, studiesHead: 54, studyRow: 50, editionsHead: 28, editionRow: 45, chart: 501, strip: 222, exploreHead: 104, exploreRow: 82, collectionsHead: 132, collectionRow: 45, railFixed: 32 },
  1440: { storyRow: 93, group: 48, leftFixed: 134, studiesHead: 54, studyRow: 50, editionsHead: 28, editionRow: 45, chart: 518, strip: 186, exploreHead: 104, exploreRow: 82, collectionsHead: 132, collectionRow: 45, railFixed: 33 },
};
/** The editions list is built beside the rest of the page (after the top); it nearly always has its three rows, so they are assumed. */
export const EDITION_ROWS_ASSUMED = 3;

export type ColumnsIn = {
  /** Story rows in the left column and the day groups they sit in (the quiet archive's rows count as one more group). */
  storyRows: number; groups: number;
  studies: number; editions?: number;
  chart: boolean; strip: boolean; explore: number; collections: number;
  /** Stories from before this week that could be added. */
  available: number;
};
export function columnHeights(c: ColumnsIn, extra: number, w: TopUpWidth): { left: number; rail: number } {
  const h = FRONT_HEIGHTS[w], eds = c.editions ?? EDITION_ROWS_ASSUMED;
  const left = h.leftFixed + c.storyRows * h.storyRow + c.groups * h.group + (extra > 0 ? h.group + extra * h.storyRow : 0)
    + (c.studies ? h.studiesHead + c.studies * h.studyRow : 0) + (eds ? h.editionsHead + eds * h.editionRow : 0);
  const rail = h.railFixed + (c.chart ? h.chart : 0) + (c.strip ? h.strip : 0) + (c.explore ? h.exploreHead + c.explore * h.exploreRow : 0)
    + (c.collections ? h.collectionsHead + c.collections * h.collectionRow : 0);
  return { left, rail };
}
/** How far apart the columns end at each width (rail minus left: positive when the left column is shorter). */
export const gapsFor = (c: ColumnsIn, extra: number) => Object.fromEntries(TOP_UP_WIDTHS.map(w => { const x = columnHeights(c, extra, w); return [w, x.rail - x.left]; })) as Record<TopUpWidth, number>;
/** The number of stories to add (0 to TOP_UP_MAX, never more than are available): the fewest that bring every width within the
 *  tolerance (none when they already are); when no count does, the one whose worst width is closest (adding stops helping once the left
 *  column is the longer one). */
export function topUpCount(c: ColumnsIn): number {
  const most = Math.max(0, Math.min(TOP_UP_MAX, c.available));
  const worst = (n: number) => Math.max(...Object.values(gapsFor(c, n)).map(Math.abs));
  let best = 0;
  for (let n = 1; n <= most; n++) {
    if (worst(n) <= TOP_UP_TOLERANCE_PX) return n;
    if (worst(n) < worst(best)) best = n;
  }
  return best;
}
