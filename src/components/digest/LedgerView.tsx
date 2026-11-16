import { useState } from "react";
import { Link } from "@tanstack/react-router";
import type { LedgerItem, LedgerSummary, Backtest, Outcome } from "@/lib/ledger/ledger";
import { longDay } from "@/lib/ledger/ledger";
import { basis, stageName } from "@/lib/labels";
import { BasisWord, DigestShell, DigestFooter, Dim, SectionHead, StageWord, pr } from "./Editorial";

type Ledger = { rule: string[]; summary: LedgerSummary; calls: LedgerItem[]; matched: number; backtest: Backtest | null };
const FILTERS: { id: "all" | Outcome | "open"; label: string }[] = [{ id: "all", label: "All" }, { id: "open", label: "Open" }, { id: "hit", label: "Hit" }, { id: "miss", label: "Miss" }, { id: "void", label: "Void" }];

/** One call, in words. Hits and misses share the same badge and weight so neither reads louder. */
export function LedgerCall({ c, showName = true }: { c: LedgerItem; showName?: boolean }) {
  return <li className="ledger-row grid grid-cols-1 gap-x-8 gap-y-2 px-2 py-4 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" data-ledger-row="">
    <div className="min-w-0">
      {showName && <p className="ed-h3"><Link to="/signals/$key" params={{ key: c.trait }} className="no-underline hover:underline" {...pr(c.explainer_path)}>{c.name}</Link> <Dim d={c.dimension} /> <BasisWord b={basis(c.trait)} /></p>}
      <p className="ed-data ed-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1"><span>{c.scope_text}</span><span>called {longDay(c.made_at)}</span><StageWord stage={stageName(c.stage_at_call)} />{c.origin === "alert" && <span>alert</span>}{c.backfilled && <span title="Recorded from a run stored before the ledger existed">backfilled</span>}</p>
    </div>
    <div className="min-w-0">
      <p className="ed-data flex flex-wrap items-center gap-x-3 gap-y-1"><span className="ed-badge" aria-label={`Outcome: ${c.outcome_word}`}>{c.outcome_word}</span><span>Target {c.target_text}</span>{c.resolves_on && <span className="ed-muted">resolves {longDay(c.resolves_on)}</span>}</p>
      <p className="ed-small mt-2">{c.said}</p>
      {c.outcome_reason && <p className="ed-caption mt-1">{c.outcome_reason}</p>}
      <p className="ed-data mt-1"><a href={c.receipts_path} className="ed-tap" {...pr(c.receipts_path)}>Receipts in the terminal →</a> <span className="ed-muted">run {c.run_id}</span></p>
    </div>
  </li>;
}

function Breakdown({ title, rows }: { title: string; rows: LedgerSummary["byDimension"] }) {
  return <div className="min-w-0"><h3 className="ed-kicker">{title}</h3>
    <table className="ed-data mt-2 w-full text-left"><thead className="ed-muted"><tr className="border-b border-ed-ink"><th scope="col" className="py-1 font-normal">Group</th><th scope="col" className="py-1 text-right font-normal">Hits</th><th scope="col" className="py-1 text-right font-normal">Misses</th><th scope="col" className="py-1 text-right font-normal">Rate</th></tr></thead>
      <tbody>{rows.map(r => <tr key={r.key} className="ed-hair"><th scope="row" className="py-1 font-normal">{r.key}</th><td className="py-1 text-right">{r.hits}</td><td className="py-1 text-right">{r.misses}</td><td className="py-1 text-right">{r.rate == null ? (r.n ? "too few" : "—") : `${Math.round(r.rate * 100)}%`}</td></tr>)}</tbody></table></div>;
}

export function LedgerView({ ledger: l }: { ledger: Ledger }) {
  const [f, setF] = useState<(typeof FILTERS)[number]["id"]>("all");
  const s = l.summary, shown = l.calls.filter(c => f === "all" || (f === "open" ? c.outcome == null : c.outcome === f));
  const footer = { methodology: "/#m-ledger", glossary: "/#g-ledger", rss: "/digest/rss.xml", terminal: "/terminal?panel=brief", contact: null };
  return <DigestShell label="The forecast ledger">
    <article aria-labelledby="ed-ledger">
      <header className="ed-wrap ed-grid pt-10 md:pt-14">
        <div className="lg:col-span-8">
          <p className="ed-kicker">The record · every call, kept as made</p>
          <h1 id="ed-ledger" className="ed-cover mt-3">The Ledger</h1>
          <p className="ed-standfirst mt-6">{s.headline}</p>
        </div>
        <aside className="lg:col-span-4 lg:self-end" aria-label="Counts">
          <dl className="ed-data grid grid-cols-2 gap-4">{([["Calls recorded", s.total], ["Open", s.open], ["Resolved", s.resolved], ["Void (not counted)", s.voids]] as const).map(([k, v]) => <div key={k} className="ed-hair pt-2"><dt className="ed-kicker">{k}</dt><dd className="ed-figure-num mt-1">{v}</dd></div>)}</dl>
        </aside>
      </header>

      <section aria-labelledby="ed-l-rule" className="ed-wrap mt-14">
        <SectionHead n="01" id="ed-l-rule" title="The rule" kicker="Which calls are recorded, and how each one is scored." />
        <div className="ed-body ed-small space-y-3">{l.rule.map(p => <p key={p}>{p}</p>)}
          <p><strong>Hit</strong>: the share in the target quarter lands inside the predicted band (edges count) and moved in the direction we called. <strong>Miss</strong>: anything else. <strong>Void</strong>: the signal lost coverage that quarter, or had no band when called; voids are listed but not counted. <strong>Open</strong>: the target quarter hasn't closed in the data yet.</p>
          <p><a href="/#m-ledger" className="ed-tap" {...pr("/#m-ledger")}>Full method →</a></p></div>
      </section>

      <section aria-labelledby="ed-l-numbers" className="ed-wrap mt-14">
        <SectionHead n="02" id="ed-l-numbers" title="Hit rate" kicker={s.rate == null ? "Shown as a percentage once 20 calls have resolved." : `Hits ÷ (hits + misses), n = ${s.resolved}.`} />
        <p className="ed-data ed-stat">{s.rate != null ? `${Math.round(s.rate * 100)}%` : s.resolved ? `${s.hits} of ${s.resolved}` : "None yet"}</p>
        <p className="ed-caption mt-1">{s.rate != null ? `${s.hits} hits, ${s.misses} misses` : s.resolved ? "resolved calls landed" : `${s.open} calls open${s.nextResolution ? `; the first resolve on ${longDay(s.nextResolution)}` : ""}`}</p>
        <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2"><Breakdown title="By dimension" rows={s.byDimension} /><Breakdown title="By stage at call" rows={s.byStage} /></div>
      </section>

      <section aria-labelledby="ed-l-backtest" className="ed-wrap mt-14">
        <SectionHead n="03" id="ed-l-backtest" title="Backtest (history replay)" kicker="A replay of the archive, not live calls. It is never mixed into the hit rate above." />
        <p className="ed-body ed-small">{l.backtest?.text ?? "No backtest is stored yet."}</p>
      </section>

      <section aria-labelledby="ed-l-calls" className="ed-wrap mt-14">
        <SectionHead n="04" id="ed-l-calls" title="Every call" kicker="Newest first. Misses are shown exactly like hits." />
        <div className="no-print mb-4 flex flex-wrap gap-x-4" role="group" aria-label="Filter calls by outcome">{FILTERS.map(x => <button key={x.id} type="button" aria-pressed={f === x.id} onClick={() => setF(x.id)} className={`ed-tap ed-data cursor-pointer ${f === x.id ? "underline" : "ed-muted"}`}>{x.label}</button>)}</div>
        {shown.length ? <ul className="ledger" data-ledger="">{shown.map(c => <LedgerCall key={c.id} c={c} />)}</ul> : <p className="ed-body">{l.calls.length ? "No calls with this outcome yet." : "No calls recorded yet. The first ones are written after the next Sunday forecast."}</p>}
        <p className="ed-caption mt-6">Share figures are the share of tracked homepages; the band is the forecast's 80% interval. Percent signs are points of share, not growth.</p>
      </section>
    </article>
    <DigestFooter footer={footer} />
  </DigestShell>;
}
