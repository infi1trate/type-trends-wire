import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { lastIngestQuery, typeIndexQuery, typeSnapshotQuery } from "@/lib/data";
import { PANELS, type PanelId } from "./panels";
import { SpreadTicker } from "./Spread";

const pad = (n: number) => String(n).padStart(2, "0");

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = now ? `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}` : "--:--:--";
  return <time className="tabular-nums text-ink" aria-label="UTC time">{s} <span className="text-g500">UTC</span></time>;
}

export function FKeys({ active, onSelect }: { active: PanelId; onSelect: (p: PanelId) => void }) {
  return (
    <nav aria-label="Panels" className="no-scrollbar flex h-full min-w-0 overflow-x-auto">
      {PANELS.map((p) => (
        <button
          key={p.id}
          onClick={() => onSelect(p.id)}
          aria-current={active === p.id ? "page" : undefined}
          className={`label h-full shrink-0 border-l border-rule px-2 last:border-r ${
            active === p.id ? "bg-ink text-void" : "text-g500 hover:text-ink"
          }`}
        >
          <span className={active === p.id ? "" : "text-ink"}>{p.key}</span> {p.label}
        </button>
      ))}
    </nav>
  );
}

export function TopBar({ active, onSelect }: { active: PanelId; onSelect: (p: PanelId) => void }) {
  const { data: ingest } = useQuery(lastIngestQuery());
  const { data: snapshot } = useQuery(typeSnapshotQuery());
  const ingestStr = ingest
    ? `${pad(new Date(ingest).getUTCHours())}:${pad(new Date(ingest).getUTCMinutes())} UTC`
    : "—";
  return (
    <header className="flex h-8 items-stretch border-b border-rule bg-g900 text-label">
      <div className="flex shrink-0 items-center gap-2 px-3">
        <h1 className="label font-semibold text-ink">DSGN/TERMINAL</h1>
        <span className="label normal-case text-g500">v0.1</span>
      </div>
      <div className="hidden min-w-0 flex-1 md:block">
        <FKeys active={active} onSelect={onSelect} />
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-3 px-3 label">
        <span className="flex items-center gap-1">
          <span className="animate-pulse-dot inline-block h-2 w-2 bg-signal" aria-hidden />
          <span className="text-ink">LIVE</span>
        </span>
        <Clock />
        <span className="hidden text-g500 xl:inline">
          LAST WIRE INGEST <span className="text-ink">{ingestStr}</span>
        </span>
        <span className="hidden text-g500 xl:inline">TYPE SNAPSHOT <span className="text-ink">{snapshot ?? "—"}</span></span>
      </div>
    </header>
  );
}

export function Ticker() {
  const { data } = useQuery(typeIndexQuery());
  const items = useMemo(() => {
    if (!data || data.rows.length === 0) return null;
    const movers = data.rows.filter((r) => r.delta7 !== null);
    if (data.snapshotDays < 2 || !data.hasPrior || movers.length === 0) {
      return [...data.rows]
        .sort((a, b) => a.trending_rank - b.trending_rank)
        .slice(0, 12)
        .map((r) => ({ t: r.ticker, d: null as number | null, extra: `TRND #${r.trending_rank}` }));
    }
    return [...movers]
      .sort((a, b) => b.delta7! - a.delta7!)
      .slice(0, 12)
      .map((r) => ({ t: r.ticker, d: r.delta7, extra: `#${r.popularity_rank}` }));
  }, [data]);

  const content = items ? (
    items.map((i) => (
      <span key={i.t} className="mr-8 inline-flex gap-2">
        <span className="font-semibold text-ink">{i.t}</span>
        {i.d !== null &&
          (i.d >= 0 ? <span className="text-signal">▲{i.d}</span> : <span className="text-g500">▼{-i.d}</span>)}
        <span className="text-g500">{i.extra}</span>
      </span>
    ))
  ) : (
    <span className="mr-8 text-g500">AWAITING FIRST INGEST · DATA COLLECTION BEGINS ON DEPLOY ·</span>
  );

  return (
    <div className="relative h-7 overflow-hidden border-b border-rule bg-void" aria-label="Top movers ticker">
      <div className="animate-crawl label flex h-7 w-max items-center whitespace-nowrap" style={{ ["--crawl-duration" as string]: "50s" }}>
        {[0, 1].map((k) => (
          <div key={k} aria-hidden={k === 1} className="flex items-center pl-8">
            {content}
            <SpreadTicker/>
            {!items && content}
            {!items && content}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MobileKeys({ active, onSelect }: { active: PanelId; onSelect: (p: PanelId) => void }) {
  const [more, setMore] = useState(false);
  const primary = PANELS.filter((p) => ["overview", "type", "wire"].includes(p.id));
  const rest = PANELS.filter((p) => !["overview", "type", "wire"].includes(p.id));
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      {more && (
        <div className="grid grid-cols-2 border-t border-rule bg-void">
          {rest.map((p) => (
            <button
              key={p.id}
              onClick={() => { onSelect(p.id); setMore(false); }}
              className={`label h-10 border-b border-r border-rule text-left px-3 ${active === p.id ? "bg-ink text-void" : "text-ink"}`}
            >
              {p.key} {p.label}
            </button>
          ))}
        </div>
      )}
      <nav aria-label="Panels" className="grid h-10 grid-cols-4 border-t border-rule bg-g900">
        {primary.map((p) => (
          <button
            key={p.id}
            onClick={() => { onSelect(p.id); setMore(false); }}
            aria-current={active === p.id ? "page" : undefined}
            className={`label h-10 border-r border-rule ${active === p.id ? "bg-ink text-void" : "text-ink"}`}
          >
            {p.key} {p.label}
          </button>
        ))}
        <button
          onClick={() => setMore((m) => !m)}
          aria-expanded={more}
          className={`label h-10 ${more || rest.some((r) => r.id === active) ? "bg-ink text-void" : "text-ink"}`}
        >
          MORE
        </button>
      </nav>
    </div>
  );
}
