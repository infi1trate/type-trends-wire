import { useMemo } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { latestBriefQuery, todayQuery, typeIndexQuery } from "@/lib/data";
import { buildToday } from "@/lib/today";
import { PanelHeader } from "./primitives";
import { AppLink } from "./AppLink";
import { DimTag } from "./Info";
import type { PanelId } from "./panels";

const hm = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;

export function Today({ go, onTour, onGlossary }: { go: (p: PanelId) => void; onTour: () => void; onGlossary: () => void }) {
  const { data } = useSuspenseQuery(todayQuery());
  const { data: type } = useQuery(typeIndexQuery());
  const { data: brief } = useQuery(latestBriefQuery());
  const top = useMemo(() => type?.rows.filter(r => (r.delta7 ?? 0) > 0).sort((a, b) => b.delta7! - a.delta7! || a.family.localeCompare(b.family))[0], [type]);
  const t = useMemo(() => buildToday({ ...data, type: top && type?.latest ? { family: top.family, delta7: top.delta7!, snapshot: type.latest } : null }), [data, top, type?.latest]);
  const firstTrait = t.lines.find(l => l.target === "trait")?.id, firstSite = t.lines.find(l => l.target === "site")?.id;
  return (
    <section aria-label="Today" className="flex min-h-0 flex-1 flex-col md:overflow-y-auto">
      <PanelHeader title="TODAY" g="p-today" meta={<span className="num">{t.date}</span>} />
      <div data-tour="today" className="border-b border-rule">
        <div className="flex flex-col gap-1 border-b border-rule p-3">
          <p className="label text-g500">{t.date} · DATA AS OF <span className="text-ink">{t.asOf ? hm(t.asOf) : "NO DATA YET"}</span></p>
          <p className="text-g500">New here? Each line says what moved and links to the proof. <button type="button" onClick={onTour} className="text-ink underline underline-offset-2 max-md:min-h-11">Take the 4-step tour →</button> <button type="button" onClick={onGlossary} className="text-ink underline underline-offset-2 max-md:min-h-11">Glossary (?)</button></p>
        </div>
        {t.note && <p className="border-b border-rule p-3 text-g500">{t.note}</p>}
        <ol className="flex flex-col">
          {t.lines.map((l, i) => (
            <li key={l.id} className="border-b border-rule last:border-b-0">
              <AppLink href={l.href} data-tour={l.id === firstTrait ? "trait" : l.id === firstSite ? "site" : undefined}
                className="group grid min-h-11 grid-cols-[3ch_1fr] gap-x-2 gap-y-1 p-3 hover:bg-g900 focus-visible:bg-g900 md:grid-cols-[3ch_1fr_auto]">
                <span className="num label text-g500">{i + 1}</span>
                <span className="min-w-0 text-ink"><span className="group-hover:underline">{l.text}</span>{l.dimension && <> <DimTag d={l.dimension} /></>} <span aria-hidden>→</span></span>
                <span className="label col-start-2 text-g500 md:col-start-3">{l.fresh ? "NEW · " : ""}{hm(l.at)}</span>
              </AppLink>
            </li>
          ))}
        </ol>
      </div>
      <div className="grid grid-cols-1 border-b border-rule md:grid-cols-3">
        {([["overview", "F1 SIGNALS", "Font movers, crawl spread and the wire on one screen."], ["brief", "F10 FORECAST", "Every trait's stage, momentum and next-wave score."], ["library", "F11 LIBRARY", "300 sites, their fingerprints and confirmed changes."]] as const).map(([id, k, d]) => (
          <button key={id} type="button" onClick={() => go(id)} className="flex min-h-11 flex-col items-start gap-1 border-b border-rule p-3 text-left hover:bg-g900 md:border-b-0 md:border-r md:last:border-r-0">
            <span className="label font-semibold text-ink">{k} →</span><span className="text-g500">{d}</span>
          </button>
        ))}
      </div>
      <section className="shrink-0 bg-paper p-3 text-void" aria-label="Weekly brief">
        <h2 className="label font-semibold">WEEKLY BRIEF{brief ? ` · ${brief.week}` : ""} · AI</h2>
        {brief ? <p className="mt-1 flex flex-wrap items-baseline gap-x-3"><span>{brief.headline}</span><button type="button" className="label underline underline-offset-2 max-md:min-h-11" onClick={() => go("brief")}>OPEN F10 FORECAST →</button></p> : <p className="mt-1">No brief yet: the first one is written after the next Sunday forecast.</p>}
      </section>
    </section>
  );
}
