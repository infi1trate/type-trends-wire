// Terminal tabs added by the Phase 13 regrouping: Patterns, Digest issues, Brands › Moves, Tools (audit launcher, ledger, console help).
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { archiveQuery, brandsQuery, patternsQuery } from "@/lib/data";
import { parseAuditSites } from "@/lib/agency/audit";
import { sectorFirst } from "@/lib/sector-lens";
import { PATTERN_MIN_EXAMPLES } from "@/lib/patterns";
import { StoryRow } from "@/components/read/StoryCard";
import { Empty, PanelHeader } from "./primitives";
import { DimTag, StageBadge } from "./Info";
import { BasisChip } from "./SignalBits";
import { LedgerOutput } from "./Ledger";
import { RebrandDesk } from "./Rebrands";
import { useSignalDrawer } from "./Signals";

/** F4 PATTERNS: headline layout and composite signals with their example brands, dense. */
export function PatternsTab({ sector }: { sector: string }) {
  const { data } = useSuspenseQuery(patternsQuery(sector));
  const drawer = useSignalDrawer();
  return <section aria-label="Patterns" className="flex min-h-0 flex-1 flex-col md:overflow-y-auto">
    <PanelHeader title="PATTERNS" g="o-pattern" meta={<>{data.patterns.length} · ≥{PATTERN_MIN_EXAMPLES} EXAMPLES</>} />
    {data.patterns.length ? <ul className="divide-y divide-rule">{data.patterns.map(p => <li key={p.key} className="grid grid-cols-1 gap-1 p-3 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="min-w-0"><button type="button" onClick={() => drawer.open(p.key)} className="min-h-11 text-left text-ink hover:underline md:min-h-0">{p.name}</button> <DimTag d={p.dimension} /> <BasisChip basis={p.basis} />
        <p className="label mt-1 flex flex-wrap items-center gap-2 text-g500"><StageBadge stage={p.stage} /> MOMENTUM {p.momentum_index ?? "—"} · CONFIDENCE {p.confidence.toUpperCase()} · {p.examples} BRANDS</p></div>
      <div className="label flex flex-wrap items-center gap-x-3 text-g500">{p.sample.map(d => <Link key={d} to="/library/$domain" params={{ domain: d }} className="min-h-11 break-all hover:text-ink md:min-h-0">{d}</Link>)}<Link to="/patterns/$key" params={{ key: p.key }} className="text-ink underline-offset-2 hover:underline">READ PAGE →</Link></div>
    </li>)}</ul> : <Empty why="No headline layout or composite signal has three example brands in this sector yet." />}
    {drawer.node}
  </section>;
}

/** F5 DIGEST: every issue, terminal density, linking to the editorial issue. */
export function DigestTab() {
  const { data } = useQuery(archiveQuery());
  return <section aria-label="Digest issues" className="flex min-h-0 flex-1 flex-col md:overflow-y-auto">
    <PanelHeader title="THE DIGEST · ISSUES" g="s-digest" meta={<Link to="/digest" className="text-ink underline-offset-2 hover:underline">LATEST →</Link>} />
    {!data ? <p className="p-3 animate-blink">▍</p> : data.length ? <ol className="divide-y divide-rule">{data.map(i => <li key={i.week}>
      <Link to="/digest/$week" params={{ week: i.week }} className="grid min-h-11 grid-cols-[6ch_1fr] gap-x-2 p-3 hover:bg-g900 md:grid-cols-[6ch_16ch_1fr]">
        <span className="num label text-g500">No.{i.number}</span><span className="label text-g500 max-md:col-start-2">{i.dates.toUpperCase()}</span><span className="text-ink max-md:col-start-2">{i.headline}{i.lead && <span className="label text-g500"> · LEAD {i.lead.name.toUpperCase()}</span>}</span>
      </Link></li>)}</ol> : <Empty why="No issue yet: the first one is assembled after the Sunday forecast and brief." />}
  </section>;
}

/** F3 BRANDS › MOVES: rebrands (the old Rebrand desk) plus recent confirmed changes across every brand. */
export function MovesTab({ sector, onSector }: { sector: string; onSector: (s: string) => void }) {
  const { data } = useQuery(brandsQuery());
  const moves = data ? sectorFirst(data.moves.filter(m => m.type === "move"), sector, m => m.sector).slice(0, 40) : null;
  return <div className="flex min-h-0 flex-1 flex-col md:overflow-y-auto">
    <RebrandDesk sector={sector} onSector={onSector} />
    <section aria-label="Recent moves" className="border-t border-rule">
      <PanelHeader title="RECENT MOVES · 30 DAYS" g="p-event-tape" meta={moves ? <>{moves.length}</> : null} />
      {!moves ? <p className="p-3 animate-blink">▍</p> : moves.length ? <ol>{moves.map((s, i) => <StoryRow key={s.id} s={s} n={i + 1} />)}</ol> : <Empty why="No confirmed change in the last 30 days." />}
    </section>
  </div>;
}

/** F6 TOOLS › AUDIT: start a competitive audit from the terminal. */
export function AuditTab() {
  const navigate = useNavigate(); const [v, setV] = useState(""), [err, setErr] = useState<string | null>(null);
  return <section aria-label="Audit" className="flex min-h-0 flex-1 flex-col md:overflow-y-auto">
    <PanelHeader title="COMPETITIVE AUDIT" g="s-tools" />
    <form className="flex flex-col gap-2 p-3" onSubmit={e => { e.preventDefault(); const p = parseAuditSites(v); if (p.ok) void navigate({ to: "/audit", search: { sites: p.domains.join(","), sector: undefined } }); else setErr(p.error); }}>
      <label className="label text-g500" htmlFor="audit-sites">2–6 SITES, COMMA OR SPACE SEPARATED</label>
      <div className="flex flex-wrap gap-2"><input id="audit-sites" value={v} onChange={e => { setV(e.target.value); setErr(null); }} placeholder="linear.app vercel.com supabase.com" className="min-h-11 min-w-0 flex-1 border border-rule bg-void px-2 text-ink md:min-h-8" />
        <button type="submit" className="label min-h-11 border border-ink px-3 text-ink hover:bg-ink hover:text-void md:min-h-8">AUDIT →</button></div>
      {err && <p role="alert" className="text-signal">{err}</p>}
      <p className="text-g500">Opens the editorial audit: type, color, layout, vibe, versus the market and open territory. <Link to="/audit/new" search={{ sites: undefined }} className="text-ink underline">Guided form →</Link></p>
    </form>
  </section>;
}
export function LedgerTab() {
  return <section aria-label="Ledger" className="flex min-h-0 flex-1 flex-col md:overflow-y-auto"><PanelHeader title="FORECAST LEDGER" g="ledger" /><div className="p-3"><LedgerOutput /></div></section>;
}
export const CONSOLE_HELP: [string, string][] = [
  ["type fintech headline free", "Recommend headline type for a sector."], ["type pair any", "Recommend a headline + body pairing."], ["palette ai dark", "Recommend a palette for a sector and mood."],
  ["diff dev-tools", "Where a sector (or URLs) could look different."], ["critique https://linear.app", "Critique one homepage against the market."], ["q serif AND fintech AND rising", "Query signals by name, sector and stage."],
  ["watch", "Watchlists on this device; watch new / add / rm / open."], ["audit linear.app vercel.com", "Open a competitive audit."], ["ledger", "The live forecast record."], ["morning", "Today's Morning Line inline (morning 2026-11-16 for another day)."],
  ["today", "Live · Today."], ["signals", "Signals · All signals."], ["digest", "The Digest."], ["glossary", "The glossary."], ["tour", "Restart the tour."], ["read", "Switch to Read mode on the same page."],
];
/** F6 TOOLS › CONSOLE: every command with what it does; each opens the console prefilled. */
export function ConsoleTab({ onRun }: { onRun: (cmd: string) => void }) {
  return <section aria-label="Console help" className="flex min-h-0 flex-1 flex-col md:overflow-y-auto">
    <PanelHeader title="CONSOLE ( / )" g="p-console" />
    <ul className="divide-y divide-rule">{CONSOLE_HELP.map(([c, d]) => <li key={c}><button type="button" onClick={() => onRun(c)} className="grid min-h-11 w-full grid-cols-1 gap-x-3 p-3 text-left hover:bg-g900 md:grid-cols-[28ch_1fr]"><span className="text-ink">{c}</span><span className="text-g500">{d}</span></button></li>)}</ul>
  </section>;
}
