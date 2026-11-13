import { useQuery } from "@tanstack/react-query";
import { typeIndexQuery, wire24hQuery, latestBriefQuery } from "@/lib/data";
import { DORMANT, PANELS, isoWeek, type PanelId } from "./panels";
import { Loading, Roll } from "./primitives";
import { TypeIndex } from "./TypeIndex";
import { Wire } from "./Wire";
import { Spread } from "./Spread";

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-r border-rule p-3 xl:border-b-0">
      <div className="label text-g500">{label}</div>
      <div className="mt-1 text-hero font-semibold text-ink">{children}</div>
    </div>
  );
}

export function Overview({ go, freshIds }: { go: (p: PanelId) => void; freshIds: Set<number> }) {
  const { data, isLoading } = useQuery(typeIndexQuery());
  const { data: w24, isLoading: wl } = useQuery(wire24hQuery());
  const { data: brief } = useQuery(latestBriefQuery());
  const top = data?.rows.filter((r) => r.delta7 !== null).sort((a, b) => b.delta7! - a.delta7!)[0];
  const dash = <span className="text-g500">—</span>;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid shrink-0 grid-cols-2 border-b border-rule xl:grid-cols-4">
        <Stat label="FAMILIES TRACKED">{isLoading ? <Loading /> : data?.rows.length ? <Roll value={String(data.rows.length)} /> : dash}</Stat>
        <Stat label="SNAPSHOT DAYS">{isLoading ? <Loading /> : data?.latest ? <Roll value={String(data.snapshotDays)} /> : dash}</Stat>
        <Stat label="WIRE ITEMS / 24H">{wl ? <Loading /> : <Roll value={String(w24 ?? 0)} />}</Stat>
        <Stat label="TOP RISER 7D">
          {isLoading ? <Loading /> : top ? (
            <span className="flex flex-wrap gap-x-2">
              <span className="truncate">{top.ticker}</span>
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
        <h2 className="label font-semibold">WEEKLY BRIEF · {brief?.week ?? `WEEK ${String(isoWeek()).padStart(2, "0")}`} · AI</h2>
        {brief ? <p className="mt-1 flex flex-wrap items-baseline gap-x-3"><span>{brief.headline}</span><button type="button" className="label underline underline-offset-2" onClick={() => go("brief")}>OPEN F10 FORECAST →</button></p> : <p className="mt-1">First brief publishes after the first forecast run.</p>}
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
        <p className="label mt-3 text-g500">SIGNAL ACQUISITION ░░░░░░░░░░ 0%</p>
      </div>
    </section>
  );
}
