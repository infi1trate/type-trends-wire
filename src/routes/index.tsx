import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense, useCallback, useEffect, useState } from "react";
import { MobileKeys, Ticker, TopBar } from "@/components/terminal/Chrome";
import { FKEY_PANELS, resolvePanel, type PanelId } from "@/components/terminal/panels";
import { TypeIndex } from "@/components/terminal/TypeIndex";
import { Dormant, Overview } from "@/components/terminal/Views";
import { Wire, useWireRealtime } from "@/components/terminal/Wire";
import { Today } from "@/components/terminal/Today";
import { Tour } from "@/components/terminal/Tour";
import { Glossary } from "@/components/terminal/Glossary";
import { Methodology } from "@/components/terminal/Methodology";
import { tourStore } from "@/lib/tour";
import { Button } from "@/components/ui/button";
import { McpOverlay } from "@/components/terminal/McpOverlay";
import { CrawlScopeProvider, Toggle } from "@/components/terminal/CrawlControls";
import { CrawlPanel, InTheWild } from "@/components/terminal/CrawlPanels";
import { Library } from "@/components/terminal/Library";
import { libraryQuery, libraryHistoryQuery, forecastQuery, vibeQuery, rebrandsQuery, chartCardQuery, todayQuery, signalsQuery } from "@/lib/data";
import { VibeMap } from "@/components/terminal/VibeMap";
import { PanelHeadlines } from "@/components/terminal/Signals";
import { RebrandDesk } from "@/components/terminal/Rebrands";
import { HistoryPanel } from "@/components/terminal/LibraryHistory";
import { ForecastPanel } from "@/components/terminal/Forecast";
import {TasteConsole, type LocalCommand} from "@/components/terminal/TasteConsole";
import { HealthLine } from "@/components/terminal/Health";
import { GATE_ENABLED } from "@/lib/gate";
import { WatchPanel } from "@/components/terminal/Watch";
import { parseAuditSites } from "@/lib/agency/audit";

const TITLE = "DSGN/TERMINAL — design trend terminal";
const DESC = "A live terminal for design trends: what moved today in type, color, layout and vibe, with receipts for every number.";

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { panel?: string; sector?: string; q?: string; sort?: string; desc?: boolean; page?: number; cmd?:string | undefined; trait?:string | undefined } => ({ panel: typeof s["panel"] === "string" ? s["panel"] : "today", sector: typeof s["sector"] === "string" ? s["sector"] : "all", q: typeof s["q"] === "string" ? s["q"] : "", sort: typeof s["sort"] === "string" ? s["sort"] : "domain", desc: s["desc"] === true, page: typeof s["page"] === "number" ? s["page"] : 0,cmd:typeof s['cmd']==='string'?s['cmd'].slice(0,4096):undefined,trait:typeof s['trait']==='string'?s['trait']:undefined }),
  loaderDeps: ({ search }) => ({ panel: search.panel }),
  // Every panel filters by tier, so the signal snapshot loads with the page (SSR and client then render the same headline set).
  loader: ({ context, deps }) => Promise.all([context.queryClient.ensureQueryData(signalsQuery()).catch(() => null), resolvePanel(deps.panel) === "today" ? Promise.all([context.queryClient.ensureQueryData(todayQuery()), context.queryClient.ensureQueryData(signalsQuery()).catch(() => null)]).then(() => undefined) : deps.panel === "library" ? context.queryClient.ensureQueryData(libraryQuery()).then(() => undefined) : deps.panel === "history" ? context.queryClient.ensureQueryData(libraryHistoryQuery()).then(()=>undefined) : deps.panel === "brief" ? Promise.all([context.queryClient.ensureQueryData(forecastQuery()), context.queryClient.ensureQueryData(chartCardQuery(null))]).then(()=>undefined) : deps.panel === "vibe" ? context.queryClient.ensureQueryData(vibeQuery()).then(()=>undefined) : deps.panel === "rebrands" ? context.queryClient.ensureQueryData(rebrandsQuery({ sector: "all", limit: 20 })).then(()=>undefined) : undefined]).then(() => undefined),
  errorComponent: () => <div role="alert" className="p-3">LIBRARY DATA UNAVAILABLE</div>,
  notFoundComponent: () => <div className="p-3">NOT FOUND</div>,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <CrawlScopeProvider><Terminal/></CrawlScopeProvider>,
});

function Terminal() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const panel = resolvePanel(search.panel);
  const setPanel = useCallback((p: PanelId) => { void navigate({ search: prev => ({ ...prev, panel: p }) }); }, [navigate]);
  const setSector = useCallback((sector: string) => { void navigate({ search: prev => ({ ...prev, sector }) }); }, [navigate]);
  const [typeTab,setTypeTab]=useState("GOOGLE FONTS");
  const [overlay, setOverlayRaw] = useState<null | "glossary" | "method" | "mcp" | "taste">(null);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [tour, setTour] = useState(false);
  const setOverlay = useCallback((o: null | "glossary" | "method" | "mcp" | "taste") => {
    setOverlayRaw(o);
    if (o === null) { setAnchor(null); if (/^#[mg]-/.test(window.location.hash)) history.replaceState(history.state, "", window.location.pathname + window.location.search); }
  }, []);
  useEffect(()=>{if(search.cmd)setOverlay('taste');},[search.cmd, setOverlay]);
  // "#m-<section>" opens the methodology, "#g-<id>" the glossary; both are deep-linkable.
  useEffect(() => {
    const on = () => { const h = decodeURIComponent(window.location.hash.slice(1)); if (h.startsWith("m-")) { setAnchor(h); setOverlayRaw("method"); } else if (h.startsWith("g-")) { setAnchor(h); setOverlayRaw("glossary"); } };
    on(); window.addEventListener("hashchange", on); return () => window.removeEventListener("hashchange", on);
  }, []);
  // First visit to TODAY: show the tour once (dsgn.tour.done).
  useEffect(() => { if (panel === "today" && !window.location.hash && !search.cmd && !tourStore().done()) setTour(true); }, [panel, search.cmd]);
  const startTour = useCallback(() => { setOverlay(null); tourStore().reset(); setPanel("today"); setTour(true); }, [setOverlay, setPanel]);
  const onLocal = useCallback((c: LocalCommand) => { setOverlay(null); if (c === "digest") { void navigate({ to: "/digest" }); return; }
    if (c === "watch") { setPanel("watch"); return; }
    if (typeof c === "object") { if (c.kind === "watch-open") void navigate({ to: "/watch/$id", params: { id: c.id }, search: { k: undefined, range: "week" } }); else { const p = parseAuditSites(c.sites); if (p.ok) void navigate({ to: "/audit", search: { sites: p.domains.join(","), sector: undefined } }); else void navigate({ to: "/audit/new", search: { sites: c.sites.join(",") || undefined } }); } return; } if (c === "today") setPanel("today"); else if (c === "signals") setPanel("overview"); else if (c === "tour") startTour(); else setOverlay("glossary"); }, [setOverlay, setPanel, startTour, navigate]);
  const [fresh, setFresh] = useState<Set<number>>(new Set());

  useWireRealtime(
    useCallback((id: number) => {
      setFresh((s) => new Set(s).add(id));
      setTimeout(() => setFresh((s) => { const n = new Set(s); n.delete(id); return n; }), 2000);
    }, []),
  );

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const fk = /^F(\d{1,2})$/.exec(e.key);
      if (fk) {
        const target = FKEY_PANELS.find(p => p.key === e.key);
        if (target) { e.preventDefault(); setPanel(target.id); }
        return;
      }
      if (e.key === "Escape") { setOverlay(null); return; }
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) { const target = FKEY_PANELS[e.key === "0" ? 9 : Number(e.key) - 1]; if (target) setPanel(target.id); return; }
      if (e.key === "t" || e.key === "T") { e.preventDefault(); setPanel("today"); return; }
      if (e.key === "w" || e.key === "W") { e.preventDefault(); setPanel("watch"); return; }
      if (e.key === "?") { e.preventDefault(); setOverlay("glossary"); return; }
      if (e.key === "d" || e.key === "D") { e.preventDefault(); void navigate({ to: "/digest" }); return; }
      if (e.key === "/") { e.preventDefault(); setOverlay('taste'); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [panel, setPanel, setOverlay]);

  return (
    <div className="flex min-h-dvh flex-col bg-void pb-10 md:h-dvh md:overflow-hidden md:pb-0">
      <div className="sticky top-0 z-30 shrink-0">
        <TopBar active={panel} onSelect={setPanel} />
        <Ticker />
      </div>
      <main className="flex min-h-0 flex-1 flex-col">
        {panel === "today" && <Suspense fallback={<div className="p-3">▍</div>}><Today go={setPanel} onTour={startTour} onGlossary={() => setOverlay("glossary")} /></Suspense>}
        {panel === "overview" && <Overview go={setPanel} freshIds={fresh} />}
        {panel === "type" && <><PanelHeadlines panel="type" /><div className="shrink-0 border-b border-rule p-3"><Toggle label="TYPE" options={["GOOGLE FONTS","IN THE WILD"]} value={typeTab} onChange={setTypeTab}/></div>{typeTab==="GOOGLE FONTS"?<TypeIndex/>:<InTheWild/>}</>}
        {panel === "wire" && <Wire freshIds={fresh} />}
        {panel === "library" && <Suspense fallback={<div className="p-3">▍</div>}><Library/></Suspense>}
        {panel === "history" && <Suspense fallback={<div className="p-3">▍</div>}><HistoryPanel/></Suspense>}
        {panel === "brief" && <Suspense fallback={<div className="p-3">▍</div>}><ForecastPanel/></Suspense>}
        {panel === "vibe" && <Suspense fallback={<div className="p-3">▍</div>}><PanelHeadlines panel="vibe" /><VibeMap sector={search.sector ?? "all"} onSector={setSector} onMethod={() => setOverlay("method")}/></Suspense>}
        {panel === "rebrands" && <Suspense fallback={<div className="p-3">▍</div>}><RebrandDesk sector={search.sector ?? "all"} onSector={setSector}/></Suspense>}
        {panel === "watch" && <WatchPanel />}
        {(panel==="color"||panel==="layout"||panel==="composition"||panel==="lexicon") && <CrawlPanel key={panel} panel={panel}/>}
        {!["today", "overview", "type", "wire","color","layout","composition","lexicon","library","history","brief","vibe","rebrands","watch"].includes(panel) && <Dormant id={panel} />}
      </main>
      <footer className="label flex min-h-6 shrink-0 items-center justify-between gap-2 border-t border-rule bg-g900 px-3 text-g500 md:h-[24px]">
        <span className="truncate max-md:hidden">DATA: GOOGLE FONTS API · DSGN-CRAWLER (WEEKLY) · DESIGN RSS · HACKER NEWS</span>
        <div className="flex shrink-0 items-center">
          <HealthLine />
          <Button variant="link" data-tour="console" aria-label="Open taste console" onClick={()=>setOverlay('taste')} className="label h-6 px-2 text-ink max-md:h-11">/</Button>
          <Button variant="link" onClick={() => setOverlay("glossary")} className="label h-6 px-2 text-ink max-md:h-11">GLOSSARY</Button>
          <Button variant="link" onClick={() => setOverlay("mcp")} className="label h-6 px-2 text-ink max-md:h-10">MCP</Button>
          <Button variant="link" onClick={() => setOverlay("method")} className="label h-6 px-2 text-ink max-md:h-10">METHODOLOGY</Button>
          <Link to="/what-we-show" className="label inline-flex h-6 items-center px-2 text-ink hover:underline max-md:hidden">WHAT WE SHOW</Link>
          <Link to="/digest" className="label inline-flex h-6 items-center px-2 text-ink hover:underline max-md:h-11">THE DIGEST →</Link>
          {GATE_ENABLED && <form method="post" action="/lock" className="contents"><button type="submit" className="label inline-flex h-6 items-center px-2 text-ink hover:underline max-md:h-11">LOCK</button></form>}
        </div>
        <a href="https://brandon.wtf" target="_blank" rel="noopener" className="text-ink hover:underline">BRANDON.WTF</a>
      </footer>
      <MobileKeys active={panel} onSelect={setPanel} />
      {overlay === "mcp" && <McpOverlay onClose={() => setOverlay(null)} />}
      {overlay === "taste" && <TasteConsole initialCommand={search.cmd} onClose={()=>setOverlay(null)} onLocal={onLocal}/>}
      {overlay === "glossary" && <Glossary onClose={() => setOverlay(null)} onTour={startTour} focus={anchor} />}
      {overlay === "method" && <Methodology onClose={() => setOverlay(null)} focus={anchor} />}
      {tour && <Tour onDone={() => setTour(false)} />}
    </div>
  );
}

