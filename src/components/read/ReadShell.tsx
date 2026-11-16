// The shared Read shell: masthead, section nav (Live · Signals · Brands · Patterns · Digest · Tools), the sector lens, the Terminal switch, glossary and Lock.
// Reuses the Digest editorial system; no health or model jargon here (that lives on /status).
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { SECTIONS, readSectionOf, type SectionId } from "@/lib/ia";
import { LENS_SECTORS, showingText } from "@/lib/sector-lens";
import { sectorName } from "@/lib/labels";
import { GATE_ENABLED } from "@/lib/gate";
import { modeTour } from "@/lib/tour";
import { Glossary } from "@/components/terminal/Glossary";
import { Methodology } from "@/components/terminal/Methodology";
import { Tour } from "@/components/terminal/Tour";
import { useLocationParts, useModeToggle, useSectorLens } from "./lens";
import { FreshnessLine } from "./Freshness";

/** `fixedSector`: the page is about one sector (a sector report); the lens shows it and changing it moves to that sector's page. */
type Props = { children: ReactNode; label: string; section?: SectionId | null; lens?: boolean; note?: string | null; sub?: ReactNode; tour?: boolean; fixedSector?: { value: string; onChange: (s: string) => void } | undefined };

function SectionLink({ s, active, onGo }: { s: (typeof SECTIONS)[number]; active: boolean; onGo: () => void }) {
  const cls = `ed-tap py-2 no-underline ${active ? "font-semibold underline decoration-2 underline-offset-[6px]" : ""}`;
  const aria = active ? ({ "aria-current": "page" } as const) : {};
  switch (s.id) {
    case "live": return <Link to="/" className={cls} onClick={onGo} {...aria}>{s.label}</Link>;
    case "signals": return <Link to="/signals" className={cls} onClick={onGo} {...aria}>{s.label}</Link>;
    case "brands": return <Link to="/brands" className={cls} onClick={onGo} {...aria}>{s.label}</Link>;
    case "patterns": return <Link to="/patterns" className={cls} onClick={onGo} {...aria}>{s.label}</Link>;
    case "digest": return <Link to="/digest" className={cls} onClick={onGo} {...aria}>{s.label}</Link>;
    case "tools": return <Link to="/tools" className={cls} onClick={onGo} {...aria}>{s.label}</Link>;
  }
}

export function ReadShell({ children, label, section, lens = false, note = null, sub, tour = false, fixedSector }: Props) {
  const loc = useLocationParts(), active = section === undefined ? readSectionOf(loc.pathname) : section;
  const [lensSector, setLensSector] = useSectorLens(), mode = useModeToggle();
  const sector = fixedSector?.value ?? lensSector, setSector = fixedSector?.onChange ?? setLensSector;
  const [open, setOpen] = useState(false), [overlay, setOverlay] = useState<null | "glossary" | "method">(null), [anchor, setAnchor] = useState<string | null>(null), [touring, setTouring] = useState(false);
  const close = useCallback(() => { setOverlay(null); setAnchor(null); if (/^#[mg]-/.test(window.location.hash)) history.replaceState(history.state, "", window.location.pathname + window.location.search); }, []);
  // "#g-<id>" opens the glossary and "#m-<section>" the methodology, in Read mode too.
  useEffect(() => {
    const on = () => { const h = decodeURIComponent(window.location.hash.slice(1)); if (h.startsWith("m-")) { setAnchor(h); setOverlay("method"); } else if (h.startsWith("g-")) { setAnchor(h); setOverlay("glossary"); } };
    on(); window.addEventListener("hashchange", on); return () => window.removeEventListener("hashchange", on);
  }, []);
  useEffect(() => { if (tour && !window.location.hash && !modeTour("read").done()) setTouring(true); }, [tour]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (e.key === "Escape") { close(); setOpen(false); return; }
      if (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;
      if (e.key === "`") { e.preventDefault(); mode.go(); }
      else if (e.key === "?") { e.preventDefault(); setOverlay("glossary"); }
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [mode, close]);
  const startTour = useCallback(() => { close(); modeTour("read").reset(); setTouring(true); }, [close]);
  return <>
    <div className="digest">
      <a href="#ed-main" className="sr-only focus:not-sr-only">Skip to the content</a>
      <header className="no-print border-b border-ed-ink">
        <div className="ed-wrap ed-nav flex flex-wrap items-center justify-between gap-x-4 text-[11px] uppercase tracking-[.08em]">
          <Link to="/" className="ed-tap py-2 font-semibold no-underline">DSGN/TERMINAL</Link>
          <span className="flex flex-wrap items-center gap-x-4">
            <button type="button" onClick={() => setOverlay("glossary")} className="ed-tap cursor-pointer py-2 uppercase" aria-label="Open the glossary (?)">Glossary</button>
            <a href={mode.href} onClick={e => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); mode.go(); }} data-tour="r-terminal" className="ed-tap py-2 font-semibold" title="Switch to Terminal mode (`)">Terminal ⇄</a>
            {GATE_ENABLED && <form method="post" action="/lock" className="contents"><button type="submit" className="ed-tap cursor-pointer py-2 uppercase">Lock</button></form>}
            <button type="button" className="ed-tap cursor-pointer py-2 uppercase md:hidden" aria-expanded={open} aria-controls="read-sections" onClick={() => setOpen(o => !o)}>{open ? "Close" : "Sections"}</button>
          </span>
        </div>
        <nav aria-label="Sections" className="ed-wrap ed-nav border-t border-ed-rule text-[11px] uppercase tracking-[.08em] md:border-t-0">
          <div className="flex flex-col gap-y-1 py-1 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-x-6">
            <ul id="read-sections" className={`${open ? "flex" : "hidden"} flex-col md:flex md:flex-row md:flex-wrap md:gap-x-6`}>
              {SECTIONS.map(s => <li key={s.id}><SectionLink s={s} active={active === s.id} onGo={() => setOpen(false)} /></li>)}
            </ul>
            <label className="flex items-center gap-2 normal-case tracking-normal">
              <span className="uppercase tracking-[.08em]">Sector</span>
              <select value={sector} onChange={e => setSector(e.target.value)} className="ed-data min-h-11 border border-ed-ink bg-transparent px-2 lg:min-h-8">
                {LENS_SECTORS.map(s => <option key={s} value={s}>{sectorName(s)}</option>)}
              </select>
            </label>
          </div>
        </nav>
      </header>
      <p className="ed-wrap ed-data no-print pt-3" aria-live="polite">{showingText(sector)}{!lens && !fixedSector && sector !== "all" ? " · this page is not filtered by sector" : ""}{note ? <span className="ed-muted"> · {note}</span> : null}</p>
      <FreshnessLine />
      {sub}
      <main id="ed-main" aria-label={label}>{children}</main>
    </div>
    {overlay === "glossary" && <Glossary onClose={close} onTour={startTour} focus={anchor} />}
    {overlay === "method" && <Methodology onClose={close} focus={anchor} />}
    {touring && <Tour mode="read" onDone={() => setTouring(false)} />}
  </>;
}
