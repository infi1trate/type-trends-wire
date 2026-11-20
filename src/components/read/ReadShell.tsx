// The shared Read shell: ONE ink slab bar (the drawn mark on its pink slab, the bar's items and More (E3: lib/ia.ts READ_BAR, MORE_MENU),
// the live dot with UTC time, the Read / Terminal switch and Lock; below 1024 px what does not fit moves into one Menu sheet), then ONE line under it: the lens note
// (only when a sector is chosen), the freshness line (one line, truncating) and the sector select. Rows per width live in lib/shell.ts.
// The footer is a slab too (DigestFooter).
// Reuses the Digest editorial system; no health or model jargon here (that lives on /status).
import { PrintFrame, PrintMark } from "./PrintFrame";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { MORE_LABEL, MORE_MENU, READ_BAR, readBarOf, readSectionOf, type SectionId } from "@/lib/ia";
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

/** One bar item (E3: Today, Signals, Brands, Patterns, Studies, Digest; lib/ia.ts READ_BAR). Addresses are the sections' own. */
function BarLink({ b, active, onGo }: { b: (typeof READ_BAR)[number]; active: boolean; onGo: () => void }) {
  const cls = "inline-flex min-h-11 items-center";
  const aria = active ? ({ "aria-current": "page" } as const) : {};
  switch (b.id) {
    case "today": return <Link to="/" className={cls} onClick={onGo} {...aria}>{b.label}</Link>;
    case "signals": return <Link to="/signals" className={cls} onClick={onGo} {...aria}>{b.label}</Link>;
    case "brands": return <Link to="/brands" className={cls} onClick={onGo} {...aria}>{b.label}</Link>;
    case "patterns": return <Link to="/patterns" className={cls} onClick={onGo} {...aria}>{b.label}</Link>;
    case "studies": return <Link to="/data" className={cls} onClick={onGo} {...aria}>{b.label}</Link>;
    case "digest": return <Link to="/digest" className={cls} onClick={onGo} {...aria}>{b.label}</Link>;
  }
}
/** One More item: a page link, the RSS feed, or the glossary overlay. */
function MoreLink({ m, current, onGo, onGlossary }: { m: (typeof MORE_MENU)[number]; current: boolean; onGo: () => void; onGlossary: () => void }) {
  const cls = "inline-flex min-h-11 items-center";
  const aria = current ? ({ "aria-current": "page" } as const) : {};
  switch (m.id) {
    case "tools": return <Link to="/tools" className={cls} onClick={onGo} {...aria}>{m.label}</Link>;
    case "glossary": return <button type="button" className={`${cls} cursor-pointer`} onClick={() => { onGo(); onGlossary(); }} aria-label="Open the glossary (?)">{m.label}</button>;
    case "story-rules": return <Link to="/what-we-show" hash="ed-w-story" className={cls} onClick={onGo}>{m.label}</Link>;
    case "what-we-show": return <Link to="/what-we-show" className={cls} onClick={onGo} {...aria}>{m.label}</Link>;
    case "rss": return <a href={m.href ?? "/morning/rss.xml"} className={cls} onClick={onGo}>{m.label}</a>;
  }
}
const moreCurrent = (id: string, path: string) => (id === "tools" && readSectionOf(path) === "tools") || (id === "what-we-show" && path === "/what-we-show");
/** More in the bar (from 1024 px): one button opening a short list on the ink slab. A disclosure, not a trap: Escape closes it and
 *  returns focus to the button, and it closes when focus or a click leaves it. */
function MoreMenu({ active, path, onGlossary }: { active: boolean; path: string; onGlossary: () => void }) {
  const [open, setOpen] = useState(false), wrap = useRef<HTMLDivElement>(null), btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const out = (e: Event) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("focusin", out); document.addEventListener("pointerdown", out);
    return () => { document.removeEventListener("focusin", out); document.removeEventListener("pointerdown", out); };
  }, [open]);
  const onKey = (e: React.KeyboardEvent) => { if (e.key === "Escape" && open) { e.stopPropagation(); setOpen(false); btn.current?.focus(); } };
  return <div ref={wrap} className="relative" onKeyDown={onKey} data-shell-more="">
    <button ref={btn} type="button" className="inline-flex min-h-11 cursor-pointer items-center gap-1" aria-expanded={open} aria-controls="shell-more" data-current={active ? "" : undefined} onClick={() => setOpen(o => !o)}>
      {MORE_LABEL}<span aria-hidden="true">{open ? "▴" : "▾"}</span>
    </button>
    <ul id="shell-more" hidden={!open} className="c-slab shell-more absolute left-0 top-full z-50 grid min-w-[15rem] px-4 py-2" data-container="slab">
      {MORE_MENU.map(m => <li key={m.id}><MoreLink m={m} current={moreCurrent(m.id, path)} onGo={() => setOpen(false)} onGlossary={onGlossary} /></li>)}
    </ul>
  </div>;
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
const INLINE_CLS: Record<BarItem, string> = { switch: "max-md:hidden", sections: "max-lg:hidden", lock: "max-lg:hidden" };
const SHEET_CLS: Record<BarItem, string> = { switch: "md:hidden", sections: "lg:hidden", lock: "lg:hidden" };

// P1 · shell first: a route draws the shell at once and the page's full view arrives later inside it. A view's own shell then
// renders only its children (no second bar); its lens note, which may depend on the data, is handed up to the shell already drawn.
const ShellCtx = createContext<null | { setNote: (n: string | null | undefined) => void }>(null);
export function ReadShell(p: Props) {
  return useContext(ShellCtx) ? <ShellInside note={p.note}>{p.children}</ShellInside> : <ReadShellFrame {...p} />;
}
function ShellInside({ note, children }: { note?: string | null | undefined; children: ReactNode }) {
  const outer = useContext(ShellCtx)!;
  useEffect(() => { if (note === undefined) return; outer.setNote(note); return () => outer.setNote(undefined); }, [note, outer]);
  return <>{children}</>;
}
function ReadShellFrame({ children, label, section, lens = false, note: ownNote = null, sub, tour = false, fixedSector, dateline }: Props) {
  const [handed, setHanded] = useState<string | null | undefined>(undefined), note = ownNote ?? handed ?? null;
  const ctx = useRef({ setNote: (n: string | null | undefined) => setHanded(n) }).current;
  const loc = useLocationParts();
  // The bar lights up by address (Studies and the explainer pages have their own item); a page that names its section keeps it.
  const barActive = section === null ? null : loc.pathname.startsWith("/data") ? "studies" : section === undefined ? readBarOf(loc.pathname) : section === "live" ? "today" : section === "tools" ? "more" : section;
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
  // The Menu sheet is a disclosure, not a trap: Tab can leave it, and it closes when focus leaves the bar; Escape closes it and returns focus to Menu.
  const menuRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const out = (e: FocusEvent) => { if (!(e.target as HTMLElement).closest?.(".shell-top")) setOpen(false); };
    document.addEventListener("focusin", out); return () => document.removeEventListener("focusin", out);
  }, [open]);
  const onBarKey = (e: React.KeyboardEvent) => { if (e.key === "Escape" && open) { e.stopPropagation(); setOpen(false); menuRef.current?.focus(); } };
  const startTour = useCallback(() => { close(); modeTour("read").reset(); setTouring(true); }, [close]);
  const home = <Link to="/" className="inline-flex min-h-11 shrink-0 items-center" aria-label={`${BRAND_NAME}, the front page`}><ArrivingMark height={32} /></Link>;
  const go = (e: React.MouseEvent) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); mode.go(); };
  const openGlossary = () => { setOpen(false); setOverlay("glossary"); };
  const bar = <nav aria-label="Sections" className={INLINE_CLS.sections}><ul className="flex flex-row gap-x-5">
    {READ_BAR.map(b => <li key={b.id}><BarLink b={b} active={barActive === b.id} onGo={() => setOpen(false)} /></li>)}
    <li><MoreMenu active={barActive === "more"} path={loc.pathname} onGlossary={openGlossary} /></li>
  </ul></nav>;
  // Below 1024 px: the same items in the same order in the Menu sheet, More's list under its own label.
  const sheetNav = <nav aria-label="Sections" className={SHEET_CLS.sections}>
    <ul className="grid grid-cols-2 gap-x-6 sm:grid-cols-3">{READ_BAR.map(b => <li key={b.id}><BarLink b={b} active={barActive === b.id} onGo={() => setOpen(false)} /></li>)}</ul>
    <p className="shell-item mt-3" id="shell-sheet-more">{MORE_LABEL}</p>
    <ul className="grid grid-cols-2 gap-x-6 sm:grid-cols-3" aria-labelledby="shell-sheet-more">{MORE_MENU.map(m => <li key={m.id}><MoreLink m={m} current={moreCurrent(m.id, loc.pathname)} onGo={() => setOpen(false)} onGlossary={openGlossary} /></li>)}</ul>
  </nav>;
  // A page with its own Data view at the same address (?view=data) marks Terminal as current while it is shown.
  const dataView = loc.pathname === "/signals/leading" && loc.search["view"] === "data";
  const modeSwitch = (cls: string) => <span role="group" aria-label="Mode" className={`shell-switch ${cls}`}>{dataView
    ? <><a href={mode.href} onClick={go} title="Switch to the Read view (`)">Read</a><a href={`${loc.pathname}?view=data`} aria-current="page" data-tour="r-terminal">Terminal</a></>
    : <><a href={loc.pathname} aria-current="page">Read</a><a href={mode.href} onClick={go} data-tour="r-terminal" title="Switch to Terminal mode (`)">Terminal</a></>}</span>;
  const lock = (cls: string) => GATE_ENABLED ? <form method="post" action="/lock" className={`contents`}><button type="submit" className={`inline-flex min-h-11 cursor-pointer items-center ${cls}`}>Lock</button></form> : null;
  const line = lensLine({ sector, sectorName: sectorName(sector), filtered: lens || !!fixedSector, note });
  return <>
    <div className="digest">
      <a href="#ed-main" className="sr-only focus:not-sr-only">Skip to the content</a>
      {/* The chrome: one ink slab bar. Below 1280 px, whatever does not fit opens from one Menu button in a sheet. */}
      <header className="c-slab shell-top no-print" data-container="slab" data-shell-row="bar" onKeyDown={onBarKey}>
        <div className="ed-wrap shell-nav flex flex-nowrap items-center gap-x-5 py-1">
          {home}
          {bar}
          <span className="ml-auto flex shrink-0 items-center gap-x-4">
            <ShellClock />
            {modeSwitch(INLINE_CLS.switch)}
            {lock(INLINE_CLS.lock)}
            <button ref={menuRef} type="button" className="shell-menu inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center px-2 lg:hidden" aria-expanded={open} aria-controls="shell-sheet" onClick={() => setOpen(o => !o)}>{open ? "Close" : "Menu"}</button>
          </span>
        </div>
        <div id="shell-sheet" hidden={!open} className="shell-sheet lg:hidden" data-shell-sheet="">
          <div className="ed-wrap shell-nav grid gap-y-3 pb-4 pt-2">
            {sheetNav}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">{modeSwitch(SHEET_CLS.switch)}{lock(SHEET_CLS.lock)}</div>
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
      <PrintMark />
      <main id="ed-main" aria-label={label}><ShellCtx.Provider value={ctx}>{children}</ShellCtx.Provider></main>
      <PrintFrame path={loc.pathname} />
    </div>
    {/* Glossary, methodology and tour are terminal-density overlays: they keep the dark mode on Read pages. */}
    <div data-mode="dark" className="contents">
      {overlay === "glossary" && <Glossary onClose={close} onTour={startTour} focus={anchor} />}
      {overlay === "method" && <Methodology onClose={close} focus={anchor} />}
      {touring && <Tour mode="read" onDone={() => setTouring(false)} />}
    </div>
  </>;
}
