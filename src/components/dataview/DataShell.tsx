// U1 · THE DATA VIEW SHELL — an object's Data view (`?view=data` on its one address) inside the terminal's dark chrome: the same top bar,
// ticker and keys as /terminal. Its first line names the thing exactly as its Read view does, with the switch and one "Read view" link.
// F1–F6 open the terminal's sections, [ ] step the object's section tabs, ? the glossary, / the console, Esc closes, ` returns to Read.
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { MobileKeys, Ticker, TopBar } from "@/components/terminal/Chrome";
import { Glossary } from "@/components/terminal/Glossary";
import { TasteConsole, type LocalCommand } from "@/components/terminal/TasteConsole";
import { Tour } from "@/components/terminal/Tour";
import { modeTour } from "@/lib/tour";
import { MODE_NAME, OBJECT_NAME, OBJECT_SECTION, VIEW_NAME, keyView, resolveKey, sectionById, stepTab, terminalHref, type ObjectRef, type ViewId } from "@/lib/ia";
import { lensOfSearch, useLocationParts, useModeToggle } from "@/components/read/lens";

export type DataShellProps = { object: ObjectRef; name: ReactNode; number?: number | null | undefined; kicker?: ReactNode; children: ReactNode };

export function DataShell({ object, name, number, kicker, children }: DataShellProps) {
  const router = useRouter(), loc = useLocationParts(), mode = useModeToggle();
  const section = sectionById(OBJECT_SECTION[object.type]), home: ViewId = section.terminal, sector = lensOfSearch(loc.search);
  const [overlay, setOverlay] = useState<null | "glossary" | "console">(null), [tour, setTour] = useState(false);
  const go = useCallback((v: ViewId) => { void router.navigate({ href: terminalHref(v, { sector }) }); }, [router, sector]);
  const onLocal = useCallback((c: LocalCommand) => {
    setOverlay(null);
    if (c === "read") { mode.go(); return; }
    if (c === "today") go("today"); else if (c === "signals") go("overview"); else if (c === "digest") go("digest"); else if (c === "watch") go("watch"); else if (c === "glossary") setOverlay("glossary");
    else if (c === "tour") { modeTour("terminal").reset(); setTour(true); }
    else if (typeof c === "object" && c.kind === "watch-open") void router.navigate({ href: `/watch/${encodeURIComponent(c.id)}` });
    else if (typeof c === "object" && c.kind === "audit") void router.navigate({ href: `/audit/new?sites=${encodeURIComponent(c.sites.join(","))}` });
  }, [go, mode, router]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const fkey = /^F\d{1,2}$/.test(e.key), t = e.target as HTMLElement;
      if (e.key === "Escape") { setOverlay(null); return; }
      if (!fkey && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || t.isContentEditable || e.metaKey || e.ctrlKey || e.altKey)) return;
      if (overlay && !fkey) return;
      // Arrows keep their own job inside tables; [ ] always step.
      if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && t !== document.body) return;
      const d = resolveKey(e.key);
      if (!d) return;
      e.preventDefault();
      if ("action" in d.target) {
        const a = d.target.action;
        if (a === "glossary") setOverlay("glossary"); else if (a === "console") setOverlay("console"); else if (a === "mode") mode.go(); else if (a === "close") setOverlay(null);
        else if (a === "prev-tab") go(stepTab(home, -1)); else if (a === "next-tab") go(stepTab(home, 1));
        return;
      }
      const v = keyView(d); if (v) go(v);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [go, home, mode, overlay]);
  const read = (e: React.MouseEvent) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); mode.go(); };
  return <div className="flex min-h-dvh flex-col bg-void pb-11 text-ink md:pb-0" data-data-view={object.type}>
    <a href="#tk-main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:bg-ink focus:px-2 focus:text-void">Skip to the data</a>
    <TopBar active={home} onSelect={go} />
    <Ticker />
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-rule bg-g900 px-3 py-3" data-data-head="">
      <div className="min-w-0">
        <p className="label text-g500">{OBJECT_NAME[object.type].toUpperCase()}{kicker ? <> · {kicker}</> : null} · {VIEW_NAME.data.toUpperCase()} VIEW</p>
        <h1 className="mt-1 break-words text-hero font-semibold" data-data-name="">{number != null && <span className="num mr-2 text-g500">No. {number}</span>}{name}</h1>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
        <span role="group" aria-label="Mode" className="label inline-flex border border-rule">
          <a href={mode.href} onClick={read} className="inline-flex min-h-[44px] items-center px-2 text-g500 hover:text-ink md:min-h-8" title="Switch to the Read view (`)">{MODE_NAME.read.toUpperCase()}</a>
          <span aria-current="page" className="inline-flex min-h-[44px] items-center bg-ink px-2 text-void md:min-h-8" data-tour="r-terminal">{MODE_NAME.terminal.toUpperCase()}</span>
        </span>
        <a href={mode.href} onClick={read} className="label inline-flex min-h-[44px] items-center text-ink underline underline-offset-2 md:min-h-8" data-read-view="">Read view</a>
      </div>
    </div>
    <main id="tk-main" aria-label={`${OBJECT_NAME[object.type]} data`} className="library min-w-0 flex-1">{children}</main>
    <footer className="label flex min-h-6 shrink-0 flex-wrap items-center justify-end gap-x-1 border-t border-rule bg-g900 px-3 text-g500 max-md:hidden">
      <span className="mr-auto">F1–F6 SECTIONS · [ ] TABS · ? GLOSSARY · / CONSOLE · ` READ</span>
      <button type="button" onClick={() => setOverlay("console")} className="label h-6 px-2 text-ink hover:underline">/</button>
      <button type="button" onClick={() => setOverlay("glossary")} className="label h-6 px-2 text-ink hover:underline">GLOSSARY</button>
    </footer>
    <MobileKeys active={home} onSelect={go} onRead={mode.go} />
    {overlay === "glossary" && <Glossary onClose={() => setOverlay(null)} onTour={() => { setOverlay(null); modeTour("terminal").reset(); setTour(true); }} />}
    {overlay === "console" && <TasteConsole onClose={() => setOverlay(null)} onLocal={onLocal} />}
    {tour && <Tour mode="terminal" onDone={() => setTour(false)} />}
  </div>;
}

/** Plain words for a Data view whose object has nothing the Read view lacks (no empty dark page). */
export function DataNote({ children }: { children: ReactNode }) {
  return <p className="border-b border-rule p-3 text-g500" data-data-note="">{children}</p>;
}
