import { Suspense, useEffect, useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { lastIngestQuery, typeIndexQuery, typeSnapshotQuery } from "@/lib/data";
import { type PanelId } from "./panels";
import { SECTIONS, sectionById, sectionOf, tabOf, tabsIn } from "@/lib/ia";
import { LENS_SECTORS, showingText } from "@/lib/sector-lens";
import { sectorName } from "@/lib/labels";
import { SpreadTicker } from "./Spread";
import { LibraryTicker } from "./Library";
import { Wordmark } from "@/components/brand/Wordmark";

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

/** F1–F6: the six sections (old F7–F12, T, W and D stay as aliases; see src/lib/ia.ts). */
export function FKeys({ active, onSelect }: { active: PanelId; onSelect: (p: PanelId) => void }) {
  const nav=useRef<HTMLElement>(null), current = sectionOf(active);
  useEffect(()=>{nav.current?.querySelector('[aria-current="page"]')?.scrollIntoView({block:"nearest",inline:"nearest"});},[active]);
  return (
    <nav ref={nav} aria-label="Sections" className="no-scrollbar flex h-full min-w-0 overflow-x-auto">
      {SECTIONS.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s.terminal)}
          aria-current={current === s.id ? "page" : undefined}
          className={`label h-full shrink-0 border-l border-rule px-2 last:border-r ${
            current === s.id ? "bg-ink text-void" : "text-g500 hover:text-ink"
          }`}
        >
          <span className={current === s.id ? "" : "text-ink"}>{s.key}</span> {s.label.toUpperCase()}
        </button>
      ))}
    </nav>
  );
}

/** The current section's tabs (←/→ or [ ] move between them), the sector lens and the Read switch. */
export function TabRow({ active, onSelect, sector, onSector, readHref, onRead }: { active: PanelId; onSelect: (p: PanelId) => void; sector: string; onSector: (s: string) => void; readHref: string; onRead: () => void }) {
  const tabs = tabsIn(sectionOf(active)), tab = tabOf(active);
  return (
    <div className="flex min-h-8 flex-wrap items-stretch border-b border-rule bg-void">
      <div role="tablist" aria-label={`${sectionById(sectionOf(active)).label} tabs`} className="no-scrollbar flex min-w-0 flex-1 basis-full overflow-x-auto border-b border-rule md:basis-0 md:border-b-0">
        {tabs.map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} tabIndex={tab === t.id ? 0 : -1} onClick={() => onSelect(t.id)}
            className={`label min-h-11 shrink-0 border-r border-rule px-3 md:min-h-8 ${tab === t.id ? "text-ink underline decoration-signal decoration-2 underline-offset-4" : "text-g500 hover:text-ink"}`}>{t.label}</button>
        ))}
        <span className="label hidden items-center px-3 text-g500 lg:flex">[ ] OR ← → · ` READ</span>
      </div>
      <div className="flex shrink-0 items-center gap-2 px-3">
        <label className="label flex items-center gap-1 text-g500">SECTOR
          <select value={sector} onChange={e => onSector(e.target.value)} className="label min-h-11 border border-rule bg-void px-1 text-ink md:min-h-6">
            {LENS_SECTORS.map(s => <option key={s} value={s}>{sectorName(s).toUpperCase()}</option>)}
          </select>
        </label>
        <span className="label hidden text-ink sm:inline" aria-live="polite">{showingText(sector).toUpperCase()}</span>
        <a href={readHref} onClick={e => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); onRead(); }} className="label inline-flex min-h-11 items-center border border-rule px-2 text-ink hover:bg-ink hover:text-void md:min-h-6" title="Switch to Read mode (`)">READ ⇄</a>
      </div>
    </div>
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
        <h1 className="text-ink"><Wordmark size={13} leading={16} /></h1>
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
        <span className="hidden text-g500 2xl:inline">
          LAST WIRE INGEST <span className="text-ink">{ingestStr}</span>
        </span>
        <span className="hidden text-g500 2xl:inline">TYPE SNAPSHOT <span className="text-ink">{snapshot ?? "—"}</span></span>
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
        .map((r) => ({ t: r.family, d: null as number | null, extra: `TRND #${r.trending_rank}` }));
    }
    return [...movers]
      .sort((a, b) => b.delta7! - a.delta7!)
      .slice(0, 12)
      .map((r) => ({ t: r.family, d: r.delta7, extra: `#${r.popularity_rank}` }));
  }, [data]);

  const content = items ? (
    items.map((i) => (
      <span key={i.t} className="mr-8 inline-flex gap-2">
        <span className="font-semibold normal-case text-ink">{i.t}</span><span className="text-g500">[FONT]</span>
        {i.d !== null &&
          (i.d >= 0 ? <span className="text-signal">▲{i.d}</span> : <span className="text-g500">▼{-i.d}</span>)}
        <span className="text-g500">{i.extra}</span>
      </span>
    ))
  ) : (
    <span className="mr-8 text-g500">No font signals yet — the first Google Fonts snapshot lands after the daily collection runs ·</span>
  );

  return (
    <div className="relative h-7 overflow-hidden border-b border-rule bg-void" aria-label="Top moving signals">
      <div className="animate-crawl label flex h-7 w-max items-center whitespace-nowrap" style={{ ["--crawl-duration" as string]: "50s" }}>
        {[0, 1].map((k) => (
          <div key={k} aria-hidden={k === 1} className="flex items-center pl-8">
            {content}
            <SpreadTicker/>
            <Suspense fallback={null}><LibraryTicker/></Suspense>
            {!items && content}
            {!items && content}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MobileKeys({ active, onSelect, onRead }: { active: PanelId; onSelect: (p: PanelId) => void; onRead: () => void }) {
  const [more, setMore] = useState(false), current = sectionOf(active);
  const primary = SECTIONS.slice(0, 3), rest = SECTIONS.slice(3);
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      {more && (
        <div className="grid grid-cols-2 border-t border-rule bg-void">
          {rest.map((s) => (
            <button key={s.id} onClick={() => { onSelect(s.terminal); setMore(false); }}
              className={`label h-11 border-b border-r border-rule px-3 text-left ${current === s.id ? "bg-ink text-void" : "text-ink"}`}>{s.key} {s.label.toUpperCase()}</button>
          ))}
          <button onClick={() => { setMore(false); onRead(); }} className="label h-11 border-b border-r border-rule px-3 text-left text-ink">` READ MODE</button>
        </div>
      )}
      <nav aria-label="Sections" className="grid h-11 grid-cols-4 border-t border-rule bg-g900">
        {primary.map((s) => (
          <button key={s.id} onClick={() => { onSelect(s.terminal); setMore(false); }} aria-current={current === s.id ? "page" : undefined}
            className={`label h-11 border-r border-rule ${current === s.id ? "bg-ink text-void" : "text-ink"}`}>{s.key} {s.label.toUpperCase()}</button>
        ))}
        <button onClick={() => setMore((m) => !m)} aria-expanded={more}
          className={`label h-11 ${more || rest.some((r) => r.id === current) ? "bg-ink text-void" : "text-ink"}`}>MORE</button>
      </nav>
    </div>
  );
}
