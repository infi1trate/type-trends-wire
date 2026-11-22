// /brand/system (U3): the design system as one page — every named value with its Read and Data value and a live sample, every chart
// in the kit drawn in both looks from one fixture, and the key map. Everything is read from SYSTEM (src/lib/theme/system.ts) and
// ia.ts, so the Living design track can change a value and diff this page.
import { Suspense, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { chartSpecimensQuery } from "@/lib/data";
import { FORMS, type ChartForm } from "@/lib/chart/forms";
import { quarterText } from "@/lib/labels";
import { longDay } from "@/lib/pictures";
// L2 · the proposed forms are drawn here and nowhere else (forms.test.ts checks that no reader page imports them).
import { SlopeChart } from "@/components/chartkit/Slope";
import { DotRange } from "@/components/chartkit/DotRange";
import { KEY_MAP, SECTIONS } from "@/lib/ia";
import { pctText } from "@/lib/labels";
import { BrandShell, Screen } from "./BrandPages";
import { FIXTURE_LABEL, FIXTURE_QUARTERS } from "@/components/chartkit/fixture";
import { Colours, KitPairs, Pair, SpaceShapeMotion, Table, Td, TypeSteps, formOf } from "./SystemSpecimens";

const SPECIMEN: Record<string, string> = { "quarter-line": "Below", "small-multiples": "Below", bars: "Below", sparkline: "Below", "before-after-strip": "Below", slope: "Below, proposed", "dot-range": "Below, proposed", "two-axis-scatter": "Front page and study figures", donut: "Front page", bands: "Study figures", "whitespace-scatter": "Terminal, crawl", "vibe-map": "Terminal, vibe map", "library-history": "Terminal, library", "font-rank-flow": "Terminal, library", "palette-strip": "Terminal, a site's record", "score-bars": "Terminal, forecast" };
/** The registry (src/lib/chart/forms.ts) as one table: every form the product can draw, its shapes, least data and status. */
function Registry() {
  return <Table caption="Chart forms: the registry" head={["Form", "Status", "Fits", "Use when", "Not when", "Least data", "Looks", "Specimen"]}>
    {FORMS.map(f => <tr key={f.id} data-registry-form={f.id}>
      <Td>{f.name}</Td><Td mono>{f.status === "proposed" ? "Proposed, not in use" : "Live"}</Td><Td>{f.fits.map(x => x.shape).join("; ")}</Td>
      <Td>{f.use}</Td><Td>{f.avoid}</Td><Td>{f.least}{f.most != null ? `; at most ${f.most}` : ""}</Td>
      <Td>{[f.looks.read ? "Read" : null, f.looks.data ? "Data" : null].filter(Boolean).join(" and ")}</Td><Td>{SPECIMEN[f.id] ?? "None"}</Td>
    </tr>)}
  </Table>;
}
function Proposed() {
  const { data: d } = useSuspenseQuery(chartSpecimensQuery());
  const src = `forecast run ${d.run_id ?? "—"}${d.computed_at ? `, ${longDay(d.computed_at)}` : ""}`;
  const slopeTitle = d.slope ? `${d.slope.name} by sector, ${quarterText(d.slope.from)} and ${quarterText(d.slope.to)}` : "Slope chart";
  const slopeNote = "Share of tracked homepages in each sector, well-covered quarters only; the sector that moved most is highlighted.";
  const rangeTitle = `Next quarter's range for the most common signals`;
  const rangeNote = `Dot: share now. Line: the forecast's low and high for ${d.range.quarter ? quarterText(d.range.quarter) : "next quarter"}. The widest range is highlighted.`;
  const slopeSrc = `stored quarterly history, ${src}`, rangeSrc = `forecast projections, ${src}`;
  return <>
    <Pair form={formOf("slope")} title="Slope chart" read={<SlopeChart look="read" m={d.slope} title={slopeTitle} note={slopeNote} source={slopeSrc} />} data={<SlopeChart look="data" m={d.slope} title={slopeTitle} note={slopeNote} source={slopeSrc} />} />
    <p className="ed-caption mt-2" data-specimen-data="slope">Data: {d.slope ? `${d.slope.name}, ${d.slope.rows.length} sectors, ${quarterText(d.slope.from)} → ${quarterText(d.slope.to)}, from the stored history of ${src}` : "no signal had two well-covered quarters in enough sectors"}.</p>
    <Pair form={formOf("dot-range")} title="Dot with range" read={<DotRange look="read" m={d.range} title={rangeTitle} note={rangeNote} source={rangeSrc} />} data={<DotRange look="data" m={d.range} title={rangeTitle} note={rangeNote} source={rangeSrc} />} />
    <p className="ed-caption mt-2" data-specimen-data="dot-range">Data: {d.range.rows.length} headline signals with next quarter's forecast range, {src}.</p>
  </>;
}
function Charts() {
  return <>
    <p className="ed-small">Every form the product can draw, from one registry. A proposed form is shown only here, until the owner accepts it and a checked build makes it live.</p>
    <div className="mt-4"><Registry /></div>
    <p className="ed-small mt-8">One fixture for the live kit forms: {FIXTURE_LABEL}, {FIXTURE_QUARTERS.length} quarters, latest {pctText(FIXTURE_QUARTERS.at(-1)!.s!)}. Each chart carries its data table for screen readers.</p>
    <KitPairs />
    <h3 className="ed-kicker ed-rule mt-12 pt-3">Proposed forms, on real data</h3>
    <Suspense fallback={<p className="ed-small mt-3" aria-busy="true">Loading the specimens…</p>}><Proposed /></Suspense>
  </>;
}
function Keys() {
  const main = KEY_MAP.filter(k => !k.alias), aliases = KEY_MAP.filter(k => k.alias);
  return <>
    <Table caption="Keys in both views" head={["Key", "Opens", "Read view", "Terminal"]}>
      {SECTIONS.map((s, i) => <tr key={s.id}><Td mono>{s.key} · {i + 1}</Td><Td>{s.label}</Td><Td mono>{i + 1} → {s.read}</Td><Td mono>{s.key} / {i + 1}</Td></tr>)}
      {main.filter(k => !/^F\d/.test(k.key)).map(k => <tr key={k.key}><Td mono>{k.key}</Td><Td>{k.label}</Td><Td>{k.key === "?" || k.key === "`" || k.key === "/" ? "Same" : "Terminal only"}</Td><Td>Yes</Td></tr>)}
    </Table>
    <p className="ed-small mt-4">Old keys kept as aliases in the terminal: {aliases.map(a => `${a.key} (${a.label})`).join(", ")}. Keys never fire while you type in a field.</p>
  </>;
}
export function BrandSystem() {
  return <BrandShell page="system">
    <p className="ed-small" data-colophon-link="">Some of these values may move a little, once a month, inside fixed limits: <Link to="/colophon" className="ed-tap underline">the colophon</Link> lists which ones, their limits and every change.</p>
    <Screen id="sys-colour" label="Colour roles" title="Fifteen roles, two mappings"><Colours /></Screen>
    <Screen id="sys-type" label="Type" title="Named steps"><TypeSteps /></Screen>
    <Screen id="sys-space" label="Space, shape, motion" title="The rest of the values"><SpaceShapeMotion /></Screen>
    <Screen id="sys-charts" label="Chart forms" title="Every chart form, both looks"><Charts /></Screen>
    <Screen id="sys-keys" label="Keys" title="The key map"><Keys /></Screen>
  </BrandShell>;
}
