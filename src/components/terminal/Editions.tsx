// Terminal › Digest › Morning Line and Sector reports, plus the console's inline `morning` output. Terminal density; same data as Read mode.
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { morningQuery, sectorIndexQuery, sectorReportQuery } from "@/lib/data";
import { storyTime } from "@/lib/stories";
import { Empty, PanelHeader } from "./primitives";
import { StageBadge } from "./Info";
const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);
import type { MorningItem } from "@/lib/editions/morning";

const Row = ({ s, n }: { s: MorningItem; n: number | string }) => <li className="border-b border-rule last:border-b-0">
  <Link to="/stories/$id" params={{ id: s.id }} className="group grid min-h-11 grid-cols-[3ch_1fr] gap-x-2 gap-y-1 p-3 hover:bg-g900 md:grid-cols-[3ch_1fr_auto]">
    <span className="num label text-g500">{n}</span>
    <span className="min-w-0 text-ink"><span className="label text-g500">{s.kicker.toUpperCase()} · </span><span className="group-hover:underline">{s.headline}</span>{s.why.text && <span className="block text-g500">{s.why.text}{s.why.basis === "ai" ? " · AI ESTIMATE" : ""}</span>}</span>
    <span className="label col-start-2 text-g500 md:col-start-3">SCORE {s.score}</span>
  </Link>
</li>;

/** Compact edition: lead + more, opening, held. Used by the tab and the console. */
export function MorningOutput({ day }: { day: string | null }) {
  const { data, isError } = useQuery(morningQuery(day));
  if (isError) return <p className="text-g500">The Morning Line couldn't be read right now.</p>;
  if (data === undefined) return <p className="animate-blink">▍</p>;
  if (!data) return <p className="text-g500">No edition for {day}. Editions are daily (UTC) from the first edition to today.</p>;
  const e = data.edition;
  return <div>
    <p className="label text-g500">{e.title.toUpperCase()} · {e.count} {e.count === 1 ? "STORY" : "STORIES"} · {e.final ? "FINAL" : "UPDATING"}{e.thin ? " · THIN EDITION" : ""} · <Link to="/morning/$date" params={{ date: e.day }} className="text-ink underline-offset-2 hover:underline">READ →</Link></p>
    {e.lead ? <ol className="mt-2 border border-rule">{[e.lead, ...e.more].map((s, i) => <Row key={s.id} s={s} n={i + 1} />)}</ol> : <p className="mt-2 text-g500">No story in this window.</p>}
    <p className="label mt-3 text-g500">OPENING</p>
    {e.opening ? <ol className="border border-rule"><Row s={e.opening} n="◇" /></ol> : <p className="text-g500">No unused white-space story from the last seven days.</p>}
    <p className="label mt-3 text-g500">ON THE DESK</p>
    {e.desk.length ? <ul className="border border-rule">{e.desk.map(h => <li key={h.id} className="border-b border-rule p-3 last:border-b-0"><Link to="/stories/$id" params={{ id: h.id }} className="text-ink hover:underline">{h.headline}</Link><span className="label block text-g500">HELD · {h.reason.toUpperCase()} · SCORE {h.score}</span></li>)}</ul> : <p className="text-g500">Nothing held.</p>}
    {e.lastFull && <p className="mt-3 text-g500">Last full edition: <Link to="/morning/$date" params={{ date: e.lastFull.day }} className="text-ink underline">{e.lastFull.title}</Link></p>}
  </div>;
}

/** F5 DIGEST › MORNING LINE. */
export function MorningTab() {
  const { data } = useQuery(morningQuery(null));
  return <section aria-label="The Morning Line" className="flex min-h-0 flex-1 flex-col md:overflow-y-auto">
    <PanelHeader title="THE MORNING LINE · TODAY" g="s-digest" meta={data ? <>{data.archive.length} EDITIONS · <a href="/morning/rss.xml" className="text-ink hover:underline">RSS</a></> : null} />
    <div className="p-3"><MorningOutput day={null} /></div>
    {data && data.archive.length > 0 && <ol className="divide-y divide-rule border-t border-rule">{data.archive.map(a => <li key={a.day}><Link to="/morning/$date" params={{ date: a.day }} className="grid min-h-11 grid-cols-[11ch_1fr] gap-x-2 p-3 hover:bg-g900">
      <span className="num label text-g500">{a.day}</span><span className="text-ink">{a.lead}<span className="label text-g500"> · {a.count}{a.final ? "" : " · TODAY"}</span></span></Link></li>)}</ol>}
  </section>;
}

/** F5 DIGEST › SECTOR REPORTS: sectors with coverage, then the chosen sector's headline signals in terminal density. */
export function SectorsTab({ sector }: { sector: string }) {
  const { data } = useQuery(sectorIndexQuery());
  const pick = sector !== "all" ? sector : data?.sectors.find(s => s.enough)?.sector ?? null;
  const { data: r } = useQuery({ ...sectorReportQuery(pick ?? "fintech"), enabled: !!pick });
  return <section aria-label="Sector reports" className="flex min-h-0 flex-1 flex-col md:overflow-y-auto">
    <PanelHeader title="SECTOR REPORTS · QUARTERLY" g="s-digest" meta={data ? <>{data.sectors.filter(s => s.enough).length}/{data.sectors.length} COVERED</> : null} />
    {!data ? <p className="p-3 animate-blink">▍</p> : <ol className="divide-y divide-rule">{data.sectors.map(s => <li key={s.sector}><Link to="/sectors/$sector" params={{ sector: s.sector }} className="grid min-h-11 grid-cols-[18ch_1fr] gap-x-2 p-3 hover:bg-g900" aria-current={s.sector === pick ? "true" : undefined}>
      <span className={s.sector === pick ? "text-signal" : "text-ink"}>{s.name.toUpperCase()}</span><span className="label text-g500">{s.brands} BRANDS · {s.covered}/{s.total} MEASURED · {s.stories} STORIES{s.enough ? "" : " · LOW COVERAGE"}</span></Link></li>)}</ol>}
    {r && <div className="border-t border-rule">
      <PanelHeader title={r.title.toUpperCase()} meta={<>AS OF {storyTime(r.as_of).toUpperCase()}</>} />
      {r.signals.length ? <table className="w-full text-left"><caption className="sr-only">Headline signals in {r.name}</caption>
        <thead><tr className="label text-g500"><th scope="col" className="p-2 font-normal">SIGNAL</th><th scope="col" className="p-2 font-normal">HERE</th><th scope="col" className="p-2 font-normal">ALL</th><th scope="col" className="p-2 font-normal">MOMENTUM · ALL SECTORS</th></tr></thead>
        <tbody>{r.signals.map(s => <tr key={s.key} className="border-t border-rule"><th scope="row" className="p-2 font-normal text-ink">{s.name}</th><td className="p-2"><StageBadge stage={s.here.stage} /> <span className="num">{pct(s.here.share)}</span></td><td className="p-2"><StageBadge stage={s.all.stage} /> <span className="num">{pct(s.all.share)}</span></td><td className="num p-2">{s.momentum_all ?? "—"}</td></tr>)}</tbody>
      </table> : <Empty why={r.note ?? "No headline signal measured in this sector yet."} />}
      <p className="label p-3 text-g500">{r.basis}</p>
    </div>}
  </section>;
}
