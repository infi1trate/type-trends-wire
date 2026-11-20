// /signals/leading (W2): leading indicators, public numbers from outside the brands' sites. Read view: one table per topic (name,
// installs last week, change against four weeks earlier once the data allows it, GitHub stars, a small line of weekly installs),
// the Google Fonts risers under the type table, and a plain method note. Data view (?view=data, same address): one dense sortable
// table, a CSV of exactly what is shown, and each row's raw dated points on expand. Levels and directions only; no causal claims.
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { indicatorPointsQuery, indicatorsQuery } from "@/lib/data";
import { byInstalls, exact, readable, toCsv, type FontRisers, type IndicatorRow, type TopicTable } from "@/lib/indicators/series";
import { pr } from "@/components/digest/Editorial";
import { Spark } from "./Bits";
import { line as voiced } from "@/lib/voice";

export const LEADING_TITLE = "Leading indicators";
export const LEADING_DECK = "What builders are installing, before brands show it: public install counts and repository records for the libraries behind the patterns we track.";
export const NOT_STARTED_LINE = voiced("leading.notStarted");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const dayText = (iso: string) => { const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso); return Number.isFinite(d.getTime()) ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : iso; };
export const stampText = (iso: string) => { const d = new Date(iso); return Number.isFinite(d.getTime()) ? `${dayText(iso)}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC` : iso; };
/** "Numbers last read 20 Nov 2026, 05:37 UTC" or the not-started line. */
export const lastReadLine = (lastRead: string | null) => (lastRead ? `Numbers last read ${stampText(lastRead)}.` : NOT_STARTED_LINE);

const ext = (href: string) => ({ href, target: "_blank", rel: "noopener", ...pr(href) });
const Dash = ({ why }: { why: string }) => <span className="ed-muted" title={why} aria-label={why}>—</span>;
const Figure = ({ v, unit }: { v: { value: number; period_end: string } | null | undefined; unit: string }) =>
  v ? <span className="tabular-nums" title={`${exact(v.value)} ${unit} · ${dayText(v.period_end)}`}>{readable(v.value)}</span> : <Dash why={`No ${unit} stored`} />;
const Change = ({ r }: { r: IndicatorRow }) => {
  const c = r.npm?.change;
  return c ? <span className="tabular-nums" title={`${exact(c.from.value)} (week to ${dayText(c.from.period_end)}) → ${exact(c.to.value)} (week to ${dayText(c.to.period_end)})`}>{c.text}</span>
    : <Dash why="Needs two weekly counts at least 21 days apart" />;
};
const Stars = ({ r }: { r: IndicatorRow }) => r.github?.stars
  ? <a {...ext(r.github.href)} className="ed-tap tabular-nums" title={`${exact(r.github.stars.value)} stars · ${dayText(r.github.stars.period_end)} · ${r.github.key}`}>{readable(r.github.stars.value)}</a>
  : <Dash why="GitHub repository not stored" />;
const Line = ({ r }: { r: IndicatorRow }) => r.npm && r.npm.weekly.length
  ? <Spark points={r.npm.weekly.map(p => p.value)} label={`${r.label}, npm installs per week`} what={`weekly installs, ${r.npm.weekly.length} weeks`} />
  : <Dash why="A small line appears once four weekly counts exist" />;
const Name = ({ r }: { r: IndicatorRow }) => r.npm ? <a {...ext(r.npm.href)} className="ed-tap font-semibold" title={`${r.npm.key} on npm`}>{r.label}</a> : <span className="font-semibold">{r.label}</span>;

// READ VIEW ---------------------------------------------------------------------------------------------
function TopicBlock({ t, fonts }: { t: TopicTable; fonts?: FontRisers | undefined }) {
  return <section className="mt-10 first:mt-0" aria-labelledby={t.anchor} data-topic={t.topic}>
    <h2 id={t.anchor} className="ed-h2 scroll-mt-24">{t.name}</h2>
    {t.rows.length ? <table className="ed-data ruled-table mt-3 w-full border-collapse text-left" data-leading-table={t.topic}>
      <caption className="sr-only">{t.name}: npm installs last week, change against four weeks earlier, GitHub stars and weekly installs</caption>
      <thead><tr>
        <th scope="col" className="py-2 font-normal">Library</th>
        <th scope="col" className="py-2 text-right font-normal">Installs last week</th>
        <th scope="col" className="py-2 text-right font-normal">vs four weeks earlier</th>
        <th scope="col" className="py-2 text-right font-normal max-sm:hidden">GitHub stars</th>
        <th scope="col" className="py-2 pl-4 font-normal max-sm:hidden">Weekly installs</th>
      </tr></thead>
      <tbody>{t.rows.map(r => <tr key={r.label} data-row={r.label}>
        <td className="py-2 pr-2 align-top"><Name r={r} />
          {/* On a phone the stars and the small line move under the name. */}
          <div className="ed-caption sm:hidden">Stars <Stars r={r} /> · <Line r={r} /></div></td>
        <td className="py-2 text-right align-top"><Figure v={r.npm?.installs} unit="npm installs in the week" /></td>
        <td className="py-2 text-right align-top"><Change r={r} /></td>
        <td className="py-2 text-right align-top max-sm:hidden"><Stars r={r} /></td>
        <td className="py-2 pl-4 align-top max-sm:hidden"><Line r={r} /></td>
      </tr>)}</tbody>
    </table> : <p className="ed-small mt-3 ed-muted" data-empty-topic="">{voiced("leading.topicEmpty")}</p>}
    {fonts && <FontsBlock f={fonts} />}
  </section>;
}
const fontHref = (family: string) => `https://fonts.google.com/specimen/${family.replace(/ /g, "+")}`;
function FontsBlock({ f }: { f: FontRisers }) {
  if (f.mode === "none") return <p className="ed-small mt-6">{voiced("leading.fontsEmpty")}</p>;
  return <div className="mt-8" data-font-risers={f.mode}>
    <h3 className="ed-kicker">{f.mode === "risers" ? "Google Fonts: the ten fastest-rising families" : "Google Fonts: the current top ten families"}</h3>
    <p className="ed-caption mt-1">{f.mode === "risers"
      ? `Popularity rank on ${dayText(f.now)} against ${dayText(f.then)}, among families now in the top 500. Ranks kept since ${dayText(f.since)}.`
      : `Ranks have been kept since ${dayText(f.since)}; four weeks of ranks do not exist yet, so this is the top ten on ${dayText(f.now)}.`}</p>
    <table className="ed-data ruled-table mt-3 w-full border-collapse text-left">
      <caption className="sr-only">Google Fonts popularity ranks</caption>
      <thead><tr><th scope="col" className="py-2 font-normal">Family</th><th scope="col" className="py-2 text-right font-normal">Rank now</th>{f.mode === "risers" && <th scope="col" className="py-2 text-right font-normal">Four weeks ago</th>}</tr></thead>
      <tbody>{f.items.map(i => <tr key={i.family}><td className="py-2"><a {...ext(fontHref(i.family))} className="ed-tap">{i.family}</a></td><td className="py-2 text-right tabular-nums">{i.now}</td>{"then" in i && <td className="py-2 text-right tabular-nums">{i.then}</td>}</tr>)}</tbody>
    </table>
  </div>;
}
export function MethodNote({ began }: { began: string | null }) {
  return <section className="mt-12" aria-labelledby="lead-method" data-method="">
    <h2 id="lead-method" className="ed-h2">How to read these numbers</h2>
    <div className="ed-small mt-3 grid max-w-[68ch] gap-3">
      <p>Installs are npm's public download counts for the seven days ending on the date shown. Stars come from GitHub's public repository record on that day. Font ranks are Google Fonts' public popularity order, read daily.</p>
      <p>Installs include automated builds and continuous integration, so they measure use by builders, not by people visiting sites. These are indicators of what builders reach for, not a count of brands, and nothing here says that one number causes or predicts another.</p>
      <p>A change appears only once two weekly counts at least 21 days apart exist; until then the column shows a dash. {began ? `Collection began on ${dayText(began)}.` : "Collection has not begun."} <Link to="/what-we-show" className="ed-tap" {...pr("/what-we-show")}>What we show and why →</Link></p>
    </div>
  </section>;
}
export function LeadingRead() {
  const { data } = useSuspenseQuery(indicatorsQuery());
  return <div data-leading="read">
    {data.tables.map(t => <TopicBlock key={t.topic} t={t} fonts={t.topic === "type" ? data.fonts : undefined} />)}
    <MethodNote began={data.began} />
  </div>;
}

// DATA VIEW ---------------------------------------------------------------------------------------------
type Col = { id: string; name: string; num: boolean; get: (r: IndicatorRow) => number | string | null };
const COLS: Col[] = [
  { id: "label", name: "Library", num: false, get: r => r.label },
  { id: "topic", name: "Topic", num: false, get: r => r.topic },
  { id: "installs", name: "Installs (week)", num: true, get: r => r.npm?.installs?.value ?? null },
  { id: "change", name: "4-week change %", num: true, get: r => r.npm?.change ? Math.round(r.npm.change.pct * 10) / 10 : null },
  { id: "stars", name: "Stars", num: true, get: r => r.github?.stars?.value ?? null },
  { id: "forks", name: "Forks", num: true, get: r => r.github?.forks?.value ?? null },
  { id: "issues", name: "Open issues", num: true, get: r => r.github?.issues?.value ?? null },
];
export function sortRows(rows: IndicatorRow[], col: string, desc: boolean): IndicatorRow[] {
  const c = COLS.find(x => x.id === col);
  if (!c) return [...rows].sort(byInstalls);
  return [...rows].sort((a, b) => {
    const x = c.get(a), y = c.get(b);
    if (x === null && y === null) return a.label.localeCompare(b.label);
    if (x === null) return 1; if (y === null) return -1;
    const n = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    return (desc ? -n : n) || a.label.localeCompare(b.label);
  });
}
function Points({ label }: { label: string }) {
  const { data, isPending, isError } = useQuery(indicatorPointsQuery(label));
  if (isPending) return <p className="ed-caption" aria-busy="true">{voiced("leading.pointsLoading")}</p>;
  if (isError || !data) return <p className="ed-caption">{voiced("leading.pointsFailed")}</p>;
  return <table className="ed-data w-full border-collapse text-left"><caption className="sr-only">Every stored point for {label}</caption>
    <thead><tr><th scope="col" className="py-1 font-normal">Date</th><th scope="col" className="py-1 font-normal">Source</th><th scope="col" className="py-1 font-normal">Key</th><th scope="col" className="py-1 font-normal">Metric</th><th scope="col" className="py-1 text-right font-normal">Value</th></tr></thead>
    <tbody>{data.map(p => <tr key={`${p.source}|${p.key}|${p.metric}|${p.period_end}`}><td className="py-1">{p.period_end}</td><td className="py-1">{p.source}</td><td className="py-1 break-all">{p.key}</td><td className="py-1">{p.metric}</td><td className="py-1 text-right tabular-nums">{exact(p.value)}</td></tr>)}</tbody>
  </table>;
}
export function LeadingData() {
  const { data } = useSuspenseQuery(indicatorsQuery());
  const all = useMemo(() => data.tables.flatMap(t => t.rows), [data]);
  const [sort, setSort] = useState<{ col: string; desc: boolean }>({ col: "installs", desc: true }), [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(() => sortRows(all, sort.col, sort.desc), [all, sort]);
  const download = () => {
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" })), a = document.createElement("a");
    a.href = url; a.download = `leading-indicators-${(data.lastRead ?? new Date().toISOString()).slice(0, 10)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section aria-label="All leading indicators" data-leading="data">
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <p className="ed-caption" aria-live="polite">{rows.length} libraries · sorted by {COLS.find(c => c.id === sort.col)?.name ?? "installs"}{sort.desc ? ", highest first" : ", lowest first"} · exact values</p>
      <button type="button" onClick={download} className="ed-tap cursor-pointer underline" disabled={!rows.length}>Download CSV of this table</button>
    </div>
    <div className="mt-3 overflow-x-auto"><table className="ed-data ruled-table w-full min-w-[760px] border-collapse text-left" data-leading-data="">
      <caption className="sr-only">Leading indicators across all topics; column buttons sort the table</caption>
      <thead><tr>{COLS.map(c => <th key={c.id} scope="col" aria-sort={sort.col === c.id ? (sort.desc ? "descending" : "ascending") : "none"} className={`py-1 font-normal ${c.num ? "text-right" : ""}`}>
        <button type="button" className="ed-tap cursor-pointer" onClick={() => setSort(s => ({ col: c.id, desc: s.col === c.id ? !s.desc : c.num }))}>{c.name}{sort.col === c.id ? (sort.desc ? " ↓" : " ↑") : ""}</button>
      </th>)}<th scope="col" className="py-1 font-normal"><span className="sr-only">Points</span></th></tr></thead>
      <tbody>{rows.map(r => <RowData key={r.label} r={r} open={open === r.label} toggle={() => setOpen(o => (o === r.label ? null : r.label))} />)}</tbody>
    </table></div>
  </section>;
}
function RowData({ r, open, toggle }: { r: IndicatorRow; open: boolean; toggle: () => void }) {
  const id = `pts-${r.label.replace(/[^a-z0-9]+/gi, "-")}`;
  return <>
    <tr data-row={r.label}>{COLS.map(c => { const v = c.get(r); return <td key={c.id} className={`py-1 pr-3 ${c.num ? "text-right tabular-nums" : ""}`}>{v === null ? "—" : c.num && c.id !== "change" ? exact(v as number) : String(v)}</td>; })}
      <td className="py-1"><button type="button" className="ed-tap cursor-pointer" aria-expanded={open} aria-controls={id} onClick={toggle}>{open ? "Hide points" : "Points"}</button></td></tr>
    {open && <tr id={id}><td colSpan={COLS.length + 1} className="py-2"><Points label={r.label} /></td></tr>}
  </>;
}
