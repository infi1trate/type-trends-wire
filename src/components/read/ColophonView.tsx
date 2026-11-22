// L1 · /colophon: how slug's own design changes. Read view: what this page is, what never moves, the settings with live specimens,
// the editions newest first and what the next edition would propose today (not decided). Data view (?view=data): the register, the
// rules, the dry run with its receipts and the editions as tables, each with Copy as CSV. Built from existing parts and tokens only.
import { useSuspenseQuery } from "@tanstack/react-query";
import type { CSSProperties, ReactNode } from "react";
import { colophonQuery } from "@/lib/data";
import { LIVE_VALUES, statusOf, type EditionRecord } from "@/lib/living/editions";
import { readingLine } from "@/lib/living/reading";
import { SETTINGS, SETTING_IDS, radiusCss, valueText, type LivingValues, type SettingId } from "@/lib/living/settings";
import { COLOPHON_DECK, NEVER_LINES, driverText, dryLine, dryTable, editionLine, editionsTable, rangeText, receiptsTable, registerTable, rulesTable } from "@/lib/living/colophon";
import { SYSTEM, systemOf, systemVars, type SystemTokens } from "@/lib/theme";
import { slugThemeOf } from "@/lib/theme/slug";
import { longDay } from "@/lib/pictures";
import { DataTable } from "@/components/dataview/DataTable";
import { Sparkline } from "@/components/chartkit";
import { SystemSpecimens } from "@/components/brand/pages/SystemSpecimens";
import { formsByEdition } from "@/lib/chart/forms";

/** L2 · chart forms by the edition in which they went live (proposed forms are never listed). */
const FORMS_BY_EDITION = new Map(formsByEdition().map(x => [x.edition, x.forms]));

const ms = (x: string) => x.replace(/ms$/, " ms");
const SPARK = [0.12, 0.14, 0.13, 0.17, 0.21, 0.24];
/** A small live sample of each setting at a value set (the live values unless an edition preview passes others), drawn from the tokens. */
function Specimen({ id, v = LIVE_VALUES, sys = SYSTEM }: { id: SettingId; v?: LivingValues; sys?: SystemTokens }): ReactNode {
  if (id === "radius") return <span className="tk-btn inline-flex items-center" aria-hidden="true">A button</span>;
  if (id === "tracking") return <p className="ed-h2" aria-hidden="true">Headline</p>;
  if (id === "accent") return <span className="flex items-center gap-2"><span className="inline-block h-6 w-10 border border-rule" style={{ background: "var(--sys-color-accent)" }} aria-hidden="true" /><span className="ed-small">{valueText("accent", v.accent)}</span></span>;
  if (id === "density") return <span className="ed-small">{sys.space.section.lg} between sections from 1024 px wide, {sys.space.section.base} on phones</span>;
  if (id === "motion") return <span className="ed-small">{ms(sys.motion.duration.move)} for a move; a tap {ms(sys.motion.duration.tap)}, a wipe {ms(sys.motion.duration.wipe)}, an arrival {ms(sys.motion.duration.arrive)}</span>;
  if (id === "chart") return <Sparkline look="read" values={SPARK} label="A sample line at the chart weights shown" />;
  return <span className="ed-small">{valueText(id, v[id])}</span>;
}
/** L3 · a proposed edition drawn twice, under the live values and under its own, side by side (stacked under 1024 px). The proposed side
 *  sets only the changed custom properties on its own box; nothing outside it changes, and no site-wide switch exists. */
function EditionPreview({ e }: { e: EditionRecord }) {
  const proposed = e.values, sysP = systemOf(slugThemeOf(proposed), proposed), live = systemVars(SYSTEM, "read"), next = systemVars(sysP, "read");
  const vars: Record<string, string> = Object.fromEntries(Object.entries(next).filter(([k, x]) => live[k] !== x));
  for (const k of ["--tk-radius-sm", "--tk-radius-md", "--tk-radius-pill"]) vars[k] = radiusCss(proposed.radius);
  const moved = new Map(e.moves.map(m => [m.setting, m]));
  const side = (title: string, v: LivingValues, sys: SystemTokens, style?: CSSProperties) => <div className="ed-hair min-w-0 pt-3" style={style}>
    <h3 className="ed-h3">{title}</h3>
    <ul className="mt-3 space-y-5">{SETTING_IDS.filter(id => moved.has(id)).map(id => { const m = moved.get(id)!; return <li key={id}>
      <p className="ed-kicker">{SETTINGS[id].name}: {valueText(id, m.from)} to {valueText(id, m.to)}</p>
      <div className="mt-2 min-h-11"><Specimen id={id} v={v} sys={sys} /></div>
    </li>; })}</ul>
    <div className="mt-6"><SystemSpecimens sys={sys} /></div>
  </div>;
  return <section aria-labelledby="col-preview" className="mt-[var(--sys-gap-section)]" data-edition-preview={e.number}>
    <h2 id="col-preview" className="ed-kicker ed-rule pt-3">Edition {e.number}, proposed: a preview</h2>
    <p className="ed-small mt-2 max-w-[68ch]"><span className="bg-highlight px-1 font-semibold text-ink">Not live.</span> The /brand/system samples under today's values and under the proposed ones, each move labelled with its from and to. Only the owner can approve an edition; its values then ship in code through the release gate.</p>
    <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">{side("Live now", LIVE_VALUES, SYSTEM)}{side(`Edition ${e.number}, proposed`, proposed, sysP, vars as CSSProperties)}</div>
  </section>;
}

export function ColophonRead() {
  const { data } = useSuspenseQuery(colophonQuery());
  const dry = data.dry?.rows ?? null, readings = data.readings ?? [];
  // L3 · the newest edition whose latest status is "proposed" (none: no preview block).
  const proposed = data.editions.find(e => statusOf(e) === "proposed") ?? null;
  return <div className="ed-wrap">
    <section aria-labelledby="col-never" className="mt-[var(--sys-gap-section)]">
      <h2 id="col-never" className="ed-kicker ed-rule pt-3">What never moves</h2>
      <ul className="ed-small mt-3 max-w-[68ch] list-disc pl-5">{NEVER_LINES.map(l => <li key={l}>{l}.</li>)}</ul>
      <p className="ed-small mt-3 max-w-[68ch]">Only the owner can change these. Between editions nothing changes except the pictures on stories, studies and Digest covers.</p>
    </section>
    <section aria-labelledby="col-may" className="mt-[var(--sys-gap-section)]">
      <h2 id="col-may" className="ed-kicker ed-rule pt-3">What may move, and where it is now</h2>
      <p className="ed-small mt-2 max-w-[68ch]">Each setting has a floor, a ceiling and a largest step per edition. The limits below are proposed and wait for the owner's yes.</p>
      <ul className="ed-grid mt-6 gap-y-8">{SETTING_IDS.map(id => <li key={id} className="ed-hair pt-3 md:col-span-6 lg:col-span-4" data-setting={id}>
        <h3 className="ed-h3">{SETTINGS[id].name}</h3>
        <p className="ed-small mt-1">{SETTINGS[id].what}</p>
        <div className="mt-3 min-h-11">{<Specimen id={id} />}</div>
        <p className="ed-small mt-2"><span className="font-semibold">Now:</span> {valueText(id, LIVE_VALUES[id])}. <span className="font-semibold">May move:</span> {rangeText(id)}.</p>
        <p className="ed-caption mt-1">{driverText(id, dry)}</p>
      </li>)}</ul>
    </section>
    <section aria-labelledby="col-editions" className="mt-[var(--sys-gap-section)]">
      <h2 id="col-editions" className="ed-kicker ed-rule pt-3">Editions, newest first</h2>
      <ol className="mt-3">{data.editions.map(e => { const l = editionLine(e); return <li key={e.number} className="ed-hair py-3" data-edition={e.number}>
        <p className="ed-h3">{l.title} · {l.status}</p><p className="ed-caption mt-1">{l.when}</p><p className="ed-small mt-1 max-w-[68ch]">{l.what}</p>
        {FORMS_BY_EDITION.get(e.number) && <p className="ed-caption mt-1" data-edition-forms="">Chart forms in use from this edition: {FORMS_BY_EDITION.get(e.number)!.join(", ")}.</p>}
      </li>; })}</ol>
    </section>
    {proposed && <EditionPreview e={proposed} />}
    {readings.length > 0 && <section aria-labelledby="col-readings" className="mt-[var(--sys-gap-section)]" data-readings="">
      <h2 id="col-readings" className="ed-kicker ed-rule pt-3">Readings, newest first</h2>
      <ul className="ed-small mt-3 max-w-[68ch] space-y-2">{readings.map(r => <li key={r.month} data-reading={r.month}>{readingLine(r)}{r.proposed_edition == null ? ` ${r.note}` : ""}</li>)}</ul>
    </section>}
    <section aria-labelledby="col-next" className="mt-[var(--sys-gap-section)]" data-dry-run="">
      <h2 id="col-next" className="ed-kicker ed-rule pt-3">What the next edition would propose today</h2>
      <p className="ed-small mt-2 max-w-[68ch]"><span className="bg-highlight px-1 font-semibold text-ink">Not decided.</span> This is what the rules say today; nothing has changed. The next edition is decided later, and the first three need the owner's yes.</p>
      {dry ? <ul className="ed-small mt-3 max-w-[68ch] space-y-2">{dry.map(r => <li key={r.setting}>{dryLine(r)}</li>)}</ul> : <p className="ed-small mt-3">The leading brands' numbers could not be read just now.</p>}
      {data.dry && <p className="ed-caption mt-3">Leading brands read: {data.dry.group} of the top 30 in the trendsetter ranking with a current capture, {longDay(data.read_at)}.</p>}
    </section>
  </div>;
}

export function ColophonData() {
  const { data } = useSuspenseQuery(colophonQuery());
  const t = (x: { head: string[]; rows: string[][] }, caption: string, id: string, name: string) => <DataTable caption={caption} head={x.head} rows={x.rows} csv={{ name, rows: x.rows }} id={id} />;
  return <div className="ed-wrap mt-8 space-y-10">
    {t(registerTable(LIVE_VALUES), "Settings register", "col-register", "colophon-register")}
    {t(rulesTable(), "Rules (proposed)", "col-rules", "colophon-rules")}
    {data.dry ? t(dryTable(data.dry.rows), `Dry run for the next edition, not decided (${data.dry.group} leading brands)`, "col-dry", "colophon-dry-run") : <p className="ed-small">The dry run could not be read just now.</p>}
    {t(receiptsTable(data.leading), "Receipts: the leading brands' measured fields", "col-receipts", "colophon-receipts")}
    {t(editionsTable(data.editions), "Editions", "col-editions-table", "colophon-editions")}
  </div>;
}
