import { line as voiced, say as sayState } from "@/lib/voice";
import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { Suspense, useCallback, useEffect, useState } from "react";
import { MobileKeys, TabRow, Ticker, TopBar } from "@/components/terminal/Chrome";
import { TypeIndex } from "@/components/terminal/TypeIndex";
import { Overview } from "@/components/terminal/Views";
import { Wire, useWireRealtime } from "@/components/terminal/Wire";
import { Today } from "@/components/terminal/Today";
import { Tour } from "@/components/terminal/Tour";
import { Glossary } from "@/components/terminal/Glossary";
import { Methodology } from "@/components/terminal/Methodology";
import { modeTour } from "@/lib/tour";
import { Button } from "@/components/ui/button";
import { McpOverlay } from "@/components/terminal/McpOverlay";
import { CrawlScopeProvider, Toggle } from "@/components/terminal/CrawlControls";
import { CrawlPanel, InTheWild } from "@/components/terminal/CrawlPanels";
import { Library } from "@/components/terminal/Library";
import { libraryQuery, libraryHistoryQuery, forecastQuery, vibeQuery, rebrandsQuery, chartCardQuery, todayQuery, signalsQuery, patternsQuery, storyQueueQuery, dataIndexQuery } from "@/lib/data";
import { VibeMap } from "@/components/terminal/VibeMap";
import { PanelHeadlines } from "@/components/terminal/Signals";
import { HistoryPanel } from "@/components/terminal/LibraryHistory";
import { ForecastPanel } from "@/components/terminal/Forecast";
import { TasteConsole, type LocalCommand } from "@/components/terminal/TasteConsole";
import { HealthLine } from "@/components/terminal/Health";
import { GATE_ENABLED } from "@/lib/gate";
import { WatchPanel } from "@/components/terminal/Watch";
import { AuditTab, ConsoleTab, DigestTab, LedgerTab, MovesTab, PatternsTab, StudiesTab } from "@/components/terminal/Sections";
import { MorningTab, SectorsTab } from "@/components/terminal/Editions";
import { parseAuditSites } from "@/lib/agency/audit";
import { terminalObjectHref, keyView, resolveKey, resolveView, sectionById, sectionOf, stepTab, type TerminalSearch, type ViewId } from "@/lib/ia";
import { resolveSector } from "@/lib/sector-lens";
import { useModeToggle, useSectorLens } from "@/components/read/lens";
import { BRAND_NAME } from "@/lib/brand";
import { useStaffKey } from "@/lib/staff-key";

const TITLE = `Terminal — ${BRAND_NAME}`;
const DESC = `The dense, keyboard-first view of ${BRAND_NAME}: seven sections (Today, Signals, Brands, Patterns, Studies, Digest, Tools) with every number's receipts.`;
const str = (v: unknown) => (typeof v === "string" ? v : undefined);

export const Route = createFileRoute("/terminal")({
  staticData: { mode: "dark" },
  validateSearch: (s: Record<string, unknown>): TerminalSearch => ({ panel: str(s["panel"]) ?? "today", ...(str(s["sector"]) ? { sector: str(s["sector"])! } : {}), q: str(s["q"]) ?? "", sort: str(s["sort"]) ?? "domain", desc: s["desc"] === true, page: typeof s["page"] === "number" ? s["page"] : 0, cmd: str(s["cmd"])?.slice(0, 4096), trait: str(s["trait"]), story: str(s["story"])?.slice(0, 200) }),
  // U1: an object's terminal view (a story, a signal or a pattern) has moved to that object's one address, in its Data view.
  beforeLoad: ({ location }) => { const href = terminalObjectHref(location.search as Record<string, unknown>); if (href) throw redirect({ href, statusCode: 301 }); },
  loaderDeps: ({ search }) => ({ panel: resolveView(search.panel), sector: resolveSector(search.sector) }),
  // L2 · shell first, as the Read pages: every panel's reads (the signal snapshot included) are started here but never awaited, and the
  // whole panel area sits in one Suspense boundary, so the first byte no longer waits on the slowest read; the streamed HTML is the same.
  loader: ({ context, deps }) => {
    const q = context.queryClient, v = deps.panel;
    for (const o of terminalReads(v, deps.sector, typeof window === "undefined")) void q.prefetchQuery(o as never);
  },
  errorComponent: () => <div role="alert" className="p-3">{sayState("terminal.failed").title} · {sayState("terminal.failed").text} · <Link to="/" className="underline">LIVE FRONT PAGE</Link></div>,
  notFoundComponent: () => <div className="p-3">{sayState("terminal.notFound").title} · {sayState("terminal.notFound").text}</div>,
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => <CrawlScopeProvider><Terminal /></CrawlScopeProvider>,
});

/** The reads a panel starts before the shell (the signal snapshot first: every panel filters by tier). On the server the story queue
 *  (a list of every published, held and taken-down story, ~470 KB) is not started: its panel reads it after hydration, as it already
 *  does on a cold client, so the server render no longer waits on it. */
export function terminalReads(v: ViewId, sector: string, server = false): { queryKey: readonly unknown[] }[] {
  const extra = v === "today" ? [todayQuery(), ...(server ? [] : [storyQueueQuery(null)])] : v === "library" ? [libraryQuery()] : v === "history" ? [libraryHistoryQuery()]
    : v === "brief" ? [forecastQuery(), chartCardQuery(null)] : v === "vibe" ? [vibeQuery()]
    : v === "rebrands" ? [rebrandsQuery({ sector: "all", limit: 20 })] : v === "patterns" ? [patternsQuery(sector)] : v === "studies" ? [dataIndexQuery()] : [];
  return [signalsQuery(), ...extra];
}

const Wait = ({ children }: { children: React.ReactNode }) => <Suspense fallback={<div className="p-3">{voiced("busy.terminal")} <span aria-hidden="true">▍</span></div>}>{children}</Suspense>;

function Terminal() {
  const search = Route.useSearch(), navigate = Route.useNavigate(), router = useRouter();
  const view = resolveView(search.panel);
  const [sector, setSector] = useSectorLens(), mode = useModeToggle(), staff = !!useStaffKey();
  const setPanel = useCallback((p: ViewId) => { void navigate({ search: prev => ({ ...prev, panel: p, trait: undefined, story: undefined }) }); }, [navigate]);
  const [typeTab, setTypeTab] = useState("GOOGLE FONTS");
  const [overlay, setOverlayRaw] = useState<null | "glossary" | "method" | "mcp" | "taste">(null);
  const [cmd, setCmd] = useState<string | undefined>(undefined);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [tour, setTour] = useState(false);
  const setOverlay = useCallback((o: null | "glossary" | "method" | "mcp" | "taste") => {
    setOverlayRaw(o);
    if (o === null) { setAnchor(null); setCmd(undefined); if (/^#([mg]-|mcp$)/.test(window.location.hash)) history.replaceState(history.state, "", window.location.pathname + window.location.search); }
  }, []);
  useEffect(() => { if (search.cmd) setOverlay("taste"); }, [search.cmd, setOverlay]);
  // "#m-<section>" opens the methodology, "#g-<id>" the glossary, "#mcp" the MCP guide; all deep-linkable.
  useEffect(() => {
    const on = () => { const h = decodeURIComponent(window.location.hash.slice(1)); if (h.startsWith("m-")) { setAnchor(h); setOverlayRaw("method"); } else if (h.startsWith("g-")) { setAnchor(h); setOverlayRaw("glossary"); } else if (h === "mcp") setOverlayRaw("mcp"); };
    on(); window.addEventListener("hashchange", on); return () => window.removeEventListener("hashchange", on);
  }, []);
  // First visit to Live · Today in Terminal mode: the tour, once per device.
  useEffect(() => { if (view === "today" && !window.location.hash && !search.cmd && !modeTour("terminal").done()) setTour(true); }, [view, search.cmd]);
  const startTour = useCallback(() => { setOverlay(null); modeTour("terminal").reset(); setPanel("today"); setTour(true); }, [setOverlay, setPanel]);
  const openConsole = useCallback((c?: string) => { setCmd(c); setOverlayRaw("taste"); }, []);
  const onLocal = useCallback((c: LocalCommand) => {
    setOverlay(null);
    if (c === "digest") { setPanel("digest"); return; }
    if (c === "read") { mode.go(); return; }
    if (c === "watch") { setPanel("watch"); return; }
    if (typeof c === "object") { if (c.kind === "watch-open") void navigate({ to: "/watch/$id", params: { id: c.id }, search: { k: undefined, range: "week" } }); else { const p = parseAuditSites(c.sites); if (p.ok) void navigate({ to: "/audit", search: { sites: p.domains.join(","), sector: undefined } }); else void navigate({ to: "/audit/new", search: { sites: c.sites.join(",") || undefined } }); } return; }
    if (c === "today") setPanel("today"); else if (c === "signals") setPanel("overview"); else if (c === "tour") startTour(); else setOverlay("glossary");
  }, [setOverlay, setPanel, startTour, navigate, mode]);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  useWireRealtime(useCallback((id: number) => {
    setFresh((s) => new Set(s).add(id));
    setTimeout(() => setFresh((s) => { const n = new Set(s); n.delete(id); return n; }), 2000);
  }, []));

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const fkey = /^F\d{1,2}$/.test(e.key), t = e.target as HTMLElement;
      if (e.key === "Escape") { setOverlay(null); return; }
      if (!fkey && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || t.isContentEditable || e.metaKey || e.ctrlKey || e.altKey)) return;
      if (overlay && !fkey) return;
      // Arrows step tabs only when focus is on the page or the tab row, so tables and the vibe map keep their own arrow keys.
      if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !(t === document.body || t.closest('[role="tablist"]'))) return;
      const d = resolveKey(e.key);
      if (!d) return;
      e.preventDefault();
      if ("action" in d.target) {
        const a = d.target.action;
        if (a === "glossary") setOverlay("glossary"); else if (a === "console") openConsole(); else if (a === "mode") mode.go();
        else if (a === "prev-tab") setPanel(stepTab(view, -1)); else if (a === "next-tab") setPanel(stepTab(view, 1));
        if (a === "prev-tab" || a === "next-tab") requestAnimationFrame(() => document.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus());
        return;
      }
      const v = keyView(d); if (v) setPanel(v);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [view, setPanel, setOverlay, openConsole, mode, overlay]);

  const section = sectionOf(view);
  return (
    <div className="flex min-h-dvh flex-col bg-void pb-11 md:h-dvh md:overflow-hidden md:pb-0">
      <a href="#tk-main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:bg-void focus:p-3">Skip to the panel</a>
      <div className="sticky top-0 z-30 shrink-0">
        <TopBar active={view} onSelect={setPanel} />
        <TabRow active={view} onSelect={setPanel} sector={sector} onSector={setSector} readHref={mode.href} onRead={mode.go} />
        <Ticker />
      </div>
      <main id="tk-main" tabIndex={-1} className="flex min-h-0 flex-1 flex-col focus:outline-none" aria-label={`${sectionById(section).label} section`}>
        <Wait>
        {view === "today" && <Wait><Today go={setPanel} onTour={startTour} onGlossary={() => setOverlay("glossary")} focus={search.story} /></Wait>}
        {view === "wire" && <Wire freshIds={fresh} />}
        {view === "overview" && <Overview go={setPanel} freshIds={fresh} />}
        {view === "type" && <><PanelHeadlines panel="type" /><div className="shrink-0 border-b border-rule p-3"><Toggle label="TYPE" options={["GOOGLE FONTS", "IN THE WILD"]} value={typeTab} onChange={setTypeTab} /></div>{typeTab === "GOOGLE FONTS" ? <TypeIndex /> : <InTheWild />}</>}
        {view === "color" && <CrawlPanel key="color" panel="color" />}
        {(view === "layout" || view === "composition") && <>
          <div className="shrink-0 border-b border-rule p-3"><Toggle label="LAYOUT" options={["LAYOUT", "COMPOSITION"]} value={view === "composition" ? "COMPOSITION" : "LAYOUT"} onChange={v => setPanel(v === "COMPOSITION" ? "composition" : "layout")} /></div>
          <CrawlPanel key={view} panel={view} />
        </>}
        {view === "lexicon" && <CrawlPanel key="lexicon" panel="lexicon" />}
        {view === "vibe" && <Wait><PanelHeadlines panel="vibe" /><VibeMap sector={sector} onSector={setSector} onMethod={() => setOverlay("method")} /></Wait>}
        {view === "brief" && <Wait><ForecastPanel /></Wait>}
        {view === "library" && <Wait><Library /></Wait>}
        {view === "rebrands" && <Wait><MovesTab sector={sector} onSector={setSector} /></Wait>}
        {view === "history" && <Wait><HistoryPanel /></Wait>}
        {view === "patterns" && <Wait><PatternsTab sector={sector} /></Wait>}
        {view === "studies" && <Wait><StudiesTab /></Wait>}
        {view === "digest" && <DigestTab />}
        {view === "morning" && <MorningTab />}
        {view === "sectors" && <SectorsTab sector={sector} />}
        {view === "watch" && <WatchPanel />}
        {view === "audit" && <AuditTab />}
        {view === "ledger" && <LedgerTab />}
        {view === "console" && <ConsoleTab onRun={c => openConsole(c)} />}
        </Wait>
      </main>
      <footer className="label flex min-h-6 shrink-0 items-center justify-between gap-2 border-t border-rule bg-g900 px-3 text-g500 md:h-[24px]">
        <span className="truncate max-md:hidden">DATA: GOOGLE FONTS API · <span className="normal-case">{BRAND_NAME}</span> CRAWLER · DESIGN RSS · HACKER NEWS</span>
        <div className="flex shrink-0 flex-wrap items-center">
          <HealthLine />
          {staff && <Link to="/status" className="label inline-flex h-6 items-center px-2 text-ink hover:underline max-md:h-11">STATUS</Link>}
          <Button variant="link" data-tour="console" aria-label="Open taste console" onClick={() => openConsole()} className="label h-6 px-2 text-ink max-md:h-11">/</Button>
          <Button variant="link" onClick={() => setOverlay("glossary")} className="label h-6 px-2 text-ink max-md:h-11">GLOSSARY</Button>
          <Button variant="link" onClick={() => setOverlay("mcp")} className="label h-6 px-2 text-ink max-md:h-11">MCP</Button>
          <Button variant="link" onClick={() => setOverlay("method")} className="label h-6 px-2 text-ink max-md:h-11">METHODOLOGY</Button>
          <Link to="/what-we-show" className="label inline-flex h-6 items-center px-2 text-ink hover:underline max-md:hidden">WHAT WE SHOW</Link>
          {GATE_ENABLED && <form method="post" action="/lock" className="contents"><button type="submit" className="label inline-flex h-6 items-center px-2 text-ink hover:underline max-md:h-11">LOCK</button></form>}
        </div>
        <a href="https://brandon.wtf" target="_blank" rel="noopener" className="text-ink hover:underline">BRANDON.WTF</a>
      </footer>
      <MobileKeys active={view} onSelect={setPanel} onRead={mode.go} />
      {overlay === "mcp" && <McpOverlay onClose={() => setOverlay(null)} />}
      {overlay === "taste" && <TasteConsole initialCommand={cmd ?? search.cmd} onClose={() => { setOverlay(null); if (search.cmd) void router.navigate({ href: window.location.pathname + window.location.search.replace(/([?&])cmd=[^&]*&?/, "$1").replace(/[?&]$/, ""), replace: true }); }} onLocal={onLocal} />}
      {overlay === "glossary" && <Glossary onClose={() => setOverlay(null)} onTour={startTour} focus={anchor} />}
      {overlay === "method" && <Methodology onClose={() => setOverlay(null)} focus={anchor} />}
      {tour && <Tour mode="terminal" onDone={() => setTour(false)} />}
    </div>
  );
}
