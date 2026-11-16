// LIVE (/): the reader's front page — lead story, the stream newest first (30 a page), moving now, chart of the week, new on the scene.
import { Link } from "@tanstack/react-router";
import type { loadLive } from "@/lib/read.server";
import { pct } from "@/lib/digest/copy";
import { sectorName } from "@/lib/labels";
import { cardText } from "@/lib/chart/card";
import { storyTime } from "@/lib/stories";
import { TYPE_FILTERS, type TypeFilter } from "@/lib/stories/view";
import { BasisWord, DigestShell, Dim, StageWord, pr } from "@/components/digest/Editorial";
import { StoryCard } from "./StoryCard";
import { ReadFooter } from "./Bits";

export type LiveData = Awaited<ReturnType<typeof loadLive>>;
const FILTERS = Object.keys(TYPE_FILTERS) as TypeFilter[];
export function LiveView({ d }: { d: LiveData }) {
  const lensQ = d.sector === "all" ? undefined : d.sector, typeQ = d.type === "all" ? undefined : d.type;
  const ranked = d.sector !== "all" ? `${sectorName(d.sector)} stories first (${d.inSector ?? 0}), then the rest` : null;
  const what = d.type === "all" ? "stories" : `${TYPE_FILTERS[d.type].label.toLowerCase()} stories`;
  return <DigestShell label="Live" section="live" lens note={ranked} tour>
    <div className="ed-wrap pt-6" data-tour="r-live">
      <p className="ed-kicker flex flex-wrap gap-x-3"><span>Live</span><span className="ed-muted">Updated {d.updatedAt ? storyTime(d.updatedAt) : "—"}</span></p>
      {d.lead ? <div className="mt-4 border-b-2 border-ed-ink pb-8">{d.leadPinned && <p className="ed-kicker ed-muted mb-2">Pinned by the editor</p>}<StoryCard s={d.lead} lead /></div>
        : <p className="ed-standfirst mt-4">No story has run yet. Stories are written after each crawl, forecast and news check, and only when something in the data clears the bar.</p>}
    </div>
    <div className="ed-wrap ed-grid mt-10">
      <section aria-labelledby="live-stream" className="lg:col-span-8">
        <h2 id="live-stream" className="ed-kicker">The stream · newest first · {d.total} {what}</h2>
        <nav aria-label="Story types" className="ed-data mt-3 flex flex-wrap gap-x-1 gap-y-1">
          {FILTERS.map(f => <Link key={f} to="/" search={{ sector: lensQ, type: f === "all" ? undefined : f }} aria-current={d.type === f ? "true" : undefined}
            className={`ed-tap inline-flex min-h-11 items-center border px-3 no-underline ${d.type === f ? "border-ed-ink font-semibold" : "border-transparent"}`}>{TYPE_FILTERS[f].label} <span className="ed-muted ml-1">{d.counts[f]}</span></Link>)}
        </nav>
        {d.stories.length ? <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-2">{d.stories.map(s => <StoryCard key={s.id} s={s} />)}</div>
          : <p className="ed-small mt-4">{d.type === "all" ? "No other story has run yet." : d.type === "openings" ? "No opening this week: no rising signal is missing from a well-covered sector." : d.type === "news" ? "No outside news named a tracked brand or headline signal recently. All outside news stays in Terminal › Live › Wire." : `No ${what} have run yet.`}</p>}
        {d.pages > 1 && <nav aria-label="Story pages" className="ed-data mt-10 flex flex-wrap items-center gap-x-6">
          {d.page > 0 && <Link to="/" search={{ sector: lensQ, type: typeQ, page: d.page - 1 || undefined }} className="ed-tap">← Newer stories</Link>}
          <span className="ed-muted">Page {d.page + 1} of {d.pages}</span>
          {d.page + 1 < d.pages && <Link to="/" search={{ sector: lensQ, type: typeQ, page: d.page + 1 }} className="ed-tap">Older stories →</Link>}
        </nav>}
      </section>
      <aside className="space-y-12 lg:col-span-4" aria-label="Moving now, chart of the week and launches">
        <section aria-labelledby="live-moving">
          <h2 id="live-moving" className="ed-kicker ed-rule pt-3">Moving now</h2>
          <p className="ed-caption mt-1">Headline signals that changed stage in the latest forecast{d.runAt ? ` (${storyTime(d.runAt)})` : ""}, across all sectors.</p>
          {d.moving.length ? <ul className="mt-3 space-y-4">{d.moving.map((m, i) => <li key={m.key} className="ed-hair pt-3">
            <Link to="/signals/$key" params={{ key: m.key }} className="ed-h3 no-underline hover:underline" data-tour={i === 0 ? "r-signal" : undefined} {...pr(m.href)}>{m.name}</Link>
            <p className="ed-data mt-1 flex flex-wrap items-center gap-2"><Dim d={m.dimension} /><BasisWord b={m.basis} /><span>{m.from} → </span><StageWord stage={m.to} />{m.share != null && <span>{pct(m.share, 1)}</span>}{m.momentum_index != null && <span className="ed-muted">Momentum {m.momentum_index}</span>}</p>
          </li>)}</ul> : <p className="ed-small mt-3">No headline signal changed stage in the latest forecast. <Link to="/signals" className="ed-tap" data-tour="r-signal">See every headline signal →</Link></p>}
        </section>
        {d.chart && <section aria-labelledby="live-chart">
          <h2 id="live-chart" className="ed-kicker ed-rule pt-3">Chart of the week · {d.chart.week}</h2>
          <Link to="/chart/$week" params={{ week: d.chart.week }} className="mt-3 block border border-ed-ink"><img src={`/chart/${d.chart.week}.png`} width={1200} height={675} loading="lazy" decoding="async" className="block h-auto w-full" alt={`Chart of the week ${d.chart.week}: ${cardText(d.chart.model).name} share by quarter.`} /></Link>
          <p className="ed-small mt-2">{cardText(d.chart.model).call}</p>
          <p className="ed-data mt-1"><Link to="/signals/$key" params={{ key: d.chart.trait }} className="ed-tap">{cardText(d.chart.model).name} →</Link></p>
        </section>}
        {d.launches.length > 0 && <section aria-labelledby="live-launches">
          <h2 id="live-launches" className="ed-kicker ed-rule pt-3">New on the scene</h2>
          <p className="ed-caption mt-1">Product Hunt launches. They never rank in the stream.</p>
          <ul className="mt-3 space-y-4">{d.launches.map(s => <li key={s.id}><StoryCard s={s} /></li>)}</ul>
        </section>}
      </aside>
    </div>
    <ReadFooter terminal="/terminal" />
  </DigestShell>;
}
