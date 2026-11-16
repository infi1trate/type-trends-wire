// The shared Read shell: ONE ink slab bar (the drawn mark on its pink slab, the six sections, the live dot with UTC time, the Read /
// Terminal switch, glossary and Lock; below 1280 px what does not fit moves into one Menu sheet), then ONE line under it: the lens note
// (only when a sector is chosen), the freshness line (one line, truncating) and the sector select. Rows per width live in lib/shell.ts.
// The footer is a slab too (DigestFooter).
// Reuses the Digest editorial system; no health or model jargon here (that lives on /status).
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { SECTIONS, readSectionOf, type SectionId } from "@/lib/ia";
import { LENS_SECTORS } from "@/lib/sector-lens";
import { lensLine, type BarItem } from "@/lib/shell";
import { sectorName } from "@/lib/labels";
import { GATE_ENABLED } from "@/lib/gate";
import { modeTour } from "@/lib/tour";
import { Glossary } from "@/components/terminal/Glossary";
import { Methodology } from "@/components/terminal/Methodology";
import { Tour } from "@/components/terminal/Tour";
import { useLocationParts, useModeToggle, useSectorLens } from "./lens";
import { FreshnessLine } from "./Freshness";
import { BRAND_NAME } from "@/lib/brand";
import { ArrivingMark } from "@/components/brand/Motion";

/** `fixedSector`: the page is about one sector (a sector report); the lens shows it and changing it moves to that sector's page. */
/** `dateline`: the front page's date and clock beside the wordmark; `segmented`: show the Read / Terminal switch as a two-part control. */
type Props = { children: ReactNode; label: string; section?: SectionId | null; lens?: boolean; note?: string | null; sub?: ReactNode; tour?: boolean; fixedSector?: { value: string; onChange: (s: string) => void } | undefined; dateline?: ReactNode; segmented?: boolean | undefined };

function SectionLink({ s, active, onGo }: { s: (typeof SECTIONS)[number]; active: boolean; onGo: () => void }) {
  const cls = "inline-flex min-h-11 items-center";
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
const pad2 = (n: number) => String(n).padStart(2, "0");
/** The red live dot with the UTC time. Client clock only (the server renders "UTC" alone, so hydration always matches). */
export function ShellClock() {
  const [t, setT] = useState<number | null>(null);
  useEffect(() => { setT(Date.now()); const id = window.setInterval(() => setT(Date.now()), 15_000); return () => window.clearInterval(id); }, []);
  const d = t === null ? null : new Date(t);
  return <span className="shell-item inline-flex min-h-11 items-center gap-2" data-shell-clock="">
    <span className="shell-dot tk-tick-dot" aria-hidden="true" />
    <span>{d ? <time dateTime={d.toISOString()}>{pad2(d.getUTCHours())}:{pad2(d.getUTCMinutes())} UTC</time> : "UTC"}</span>
  </span>;
}

/** Tailwind classes for an item that sits in the bar from its breakpoint up (and in the Menu sheet below it). */
const INLINE_CLS: Record<BarItem, string> = { switch: "max-md:hidden", sections: "max-lg:hidden", glossary: "max-xl:hidden", lock: "max-xl:hidden" };
const SHEET_CLS: Record<BarItem, string> = { switch: "md:hidden", sections: "lg:hidden", glossary: "xl:hidden", lock: "xl:hidden" };

export function ReadShell({ children, label, section, lens = false, note = null, sub, tour = false, fixedSector, dateline }: Props) {
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
  const home = <Link to="/" className="inline-flex min-h-11 shrink-0 items-center" aria-label={`${BRAND_NAME}, the front page`}><ArrivingMark height={28} /></Link>;
  const go = (e: React.MouseEvent) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); mode.go(); };
  const sections = (cls: string, list: string) => <nav aria-label="Sections" className={cls}><ul className={list}>{SECTIONS.map(s => <li key={s.id}><SectionLink s={s} active={active === s.id} onGo={() => setOpen(false)} /></li>)}</ul></nav>;
  const modeSwitch = (cls: string) => <span role="group" aria-label="Mode" className={`shell-switch ${cls}`}><a href={loc.pathname} aria-current="page">Read</a><a href={mode.href} onClick={go} data-tour="r-terminal" title="Switch to Terminal mode (`)">Terminal</a></span>;
  const glossary = (cls: string) => <button type="button" onClick={() => { setOpen(false); setOverlay("glossary"); }} className={`inline-flex min-h-11 cursor-pointer items-center ${cls}`} aria-label="Open the glossary (?)">Glossary</button>;
  const lock = (cls: string) => GATE_ENABLED ? <form method="post" action="/lock" className={`contents`}><button type="submit" className={`inline-flex min-h-11 cursor-pointer items-center ${cls}`}>Lock</button></form> : null;
  const line = lensLine({ sector, sectorName: sectorName(sector), filtered: lens || !!fixedSector, note });
  return <>
    <div className="digest">
      <a href="#ed-main" className="sr-only focus:not-sr-only">Skip to the content</a>
      {/* The chrome: one ink slab bar. Below 1280 px, whatever does not fit opens from one Menu button in a sheet. */}
      <header className="c-slab shell-top no-print" data-container="slab" data-shell-row="bar">
        <div className="ed-wrap shell-nav flex flex-nowrap items-center gap-x-5 py-1">
          {home}
          {sections(INLINE_CLS.sections, "flex flex-row gap-x-5")}
          <span className="ml-auto flex shrink-0 items-center gap-x-4">
            <ShellClock />
            {modeSwitch(INLINE_CLS.switch)}
            {glossary(INLINE_CLS.glossary)}
            {lock(INLINE_CLS.lock)}
            <button type="button" className="shell-menu inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center px-2 xl:hidden" aria-expanded={open} aria-controls="shell-sheet" onClick={() => setOpen(o => !o)}>{open ? "Close" : "Menu"}</button>
          </span>
        </div>
        <div id="shell-sheet" hidden={!open} className="shell-sheet xl:hidden" data-shell-sheet="">
          <div className="ed-wrap shell-nav grid gap-y-3 pb-4 pt-2">
            {sections(SHEET_CLS.sections, "grid grid-cols-2 gap-x-6 sm:grid-cols-3")}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">{modeSwitch(SHEET_CLS.switch)}{glossary(SHEET_CLS.glossary)}{lock(SHEET_CLS.lock)}</div>
          </div>
        </div>
      </header>
      {/* One line under the bar: the lens note (only when a sector is chosen), freshness (truncating) and the sector select. */}
      <div className="ed-wrap no-print flex flex-nowrap items-center gap-x-4" data-shell-row="sub">
        {dateline}
        {line && <span className="shell-fresh max-w-[45%] shrink-0 truncate" aria-live="polite" title={line} data-lens-line="">{line}</span>}
        <FreshnessLine />
        <label className="ml-auto flex shrink-0 items-center gap-2">
          <span className="ed-kicker max-md:sr-only">Sector</span>
          <select value={sector} onChange={e => setSector(e.target.value)} className="ed-data min-h-11 max-w-[11rem] border-[1.5px] border-ed-ink bg-transparent px-2" aria-label="Sector">
            {LENS_SECTORS.map(s => <option key={s} value={s}>{sectorName(s)}</option>)}
          </select>
        </label>
      </div>
      {sub}
      <main id="ed-main" aria-label={label}>{children}</main>
    </div>
    {/* Glossary, methodology and tour are terminal-density overlays: they keep the dark mode on Read pages. */}
    <div data-mode="dark" className="contents">
      {overlay === "glossary" && <Glossary onClose={close} onTour={startTour} focus={anchor} />}
      {overlay === "method" && <Methodology onClose={close} focus={anchor} />}
      {touring && <Tour mode="read" onDone={() => setTouring(false)} />}
    </div>
  </>;
}
