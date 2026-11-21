// THE CHART KIT (U3) — one set of chart components for both views. Each takes its data plus a `look` of "read" or "data", draws only
// from design-system roles (src/lib/theme/system.ts) and ships its data table for screen readers; numbers, dates and quarters are
// formatted by src/lib/labels.ts. Read figures and terminal panels import charts from here only.
export { ChartFrame, ChartTitleQuiet, ScatterChart, DonutChart, STAGE_FILL, stageBall, Gumball, GumballDefs, type FrameProps, type ScatterPoint, type Slice } from "./Frame";
export { QuarterLine, type QuarterLineProps, type QuarterPoint, type LineSeries, type Look } from "./QuarterLine";
export { Bars, type BarsProps, type Bar, type QuarterBar } from "./Bars";
export { Sparkline, type SparklineProps } from "./Sparkline";
export { SmallMultiples } from "./Multiples";
export { BeforeAfterStrip, CaptureFrame } from "./BeforeAfter";
export { ChartTable } from "./ChartTable";
