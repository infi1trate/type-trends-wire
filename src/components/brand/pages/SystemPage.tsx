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
import { SYSTEM, COLOR_ROLES, TYPE_STEPS, sysText, type SystemView } from "@/lib/theme";
import { KEY_MAP, SECTIONS } from "@/lib/ia";
import { pctText } from "@/lib/labels";
import { BrandShell, Screen } from "./BrandPages";
import { QuarterLine, Bars, Sparkline, SmallMultiples, BeforeAfterStrip, type Look } from "@/components/chartkit";
import { FIXTURE_LABEL, FIXTURE_QUARTERS, fixtureBars, fixtureBeforeAfter, fixtureCard, fixtureMultiples, fixtureValues, fixtureView } from "@/components/chartkit/fixture";

const VIEWS: { v: Exclude<SystemView, "cover">; mode: "light" | "dark"; name: string }[] = [{ v: "read", mode: "light", name: "Read" }, { v: "data", mode: "dark", name: "Data" }];
const Th = ({ children }: { children: ReactNode }) => <th scope="col" className="ed-kicker border-b-[1.5px] border-ed-ink p-2 text-left align-bottom">{children}</th>;
const Td = ({ children, mono = false }: { children: ReactNode; mono?: boolean }) => <td className={`border-b border-rule p-2 align-top ${mono ? "ed-data" : ""}`}>{children}</td>;
function Table({ caption, head, children }: { caption: string; head: string[]; children: ReactNode }) {
  return <div className="max-w-full overflow-x-auto" tabIndex={0} role="region" aria-label={caption}>
    <table className="w-full min-w-[36rem] border-collapse"><caption className="sr-only">{caption}</caption><thead><tr>{head.map(h => <Th key={h}>{h}</Th>)}</tr></thead><tbody>{children}</tbody></table>
  </div>;
}
/** A swatch drawn from the role itself inside the view's own mode, so it shows what that view shows. */
const Swatch = ({ role, mode }: { role: string; mode: "light" | "dark" }) => <span className="inline-block h-6 w-10 shrink-0 border border-rule align-middle" aria-hidden="true"><span data-mode={mode} className="block h-full w-full" style={{ background: `var(--sys-color-${role})` }} /></span>;

function Colours() {
  return <Table caption="Colour roles, Read and Data" head={["Role", "What it does", "Read", "Data"]}>
    {COLOR_ROLES.map(r => <tr key={r} data-sys-role={r}>
      <Td mono>{r}</Td><Td>{SYSTEM.color[r].what}</Td>
      {VIEWS.map(x => <Td key={x.v} mono><span className="flex items-center gap-2"><Swatch role={r} mode={x.mode} />{SYSTEM.color[r][x.v]}</span></Td>)}
    </tr>)}
  </Table>;
}
const size = (t: (typeof SYSTEM.type)[keyof typeof SYSTEM.type]["read"]) => [t.size, t.sizeMd, t.sizeXl].filter(Boolean).join(" → ") + ` / ${[t.leading, t.leadingMd].filter(Boolean).join(" → ")}`;
function TypeSteps() {
  return <Table caption="Type steps, Read and Data" head={["Step", "Read (size / leading)", "Data (size / leading)", "Sample"]}>
    {TYPE_STEPS.map(s => <tr key={s} data-sys-step={s}>
      <Td mono>{s}</Td>{VIEWS.map(x => <Td key={x.v} mono>{SYSTEM.type[s][x.v].family} {SYSTEM.type[s][x.v].weight} · {size(SYSTEM.type[s][x.v])}</Td>)}
      <Td><span data-mode="light" className="block bg-page p-1 text-ink" style={{ fontFamily: `var(${sysText(s, "family")})`, fontSize: `var(${sysText(s, "size")})`, lineHeight: `var(${sysText(s, "leading")})`, fontWeight: `var(${sysText(s, "weight")})` as never, letterSpacing: `var(${sysText(s, "tracking")})`, textTransform: `var(${sysText(s, "case")})` as never }}>Serif headlines</span></Td>
    </tr>)}
  </Table>;
}
function SpaceShapeMotion() {
  const rows: [string, string, string][] = [
    ...Object.entries(SYSTEM.space.scale).map(([k, v]) => [`space-${k}`, v, "Spacing step"] as [string, string, string]),
    ["gap-section", `${SYSTEM.space.section.base} → ${SYSTEM.space.section.lg} from 1024 px`, "Between a page's sections"],
    ["gutter", `${SYSTEM.space.gutter} → ${SYSTEM.space.gutterLg}`, "Page gutter"], ["tap", SYSTEM.space.tap, "Smallest touch target"],
    ["radius", SYSTEM.shape.radius.sm, "Square corners (print)"], ["radius-round", SYSTEM.shape.radius.sticker, "Round objects (stickers)"],
    ["rule-hairline", SYSTEM.shape.rule.hairline, "Hairline rule"], ["rule-strong", SYSTEM.shape.rule.strong, "Strong rule"], ["measure", SYSTEM.shape.measure, "Reading measure"],
    ...Object.entries(SYSTEM.motion.duration).map(([k, v]) => [`motion-${k}`, v, "Duration"] as [string, string, string]),
    ...Object.entries(SYSTEM.motion.ease).map(([k, v]) => [`ease-${k}`, v, "Easing"] as [string, string, string]),
  ];
  return <>
    <Table caption="Space, shape and motion" head={["Name", "Value", "Used for"]}>{rows.map(([n, v, w]) => <tr key={n}><Td mono>{n}</Td><Td mono>{v}</Td><Td>{w}</Td></tr>)}</Table>
    <p className="ed-small mt-4">{SYSTEM.motion.reduced}</p>
  </>;
}
function Look({ look, children }: { look: Look; children: ReactNode }) {
  return <figure data-mode={look === "read" ? "light" : "dark"} data-density={look === "data" ? "loud" : undefined} className="min-w-0 border border-rule bg-page p-3 text-ink" data-look={look}>
    <figcaption className="ed-kicker mb-2">{look === "read" ? "Read" : "Data"}</figcaption>{children}
  </figure>;
}
function Pair({ title, read, data, form }: { title: string; read: ReactNode; data: ReactNode; form?: ChartForm }) {
  return <section className="mt-10 first:mt-0" aria-label={title} data-form={form?.id} data-form-status={form?.status}>
    <h3 className="ed-h3">{title}{form?.status === "proposed" && <span className="ed-kicker ml-3 bg-highlight px-1 align-middle text-ink" data-proposed="">Proposed, not in use</span>}</h3>
    {form && <p className="ed-small mt-1 max-w-[68ch]"><span className="font-semibold">Use when:</span> {form.use} <span className="font-semibold">Least data:</span> {form.least}.</p>}
    <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2"><Look look="read">{read}</Look><Look look="data">{data}</Look></div>
  </section>;
}
const formOf = (id: string) => FORMS.find(f => f.id === id)!;
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
  const card = fixtureCard(), bars = fixtureBars(), values = fixtureValues(), mult = fixtureMultiples(), ba = fixtureBeforeAfter();
  return <>
    <p className="ed-small">Every form the product can draw, from one registry. A proposed form is shown only here, until the owner accepts it and a checked build makes it live.</p>
    <div className="mt-4"><Registry /></div>
    <p className="ed-small mt-8">One fixture for the live kit forms: {FIXTURE_LABEL}, {FIXTURE_QUARTERS.length} quarters, latest {pctText(FIXTURE_QUARTERS.at(-1)!.s!)}. Each chart carries its data table for screen readers.</p>
    <Pair form={formOf("quarter-line")} title="Line by quarter" read={<QuarterLine look="read" card={card} label={FIXTURE_LABEL} caption="Share of tracked homepages by quarter." basis="measured" />} data={<QuarterLine look="data" quarters={FIXTURE_QUARTERS} proj={[]} large label={FIXTURE_LABEL} />} />
    <Pair form={formOf("bars")} title="Bars" read={<Bars look="read" title={FIXTURE_LABEL} note="Share by quarter" source="slug measurements" bars={bars.map(b => ({ id: b.q, label: b.q, value: b.share ?? 0 }))} format={pctText} valueLabel="Share" />} data={<Bars look="data" label={FIXTURE_LABEL} points={bars} />} />
    <Pair form={formOf("sparkline")} title="Sparkline" read={<Sparkline look="read" values={values} label={FIXTURE_LABEL} />} data={<Sparkline look="data" values={values} label={FIXTURE_LABEL} />} />
    <Pair form={formOf("small-multiples")} title="Small multiples" read={<SmallMultiples f={mult} v={fixtureView("m")} look="read" />} data={<SmallMultiples f={mult} v={fixtureView("m")} look="data" />} />
    <Pair form={formOf("before-after-strip")} title="Before and after" read={<BeforeAfterStrip f={ba} v={fixtureView("b")} pair look="read" />} data={<BeforeAfterStrip f={ba} v={fixtureView("b")} pair look="data" />} />
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
