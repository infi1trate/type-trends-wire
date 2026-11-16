import { line as voiced } from "@/lib/voice";
import { untick } from "@/lib/labels";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { signalsQuery, wire24hQuery, latestBriefQuery } from "@/lib/data";
import { headlineOnly } from "@/lib/signals";
import { tierCounts } from "@/lib/tiers";
import { AllSignals } from "./Signals";
import { isoWeek, type PanelId } from "./panels";
import { Loading, Roll } from "./primitives";
import { Info } from "./Info";
import { Wire } from "./Wire";
import { Spread } from "./Spread";

function Stat({ label, g, children }: { label: string; g: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-r border-rule p-3 xl:border-b-0">
      <div className="label flex items-center text-g500">{label}<Info g={g} /></div>
      <div className="mt-1 text-hero font-semibold text-ink">{children}</div>
    </div>
  );
}

export function Overview({ go, freshIds }: { go: (p: PanelId) => void; freshIds: Set<number> }) {
  const { data } = useSuspenseQuery(signalsQuery()), isLoading = false;
  const { data: w24, isLoading: wl } = useQuery(wire24hQuery());
  const { data: brief } = useQuery(latestBriefQuery());
  const head = headlineOnly(data?.signals ?? []), counts = data ? tierCounts(data.tiers) : null;
  const top = [...head].filter(s => s.momentum_index != null).sort((a, b) => b.momentum_index! - a.momentum_index!)[0];
  const dash = <span className="text-body font-normal text-g500">Fills in after the next Sunday forecast</span>;
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-label="Signals">
      <h2 className="sr-only">Signals · All signals</h2>
      <div className="grid shrink-0 grid-cols-2 border-b border-rule xl:grid-cols-4">
        <Stat label="HEADLINE SIGNALS" g="tier-headline">{isLoading ? <Loading /> : head.length ? <Roll value={String(head.length)} /> : dash}</Stat>
        <Stat label="SUPPORTING · ARCHIVE" g="tier-supporting">{isLoading ? <Loading /> : counts ? <span>{counts.supporting} · {counts.archive}</span> : dash}</Stat>
        <Stat label="WIRE ITEMS / 24H" g="p-wire">{wl ? <Loading /> : <Roll value={String(w24 ?? 0)} />}</Stat>
        <Stat label="TOP MOMENTUM" g="momentum-index">
          {isLoading ? <Loading /> : top ? (
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="truncate">{top.name}</span>
              <span className="text-signal">{top.momentum_index}</span>
            </span>
          ) : dash}
        </Stat>
      </div>
      <div className="grid grid-cols-1 md:min-h-0 md:flex-1 md:grid-rows-[1fr_1fr_1fr] xl:grid-cols-12 xl:grid-rows-1">
        <div className="flex min-h-[360px] min-w-0 flex-col border-b border-rule md:min-h-0 xl:col-span-6 xl:border-r">
          <AllSignals compact />
        </div>
        <div className="flex min-h-[360px] min-w-0 flex-col border-b border-rule md:min-h-0 xl:col-span-3 xl:border-r"><Spread/></div>
        <div className="flex min-h-[360px] min-w-0 flex-col border-b border-rule md:min-h-0 xl:col-span-3">
          <Wire compact freshIds={freshIds} />
        </div>
      </div>
      <section className="shrink-0 bg-paper p-3 text-void" aria-label="Weekly brief">
        <h2 className="label flex items-center font-semibold">WEEKLY BRIEF · {brief?.week ?? `WEEK ${String(isoWeek()).padStart(2, "0")}`} · AI</h2>
        {brief ? <p className="mt-1 flex flex-wrap items-baseline gap-x-3"><span>{untick(brief.headline)}</span><button type="button" className="label underline underline-offset-2" onClick={() => go("brief")}>OPEN FORECAST →</button></p> : <p className="mt-1">{voiced("terminal.views.1")}</p>}
      </section>
    </div>
  );
}
