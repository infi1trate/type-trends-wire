import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { Signal } from "@/lib/signals";
import type { TierResult } from "@/lib/tiers";
import { TIERS, TIER_WORD, tierCounts } from "@/lib/tiers";
import { COMPOSITES, DROPPED_COMPOSITES, ruleText } from "@/lib/composites";
import { BASIS_LINE, COMPOSITE_LINE, CONFIDENCE_LINE, JOBS, MOMENTUM_LINE, OPEN_CATEGORIES, QUESTIONS, TIER_LINES, signalList } from "@/lib/what-we-show";
import { whereThingsLive } from "@/lib/ia";
import { firstSeenList, storyRules, storyTypeList } from "@/lib/stories/rules";
import { imagePolicy } from "@/lib/crops";
import { BasisWord, Dim, DigestFooter, DigestShell, SectionHead, StageWord, pr } from "./Editorial";

const pct = (v: number | null | undefined) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);
const CAT_NAME: Record<string, string> = { family: "Google Fonts families", h1_font: "Named headline typefaces", body_font: "Named body typefaces", color: "Named page colors", accent: "Named accent colors", h1_word: "Headline words", vibe: "Vibe-map clusters" };

/** /what-we-show: generated from tiers.ts, composites.ts and momentum.ts plus the latest stored run; nothing here is hand-maintained. */
export function WhatWeShowView({ tiers, signals, runId }: { tiers: Map<string, TierResult>; signals: Signal[]; runId: number | null }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => signalList(tiers), [tiers]);
  const counts = useMemo(() => tierCounts(new Map(list.map(r => [r.key, r as unknown as TierResult]))), [list]);
  const byKey = useMemo(() => new Map(signals.map(s => [s.key, s])), [signals]);
  const ql = q.trim().toLowerCase();
  const shown = list.filter(r => !ql || r.name.toLowerCase().includes(ql) || r.key.includes(ql) || r.dimension.toLowerCase() === ql || r.reasons.join(" ").toLowerCase().includes(ql));
  const footer = { methodology: "/#m-tiers", glossary: "/#g-tier-headline", rss: "/digest/rss.xml", terminal: "/terminal?panel=overview", contact: null };
  return <DigestShell label="What we show and why">
    <article aria-labelledby="ed-wws">
      <header className="ed-wrap ed-grid pt-10 md:pt-14">
        <div className="lg:col-span-8">
          <p className="ed-kicker">The so-what test · collect wide, show narrow</p>
          <h1 id="ed-wws" className="ed-cover mt-3">What we show and why</h1>
          <p className="ed-standfirst mt-6">We measure hundreds of things on every homepage. By default you see only the signals a brand, marketing or design lead can act on. Nothing else is deleted; it is one filter away.</p>
        </div>
        <aside className="lg:col-span-4 lg:self-end" aria-label="Signals per tier">
          <dl className="ed-data grid grid-cols-3 gap-4">{TIERS.map(t => <div key={t} className="ed-hair pt-2"><dt className="ed-kicker">{TIER_WORD[t]}</dt><dd className="ed-figure-num mt-1">{counts[t]}</dd></div>)}</dl>
          <p className="ed-caption mt-2">Every named signal, including crawl-only ones the forecast does not stage (the terminal counts forecast rows only). Forecast run {runId ?? "—"}; open-ended fonts, colors and words are listed by category below.</p>
        </aside>
      </header>

      <section aria-labelledby="ed-w-jobs" className="ed-wrap mt-14">
        <SectionHead n="01" id="ed-w-jobs" title="Three jobs" kicker="Every surface helps a reader do one of these." />
        <ol className="ed-grid gap-y-6">{JOBS.map(j => <li key={j.id} className="ed-hair pt-3 lg:col-span-4"><h3 className="ed-h3">{j.word}</h3><p className="ed-small mt-1">{j.line}</p></li>)}</ol>
      </section>

      <section aria-labelledby="ed-w-q" className="ed-wrap mt-14">
        <SectionHead n="02" id="ed-w-q" title="Four questions" kicker="Asked of every signal. Two are editorial and fixed; two come from the latest forecast." />
        <ol className="ed-grid gap-y-6">{QUESTIONS.map((x, i) => <li key={x.id} className="ed-hair pt-3 md:col-span-6 lg:col-span-3"><p className="ed-kicker">{String.fromCharCode(97 + i)}</p><h3 className="ed-h3">{x.word}</h3><p className="ed-small mt-1">{x.line}</p></li>)}</ol>
      </section>

      <section aria-labelledby="ed-w-tiers" className="ed-wrap mt-14">
        <SectionHead n="03" id="ed-w-tiers" title="Three tiers" />
        <dl className="ed-body ed-small space-y-3">{TIERS.map(t => <div key={t}><dt className="inline font-semibold">{TIER_WORD[t].toLowerCase().replace(/^./, c => c.toUpperCase())} ({counts[t]}).</dt> <dd className="inline">{TIER_LINES[t]}</dd></div>)}</dl>
      </section>

      <section aria-labelledby="ed-w-combo" className="ed-wrap mt-14">
        <SectionHead n="04" id="ed-w-combo" title="Composite signals" kicker={COMPOSITE_LINE} />
        <ul className="ed-grid gap-y-6">{COMPOSITES.map(c => { const s = byKey.get(c.key), t = tiers.get(c.key); return <li key={c.key} className="ed-hair min-w-0 pt-3 md:col-span-6 lg:col-span-4">
          <p className="ed-h3"><Link to="/signals/$key" params={{ key: c.key }} className="no-underline hover:underline" {...pr(`/signals/${c.key}`)}>{c.name}</Link> <Dim d={c.dimension} /></p>
          <p className="ed-data mt-1 flex flex-wrap items-center gap-2"><BasisWord b={c.basis} /><StageWord stage={s?.stage ?? null} /><span>{t ? TIER_WORD[t.tier] : "—"}</span><span className="ed-muted">{pct(s?.share)}</span></p>
          <p className="ed-small mt-2">{c.definition}</p>
          <p className="ed-caption mt-1">{c.rule === "all" ? "All of" : "Any of"}: {ruleText(c)}.</p>
        </li>; })}</ul>
        <h3 className="ed-kicker mt-8">Considered and left out</h3>
        <ul className="ed-small mt-2 space-y-1">{DROPPED_COMPOSITES.map(d => <li key={d.name}><strong>{d.name}</strong>: {d.why}</li>)}</ul>
      </section>

      <section aria-labelledby="ed-w-basis" className="ed-wrap mt-14">
        <SectionHead n="05" id="ed-w-basis" title="Measured or AI estimate" />
        <p className="ed-body ed-small flex flex-wrap items-center gap-2"><BasisWord b="measured" /><BasisWord b="ai" /></p>
        <p className="ed-body ed-small mt-2">{BASIS_LINE}</p>
      </section>

      <section aria-labelledby="ed-w-mom" className="ed-wrap mt-14">
        <SectionHead n="06" id="ed-w-mom" title="Momentum and Confidence" kicker="Display only: no forecast number changes." />
        <div className="ed-body ed-small space-y-3"><p>{MOMENTUM_LINE}</p><p>{CONFIDENCE_LINE}</p></div>
      </section>

      <section aria-labelledby="ed-w-where" className="ed-wrap mt-14">
        <SectionHead n="07" id="ed-w-where" title="Where things live" kicker="Six sections, the same in both modes. Generated from the site's one map of pages and panels." />
        <ul className="ed-grid gap-y-6">{whereThingsLive().map(x => <li key={x.id} className="ed-hair min-w-0 pt-3 md:col-span-6 lg:col-span-4">
          <h3 className="ed-h3">{x.label}</h3>
          <p className="ed-data mt-1">Read {x.read} · Terminal {x.key}</p>
          <p className="ed-small mt-1">{x.purpose}</p>
          {x.quiet.length > 0 && <p className="ed-caption mt-2">Quiet here (out of the reader's path): {x.quiet.map(q => q.note.replace(/\.$/, "")).join("; ")}.</p>}
        </li>)}</ul>
      </section>

      <section aria-labelledby="ed-w-story" className="ed-wrap mt-14">
        <SectionHead n="08" id="ed-w-story" title="What makes a story" kicker="Generated from the story engine's own definitions. A story must help a reader spot, prove or act, or it doesn't run." />
        <ul className="ed-grid gap-y-6">{storyRules().map(r => <li key={r.id} className="ed-hair min-w-0 pt-3 md:col-span-6"><h3 className="ed-h3">{r.title}</h3><p className="ed-small mt-1">{r.text}</p></li>)}</ul>
        <h3 className="ed-kicker mt-10">Story types</h3>
        <ul className="mt-2">{storyTypeList().map(t => <li key={t.id} className="ed-hair grid grid-cols-1 gap-x-6 py-2 md:grid-cols-[minmax(0,3fr)_minmax(0,9fr)]">
          <p className="min-w-0"><span className="font-medium">{t.name}</span> <span className="ed-data ed-muted">{t.job}</span></p>
          <p className="ed-caption min-w-0">{t.trigger} <span className="ed-muted">Needs: {t.evidence}</span></p>
        </li>)}</ul>
        <h3 className="ed-kicker mt-10">First seen: what the archive can measure</h3>
        <ul className="mt-2">{firstSeenList().map(d => <li key={d.id} className="ed-hair grid grid-cols-1 gap-x-6 py-2 md:grid-cols-[minmax(0,3fr)_minmax(0,9fr)]"><p className="min-w-0 font-medium">{d.name}</p><p className="ed-caption min-w-0">{d.why}</p></li>)}</ul>
      </section>

      <section aria-labelledby="ed-w-images" className="ed-wrap mt-14">
        <SectionHead n="09" id="ed-w-images" title="Images of other sites" kicker="Section crops prove what we measured. They are other companies' pages, so each one is credited, linked and removable." />
        <ul className="ed-grid gap-y-6">{imagePolicy().map(r => <li key={r.id} className="ed-hair min-w-0 pt-3 md:col-span-6"><h3 className="ed-h3">{r.title}</h3><p className="ed-small mt-1">{r.text}</p></li>)}</ul>
      </section>

      <section aria-labelledby="ed-w-all" className="ed-wrap mt-14">
        <SectionHead n="10" id="ed-w-all" title="Every signal, by tier" kicker="Each with the reason for its tier. Search by name, key, dimension or reason." />
        <label className="ed-data flex max-w-md items-center gap-2 border border-ed-ink px-2"><span className="sr-only">Search signals</span><span aria-hidden>⌕</span><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search signals" className="min-h-11 w-full bg-transparent outline-none" /></label>
        <p className="ed-caption mt-2" aria-live="polite">{shown.length} of {list.length} signals</p>
        {TIERS.map(t => { const rows = shown.filter(r => r.tier === t); return rows.length ? <div key={t} className="mt-8"><h3 className="ed-kicker">{TIER_WORD[t]} · {rows.length}</h3>
          <ul className="mt-2">{rows.map(r => <li key={r.key} className="ed-hair grid grid-cols-1 gap-x-6 py-2 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
            <p className="min-w-0"><span className="font-medium">{r.name}</span> <Dim d={r.dimension} /> <BasisWord b={r.basis as "measured" | "ai"} /><span className="ed-data ed-muted block break-all text-[11px]">{r.key}</span></p>
            <p className="ed-caption min-w-0">{r.reasons.join(" ")}</p>
          </li>)}</ul></div> : null; })}
        {!ql && <div className="mt-8"><h3 className="ed-kicker">Open-ended categories</h3><ul className="mt-2">{OPEN_CATEGORIES.map(c => <li key={c.category} className="ed-hair grid grid-cols-1 gap-x-6 py-2 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]"><p><span className="font-medium">{CAT_NAME[c.category] ?? c.category}</span> <span className="ed-data ed-muted">{c.category}:*</span></p><p className="ed-caption">{c.evidence ? "Evidence, supporting at most. " : c.visible && c.decision ? "Each value is tiered by the four questions. " : "Archive. "}{c.why}</p></li>)}</ul></div>}
      </section>
    </article>
    <DigestFooter footer={footer} />
  </DigestShell>;
}
