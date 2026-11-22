// The /brand/system value tables and live kit specimens, under one set of values: /brand/system draws them under SYSTEM, and the
// colophon's preview of a proposed edition draws them twice (live and proposed). Kept apart from SystemPage so the colophon never
// loads the proposed chart forms, which are drawn on /brand/system only.
import type { ReactNode } from "react";
import { FORMS } from "@/lib/chart/forms";
import { pctText } from "@/lib/labels";
import { SYSTEM, COLOR_ROLES, TYPE_STEPS, sysText, type SystemTokens, type SystemView } from "@/lib/theme";
import { QuarterLine, Bars, Sparkline, SmallMultiples, BeforeAfterStrip, type Look } from "@/components/chartkit";
import { FIXTURE_LABEL, FIXTURE_QUARTERS, fixtureBars, fixtureBeforeAfter, fixtureCard, fixtureMultiples, fixtureValues, fixtureView } from "@/components/chartkit/fixture";
import type { ChartForm } from "@/lib/chart/forms";

const VIEWS: { v: Exclude<SystemView, "cover">; mode: "light" | "dark"; name: string }[] = [{ v: "read", mode: "light", name: "Read" }, { v: "data", mode: "dark", name: "Data" }];
const Th = ({ children }: { children: ReactNode }) => <th scope="col" className="ed-kicker border-b-[1.5px] border-ed-ink p-2 text-left align-bottom">{children}</th>;
export const Td = ({ children, mono = false }: { children: ReactNode; mono?: boolean }) => <td className={`border-b border-rule p-2 align-top ${mono ? "ed-data" : ""}`}>{children}</td>;
export function Table({ caption, head, children }: { caption: string; head: string[]; children: ReactNode }) {
  return <div className="max-w-full overflow-x-auto" tabIndex={0} role="region" aria-label={caption}>
    <table className="w-full min-w-[36rem] border-collapse"><caption className="sr-only">{caption}</caption><thead><tr>{head.map(h => <Th key={h}>{h}</Th>)}</tr></thead><tbody>{children}</tbody></table>
  </div>;
}
/** A swatch drawn from the role itself inside the view's own mode, so it shows what that view shows. */
// L3 · `sys` other than SYSTEM (a proposed edition's preview on /colophon) draws its own values directly, since a mode box resets the
// custom properties; /brand/system itself always passes SYSTEM and reads the properties as before.
const Swatch = ({ role, mode, value }: { role: string; mode: "light" | "dark"; value?: string }) => <span className="inline-block h-6 w-10 shrink-0 border border-rule align-middle" aria-hidden="true"><span data-mode={mode} className="block h-full w-full" style={{ background: value ?? `var(--sys-color-${role})` }} /></span>;

function Colours({ sys = SYSTEM }: { sys?: SystemTokens }) {
  return <Table caption="Colour roles, Read and Data" head={["Role", "What it does", "Read", "Data"]}>
    {COLOR_ROLES.map(r => <tr key={r} data-sys-role={r}>
      <Td mono>{r}</Td><Td>{sys.color[r].what}</Td>
      {VIEWS.map(x => <Td key={x.v} mono><span className="flex items-center gap-2"><Swatch role={r} mode={x.mode} {...(sys !== SYSTEM ? { value: sys.color[r][x.v] } : {})} />{sys.color[r][x.v]}</span></Td>)}
    </tr>)}
  </Table>;
}
const size = (t: SystemTokens["type"][keyof SystemTokens["type"]]["read"]) => [t.size, t.sizeMd, t.sizeXl].filter(Boolean).join(" → ") + ` / ${[t.leading, t.leadingMd].filter(Boolean).join(" → ")}`;
function TypeSteps({ sys = SYSTEM }: { sys?: SystemTokens }) {
  return <Table caption="Type steps, Read and Data" head={["Step", "Read (size / leading)", "Data (size / leading)", "Sample"]}>
    {TYPE_STEPS.map(s => <tr key={s} data-sys-step={s}>
      <Td mono>{s}</Td>{VIEWS.map(x => <Td key={x.v} mono>{sys.type[s][x.v].family} {sys.type[s][x.v].weight} · {size(sys.type[s][x.v])}</Td>)}
      <Td><span data-mode="light" className="block bg-page p-1 text-ink" style={{ fontFamily: `var(${sysText(s, "family")})`, fontSize: `var(${sysText(s, "size")})`, lineHeight: `var(${sysText(s, "leading")})`, fontWeight: `var(${sysText(s, "weight")})` as never, letterSpacing: sys !== SYSTEM ? sys.type[s].read.tracking : `var(${sysText(s, "tracking")})`, textTransform: `var(${sysText(s, "case")})` as never }}>Serif headlines</span></Td>
    </tr>)}
  </Table>;
}
function SpaceShapeMotion({ sys = SYSTEM }: { sys?: SystemTokens }) {
  const rows: [string, string, string][] = [
    ...Object.entries(sys.space.scale).map(([k, v]) => [`space-${k}`, v, "Spacing step"] as [string, string, string]),
    ["gap-section", `${sys.space.section.base} → ${sys.space.section.lg} from 1024 px`, "Between a page's sections"],
    ["gutter", `${sys.space.gutter} → ${sys.space.gutterLg}`, "Page gutter"], ["tap", sys.space.tap, "Smallest touch target"],
    ["radius", sys.shape.radius.sm, "Square corners (print)"], ["radius-round", sys.shape.radius.sticker, "Round objects (stickers)"],
    ["rule-hairline", sys.shape.rule.hairline, "Hairline rule"], ["rule-strong", sys.shape.rule.strong, "Strong rule"], ["measure", sys.shape.measure, "Reading measure"],
    ...Object.entries(sys.motion.duration).map(([k, v]) => [`motion-${k}`, v, "Duration"] as [string, string, string]),
    ...Object.entries(sys.motion.ease).map(([k, v]) => [`ease-${k}`, v, "Easing"] as [string, string, string]),
  ];
  return <>
    <Table caption="Space, shape and motion" head={["Name", "Value", "Used for"]}>{rows.map(([n, v, w]) => <tr key={n}><Td mono>{n}</Td><Td mono>{v}</Td><Td>{w}</Td></tr>)}</Table>
    <p className="ed-small mt-4">{sys.motion.reduced}</p>
  </>;
}
function Look({ look, children }: { look: Look; children: ReactNode }) {
  return <figure data-mode={look === "read" ? "light" : "dark"} data-density={look === "data" ? "loud" : undefined} className="min-w-0 border border-rule bg-page p-3 text-ink" data-look={look}>
    <figcaption className="ed-kicker mb-2">{look === "read" ? "Read" : "Data"}</figcaption>{children}
  </figure>;
}
export function Pair({ title, read, data, form }: { title: string; read: ReactNode; data: ReactNode; form?: ChartForm }) {
  return <section className="mt-10 first:mt-0" aria-label={title} data-form={form?.id} data-form-status={form?.status}>
    <h3 className="ed-h3">{title}{form?.status === "proposed" && <span className="ed-kicker ml-3 bg-highlight px-1 align-middle text-ink" data-proposed="">Proposed, not in use</span>}</h3>
    {form && <p className="ed-small mt-1 max-w-[68ch]"><span className="font-semibold">Use when:</span> {form.use} <span className="font-semibold">Least data:</span> {form.least}.</p>}
    <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2"><Look look="read">{read}</Look><Look look="data">{data}</Look></div>
  </section>;
}
export const formOf = (id: string) => FORMS.find(f => f.id === id)!;
/** The live kit forms drawn from the one fixture, in both looks (also drawn twice by a proposed edition's preview on /colophon). */
export function KitPairs() {
  const card = fixtureCard(), bars = fixtureBars(), values = fixtureValues(), mult = fixtureMultiples(), ba = fixtureBeforeAfter();
  return <>
    <Pair form={formOf("quarter-line")} title="Line by quarter" read={<QuarterLine look="read" card={card} label={FIXTURE_LABEL} caption="Share of tracked homepages by quarter." basis="measured" />} data={<QuarterLine look="data" quarters={FIXTURE_QUARTERS} proj={[]} large label={FIXTURE_LABEL} />} />
    <Pair form={formOf("bars")} title="Bars" read={<Bars look="read" title={FIXTURE_LABEL} note="Share by quarter" source="slug measurements" bars={bars.map(b => ({ id: b.q, label: b.q, value: b.share ?? 0 }))} format={pctText} valueLabel="Share" />} data={<Bars look="data" label={FIXTURE_LABEL} points={bars} />} />
    <Pair form={formOf("sparkline")} title="Sparkline" read={<Sparkline look="read" values={values} label={FIXTURE_LABEL} />} data={<Sparkline look="data" values={values} label={FIXTURE_LABEL} />} />
    <Pair form={formOf("small-multiples")} title="Small multiples" read={<SmallMultiples f={mult} v={fixtureView("m")} look="read" />} data={<SmallMultiples f={mult} v={fixtureView("m")} look="data" />} />
    <Pair form={formOf("before-after-strip")} title="Before and after" read={<BeforeAfterStrip f={ba} v={fixtureView("b")} pair look="read" />} data={<BeforeAfterStrip f={ba} v={fixtureView("b")} pair look="data" />} />
  </>;
}
/** L3 · the /brand/system specimens (colour roles, type steps, space/shape/motion and the live kit forms) under one set of values, for
 *  the colophon's side-by-side preview of a proposed edition. Nothing here switches the site. */
export function SystemSpecimens({ sys = SYSTEM }: { sys?: SystemTokens }) {
  return <div className="space-y-8">
    <div><h4 className="ed-kicker mb-2">Colour roles</h4><Colours sys={sys} /></div>
    <div><h4 className="ed-kicker mb-2">Type steps</h4><TypeSteps sys={sys} /></div>
    <div><h4 className="ed-kicker mb-2">Space, shape, motion</h4><SpaceShapeMotion sys={sys} /></div>
    <div><h4 className="ed-kicker mb-2">Chart forms</h4><KitPairs /></div>
  </div>;
}
export { Colours, TypeSteps, SpaceShapeMotion };
