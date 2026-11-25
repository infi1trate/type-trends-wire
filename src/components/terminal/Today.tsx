import { line as voiced } from "@/lib/voice";
import { BriefWithdrawn } from "./BriefWithdrawn";
import { useMemo } from "react";
import { untick } from "@/lib/labels";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { latestBriefQuery, signalsQuery, todayQuery } from "@/lib/data";
import { buildToday } from "@/lib/today";
import { PanelHeader } from "./primitives";
import { StoryRow } from "@/components/read/StoryCard";
import { fromToday } from "@/lib/stories";
import type { PanelId } from "./panels";
import { StoryQueue } from "./StoryQueue";
import { PartBoundary } from "@/components/read/Later";

const hm = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;

export function Today({ go, onTour, onGlossary, focus }: { go: (p: PanelId) => void; onTour: () => void; onGlossary: () => void; focus?: string | undefined }) {
  const { data } = useSuspenseQuery(todayQuery());
  const { data: sig } = useSuspenseQuery(signalsQuery());
  const { data: brief } = useQuery(latestBriefQuery());
  // Headline signals only (tiers.ts); Google Fonts popularity is supply-side, so it never fills a TODAY line.
  const headline = useMemo(() => (sig ? new Set([...sig.tiers.values()].filter(r => r.tier === "headline").map(r => r.key)) : new Set<string>()), [sig]);
  const t = useMemo(() => buildToday({ ...data, type: null, headline }), [data, headline]);
  const firstTrait = t.lines.find(l => l.target === "trait")?.id, firstSite = t.lines.find(l => l.target === "site")?.id;
  return (
    <section aria-label="Today" className="flex min-h-0 flex-1 flex-col md:overflow-y-auto">
      <PanelHeader title="TODAY" g="p-today" meta={<span className="num">{t.date}</span>} />
      {/* The story list's own read failing leaves the TODAY lines below in place, with one retry line where the list was. */}
      <PartBoundary className="border-b border-rule p-3 text-g500"><StoryQueue focus={focus} /></PartBoundary>
      <div data-tour="today" className="border-b border-rule">
        <div className="flex flex-col gap-1 border-b border-rule p-3">
          <p className="label text-g500">{t.date} · DATA AS OF <span className="text-ink">{t.asOf ? hm(t.asOf) : "NO DATA YET"}</span></p>
          <p className="t-say text-g500">New here? Each line says what moved and links to the proof. <button type="button" onClick={onTour} className="text-ink underline underline-offset-2 max-md:min-h-11">Take the 4-step tour →</button> <button type="button" onClick={onGlossary} className="text-ink underline underline-offset-2 max-md:min-h-11">Glossary (?)</button></p>
        </div>
        {t.note && <p className="t-say border-b border-rule p-3 text-g500">{t.note}</p>}
        {t.stageNote && <p className="t-say border-b border-rule p-3 text-g500">{t.stageNote}</p>}
        <ol className="flex flex-col">
          {t.lines.map((l, i) => <StoryRow key={l.id} s={fromToday(l)} n={i + 1} tour={l.id === firstTrait ? "trait" : l.id === firstSite ? "site" : undefined} />)}
        </ol>
      </div>
      <div className="grid grid-cols-1 border-b border-rule md:grid-cols-3">
        {([["overview", "F2 SIGNALS", "Headline signals, crawl spread and the wire on one screen."], ["brief", "F2 › FORECAST", "Every signal's stage, momentum and next-wave score."], ["library", "F3 BRANDS", "Every brand slug reads, its fingerprints and confirmed changes."]] as const).map(([id, k, d]) => (
          <button key={id} type="button" onClick={() => go(id)} className="flex min-h-11 flex-col items-start gap-1 border-b border-rule p-3 text-left hover:bg-g900 md:border-b-0 md:border-r md:last:border-r-0">
            <span className="label font-semibold text-ink">{k} →</span><span className="text-g500">{d}</span>
          </button>
        ))}
      </div>
      <section className="shrink-0 bg-paper p-3 text-void" aria-label="Weekly brief">
        <h2 className="label font-semibold">WEEKLY BRIEF{brief ? ` · ${brief.week}` : ""} · AI</h2>
        <BriefWithdrawn week={brief?.week} className="mt-1" />
        {brief ? <p className="mt-1 flex min-h-[3lh] flex-wrap items-baseline gap-x-3 md:min-h-[2lh]"><span>{untick(brief.headline)}</span><button type="button" className="label underline underline-offset-2 max-md:min-h-11" onClick={() => go("brief")}>OPEN FORECAST →</button></p> : <p className="mt-1 min-h-[3lh] md:min-h-[2lh]">{voiced("terminal.today.1")}</p>}
      </section>
    </section>
  );
}
