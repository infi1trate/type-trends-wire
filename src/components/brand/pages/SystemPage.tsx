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
// B2 · the three new proposed forms, drawn here on real stored rows until the owner accepts each on the desk page.
import { AdoptionWake } from "@/components/chartkit/AdoptionWake";
import { LeadLag, LeadLagSpark } from "@/components/chartkit/LeadLag";
import { PageAnatomy, PageAnatomyMany, PageAnatomyYears } from "@/components/chartkit/PageAnatomy";
import { b2SpecimensQuery } from "@/lib/data";
import { sectorName } from "@/lib/labels";
import { KEY_MAP, SECTIONS } from "@/lib/ia";
import { pctText } from "@/lib/labels";
import { BrandShell, Screen } from "./BrandPages";
import { FIXTURE_LABEL, FIXTURE_QUARTERS } from "@/components/chartkit/fixture";
import { Colours, KitPairs, Pair, SpaceShapeMotion, Table, Td, TypeSteps, formOf } from "./SystemSpecimens";

const SPECIMEN: Record<string, string> = { "quarter-line": "Below", "small-multiples": "Below", bars: "Below", sparkline: "Below", "before-after-strip": "Below", slope: "Below, proposed", "dot-range": "Below, proposed", "adoption-wake": "Below, proposed", "lead-lag": "Below, proposed", "page-anatomy": "Below, proposed", "two-axis-scatter": "Front page and study figures", donut: "Front page", bands: "Study figures", "whitespace-scatter": "Terminal, crawl", "vibe-map": "Terminal, vibe map", "library-history": "Terminal, library", "font-rank-flow": "Terminal, library", "palette-strip": "Terminal, a site's record", "score-bars": "Terminal, forecast" };
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
function B2() {
  const { data: d } = useSuspenseQuery(b2SpecimensQuery());
  const van = new Set(d.wake?.vanguard ?? []), pages = d.anatomy.pages, q = d.anatomy.quarter ? quarterText(d.anatomy.quarter) : "no quarter";
  const one = pages.find(p => p.domain === "linear.app") ?? pages[0] ?? null;
  const bySector = new Map<string, typeof pages>(); for (const p of pages) if (p.sector) bySector.set(p.sector, [...(bySector.get(p.sector) ?? []), p]);
  const sector = [...bySector].sort((a, b) => b[1].length - a[1].length)[0] ?? null;
  const wakeTitle = d.wake ? `Who went first: ${d.wake.fig.signal.name}` : "Adoption wake";
  const src = (what: string) => `${what}, stored rows`;
  return <>
    <Pair form={formOf("adoption-wake")} title="Adoption wake"
      read={d.wake ? <AdoptionWake look="read" fig={d.wake.fig} vanguard={van} title={wakeTitle} source={src("Study No. 2's stored figure and today's vanguard list")} /> : null}
      data={d.wake ? <AdoptionWake look="data" fig={d.wake.fig} vanguard={van} title={wakeTitle} source={src("Study No. 2")} /> : null} />
    <p className="ed-caption mt-2" data-specimen-data="adoption-wake">Data: {d.wake ? `${d.wake.fig.adopters.length} adopters of ${d.wake.fig.signal.name} from Study No. 2, ${van.size} brands on today's vanguard list` : "none"}. Would replace Study No. 2's square grid, and sit under the main chart on signal pages with at least 15 dated adopters, titled “Who went first”.</p>
    <Pair form={formOf("lead-lag")} title="Lead and lag"
      read={d.lead ? <LeadLag look="read" rows={d.lead.rows} name={d.lead.name} title={`Where it leads: ${d.lead.name}`} source={src(`lead and lag counts, ${d.vanguardSize} vanguard brands`)} /> : null}
      data={d.lead ? <LeadLag look="data" rows={d.lead.rows} name={d.lead.name} title={`Where it leads: ${d.lead.name}`} source={src("lead and lag counts")} /> : null} />
    <p className="ed-caption mt-2" data-specimen-data="lead-lag">Data: {Object.keys(d.leadRows).length} headline signals with stored counts; the vanguard is today's list applied to every quarter. Would sit under “Where it leads” on signal pages.</p>
    <Pair form={formOf("page-anatomy")} title="Page anatomy"
      read={one ? <PageAnatomy look="read" page={one} title={`How the page is built: ${one.name}`} source={src(`structure reading, ${q}`)} /> : null}
      data={sector ? <PageAnatomyMany look="data" pages={sector[1]} title={`Homepages in ${sectorName(sector[0])}`} source={src(`structure readings, ${q}`)} /> : null} />
    {sector && <div className="mt-6"><PageAnatomyMany look="read" pages={sector[1]} title={`Homepages in ${sectorName(sector[0])}, sorted by where pricing starts`} source={src(`structure readings, ${q}`)} /></div>}
    <p className="ed-caption mt-2" data-specimen-data="page-anatomy">Data: {pages.length} desktop homepages with sections read in {q}. Would replace the brand page strip, and appear on sector and category pages with 15 or more pages read.</p>
    <h3 className="ed-kicker ed-rule mt-12 pt-3">Held studies (not listed, not published until their lead form is accepted)</h3>
    <section className="mt-4" data-held-study="do-the-leaders-lead" aria-label="Do the leaders lead?">
      <h3 className="ed-h3">Do the leaders lead?</h3>
      <p className="ed-small mt-1 max-w-[68ch]">Each headline signal, ranked by how many quarters earlier the {d.vanguardSize} vanguard brands reached the level everyone else reached last. Numbers from the stored lead and lag counts.</p>
      <table className="mt-3 w-full text-left" data-held-ranks="">
        <thead><tr><th className="ed-kicker py-1">Signal</th><th className="ed-kicker py-1">Lag</th><th className="ed-kicker py-1 text-right">Vanguard</th><th className="ed-kicker py-1 pr-4 text-right">Everyone else</th><th className="ed-kicker py-1">Shape</th></tr></thead>
        <tbody>{d.ranks.slice(0, 20).map(r => <tr key={r.signal} className="ed-hair">
          <td className="ed-small py-1 pr-2">{r.name}</td><td className="ed-small py-1 pr-2">{r.text}</td>
          <td className="ed-small py-1 pr-2 text-right tabular-nums">{r.van == null ? "—" : pctText(r.van)}</td><td className="ed-small py-1 pr-2 text-right tabular-nums">{r.rest == null ? "—" : pctText(r.rest)}</td>
          <td className="py-1"><LeadLagSpark rows={d.leadRows[r.signal] ?? []} label={`${r.name}: ${r.text}`} /></td>
        </tr>)}</tbody>
      </table>
      <p className="ed-caption mt-2">{d.ranks.length} signals ranked; {d.ranks.filter(r => r.kind === "ahead").length} with the vanguard ahead, {d.ranks.filter(r => r.kind === "behind").length} behind.</p>
    </section>
    <section className="mt-10" data-held-study="how-a-homepage-is-built" aria-label="How a homepage is built">
      <h3 className="ed-h3">How a homepage is built</h3>
      <PageAnatomyYears years={[{ label: d.anatomy.quarter?.slice(0, 4) ?? "—", pages }]} title="The typical homepage, by year" source={src(`structure readings, ${q}`)} />
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">{[...bySector].filter(([, p]) => p.length >= 15).sort((a, b) => a[0].localeCompare(b[0])).map(([k, p]) =>
        <PageAnatomyYears key={k} years={[{ label: `${sectorName(k)} ${d.anatomy.quarter?.slice(0, 4) ?? ""}`, pages: p }]} title={`The typical homepage in ${sectorName(k)}`} source={src(q)} />)}</div>
    </section>
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
    <h3 className="ed-kicker ed-rule mt-12 pt-3" id="b2">Proposed in B2, on real data</h3>
    <Suspense fallback={<div className="mt-3 min-h-[900px]" aria-busy="true" />}><B2 /></Suspense>
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
