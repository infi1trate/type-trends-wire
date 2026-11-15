import { useQuery } from "@tanstack/react-query";
import { typeIndexQuery, wire24hQuery, latestBriefQuery } from "@/lib/data";
import { DORMANT, PANELS, isoWeek, type PanelId } from "./panels";
import { Loading, Roll } from "./primitives";
import { Info } from "./Info";
import { TypeIndex } from "./TypeIndex";
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
  const { data, isLoading } = useQuery(typeIndexQuery());
  const { data: w24, isLoading: wl } = useQuery(wire24hQuery());
  const { data: brief } = useQuery(latestBriefQuery());
  const top = data?.rows.filter((r) => r.delta7 !== null).sort((a, b) => b.delta7! - a.delta7!)[0];
  const dash = <span className="text-body font-normal text-g500">Fills in after the next daily snapshot</span>;
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-label="Signals">
      <h2 className="sr-only">F1 Signals</h2>
      <div className="grid shrink-0 grid-cols-2 border-b border-rule xl:grid-cols-4">
        <Stat label="FAMILIES TRACKED" g="family">{isLoading ? <Loading /> : data?.rows.length ? <Roll value={String(data.rows.length)} /> : dash}</Stat>
        <Stat label="SNAPSHOT DAYS" g="sparkline-28d">{isLoading ? <Loading /> : data?.latest ? <Roll value={String(data.snapshotDays)} /> : dash}</Stat>
        <Stat label="WIRE ITEMS / 24H" g="p-wire">{wl ? <Loading /> : <Roll value={String(w24 ?? 0)} />}</Stat>
        <Stat label="TOP RISER 7D" g="pop-7d">
          {isLoading ? <Loading /> : top ? (
            <span className="flex flex-wrap gap-x-2">
              <span className="truncate">{top.family}</span>
              <span className={top.delta7! > 0 ? "text-signal" : "text-g500"}>{top.delta7! > 0 ? "▲" : "▼"}{Math.abs(top.delta7!)}</span>
            </span>
          ) : dash}
        </Stat>
      </div>
      <div className="grid grid-cols-1 md:min-h-0 md:flex-1 md:grid-rows-[1fr_1fr_1fr] xl:grid-cols-12 xl:grid-rows-1">
        <div className="flex min-h-[360px] min-w-0 flex-col border-b border-rule md:min-h-0 xl:col-span-5 xl:border-r">
          <TypeIndex compact onOpenFull={() => go("type")} />
        </div>
        <div className="flex min-h-[360px] min-w-0 flex-col border-b border-rule md:min-h-0 xl:col-span-3 xl:border-r"><Spread/></div>
        <div className="flex min-h-[360px] min-w-0 flex-col border-b border-rule md:min-h-0 xl:col-span-4">
          <Wire compact freshIds={freshIds} />
        </div>
      </div>
      <section className="shrink-0 bg-paper p-3 text-void" aria-label="Weekly brief">
        <h2 className="label flex items-center font-semibold">WEEKLY BRIEF · {brief?.week ?? `WEEK ${String(isoWeek()).padStart(2, "0")}`} · AI</h2>
        {brief ? <p className="mt-1 flex flex-wrap items-baseline gap-x-3"><span>{brief.headline}</span><button type="button" className="label underline underline-offset-2" onClick={() => go("brief")}>OPEN F10 FORECAST →</button></p> : <p className="mt-1">No brief yet: the first one is written after the next Sunday forecast.</p>}
      </section>
    </div>
  );
}

export function Dormant({ id }: { id: PanelId }) {
  const p = PANELS.find((x) => x.id === id)!;
  return (
    <section className="hatch flex min-h-[calc(100vh-120px)] flex-1 items-center justify-center p-3" aria-label={p.label}>
      <div className="max-w-md border border-rule bg-g800 p-3">
        <div className="label text-g500">{p.key}</div>
        <h2 className="text-hero font-semibold text-ink">{p.label}</h2>
        <div className="label mt-2 text-ink">STATUS <span className="text-g500">OFFLINE</span></div>
        <p className="mt-2 text-ink">{DORMANT[id]}</p>
        <p className="mt-3 text-g500">This panel is offline for now; it switches on when its data source is connected.</p>
      </div>
    </section>
  );
}
