// L1 · /colophon: how slug's own design changes. Read view: what this page is, what never moves, the settings with live specimens,
// the editions newest first and what the next edition would propose today (not decided). Data view (?view=data): the register, the
// rules, the dry run with its receipts and the editions as tables, each with Copy as CSV. Built from existing parts and tokens only.
import { useSuspenseQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { colophonQuery } from "@/lib/data";
import { LIVE_VALUES } from "@/lib/living/editions";
import { SETTINGS, SETTING_IDS, valueText, type SettingId } from "@/lib/living/settings";
import { COLOPHON_DECK, NEVER_LINES, driverText, dryLine, dryTable, editionLine, editionsTable, rangeText, receiptsTable, registerTable, rulesTable } from "@/lib/living/colophon";
import { SYSTEM } from "@/lib/theme";
import { longDay } from "@/lib/pictures";
import { DataTable } from "@/components/dataview/DataTable";
import { Sparkline } from "@/components/chartkit";

const ms = (x: string) => x.replace(/ms$/, " ms");
const SPARK = [0.12, 0.14, 0.13, 0.17, 0.21, 0.24];
/** A small live sample of each setting at its current value, drawn from the tokens themselves. */
function Specimen({ id }: { id: SettingId }): ReactNode {
  if (id === "radius") return <span className="tk-btn inline-flex items-center" aria-hidden="true">A button</span>;
  if (id === "tracking") return <p className="ed-h2" aria-hidden="true">Headline</p>;
  if (id === "accent") return <span className="flex items-center gap-2"><span className="inline-block h-6 w-10 border border-rule" style={{ background: "var(--sys-color-accent)" }} aria-hidden="true" /><span className="ed-small">{valueText("accent", LIVE_VALUES.accent)}</span></span>;
  if (id === "density") return <span className="ed-small">{SYSTEM.space.section.lg} between sections from 1024 px wide, {SYSTEM.space.section.base} on phones</span>;
  if (id === "motion") return <span className="ed-small">{ms(SYSTEM.motion.duration.move)} for a move; a tap {ms(SYSTEM.motion.duration.tap)}, a wipe {ms(SYSTEM.motion.duration.wipe)}, an arrival {ms(SYSTEM.motion.duration.arrive)}</span>;
  if (id === "chart") return <Sparkline look="read" values={SPARK} label="A sample line at today's chart weights" />;
  return <span className="ed-small">{valueText(id, LIVE_VALUES[id])}</span>;
}

export function ColophonRead() {
  const { data } = useSuspenseQuery(colophonQuery());
  const dry = data.dry?.rows ?? null;
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
      </li>; })}</ol>
    </section>
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
