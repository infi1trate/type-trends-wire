import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useState } from "react";
import { MobileKeys, Ticker, TopBar } from "@/components/terminal/Chrome";
import { PANELS, type PanelId } from "@/components/terminal/panels";
import { Overlay } from "@/components/terminal/primitives";
import { TypeIndex } from "@/components/terminal/TypeIndex";
import { Dormant, Overview } from "@/components/terminal/Views";
import { Wire, useWireRealtime } from "@/components/terminal/Wire";
import { METHODOLOGY } from "@/lib/bands";
import { Button } from "@/components/ui/button";
import { McpOverlay } from "@/components/terminal/McpOverlay";
import { CrawlScopeProvider, Toggle } from "@/components/terminal/CrawlControls";
import { CrawlPanel, InTheWild } from "@/components/terminal/CrawlPanels";

const TITLE = "DSGN/TERMINAL — design trend terminal";
const DESC = "A live terminal for design trends: typefaces, color, layout and design news, measured weekly.";

export const Route = createFileRoute("/")({
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

const KEYS: [string, string][] = [
  ["F1–F10", "Switch panel"],
  ["1–0", "Switch panel"],
  ["/", "Focus query bar"],
  ["?", "Open keymap"],
  ["ESC", "Close overlay / drawer"],
  ["ENTER", "Open focused row"],
];

function Terminal() {
  const [panel, setPanel] = useState<PanelId>("overview");
  const [typeTab,setTypeTab]=useState("GOOGLE FONTS");
  const [overlay, setOverlay] = useState<null | "keys" | "method" | "mcp">(null);
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
        const i = Number(fk[1]) - 1;
        if (i >= 0 && i < 10) { e.preventDefault(); setPanel(PANELS[i]!.id); }
        return;
      }
      if (e.key === "Escape") { setOverlay(null); return; }
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) { setPanel(PANELS[e.key === "0" ? 9 : Number(e.key) - 1]!.id); return; }
      if (e.key === "?") { e.preventDefault(); setOverlay("keys"); return; }
      if (e.key === "/") {
        const q = document.querySelector<HTMLInputElement>("[data-query-bar]");
        if (q) { e.preventDefault(); q.focus(); }
        else if (panel === "overview") { e.preventDefault(); setPanel("type"); setTimeout(() => document.querySelector<HTMLInputElement>("[data-query-bar]")?.focus(), 50); }
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [panel]);

  return (
    <div className="flex min-h-dvh flex-col bg-void pb-10 md:h-dvh md:overflow-hidden md:pb-0">
      <div className="sticky top-0 z-30 shrink-0">
        <TopBar active={panel} onSelect={setPanel} />
        <Ticker />
      </div>
      <main className="flex min-h-0 flex-1 flex-col">
        {panel === "overview" && <Overview go={setPanel} freshIds={fresh} />}
        {panel === "type" && <><div className="shrink-0 border-b border-rule p-3"><Toggle label="TYPE" options={["GOOGLE FONTS","IN THE WILD"]} value={typeTab} onChange={setTypeTab}/></div>{typeTab==="GOOGLE FONTS"?<TypeIndex/>:<InTheWild/>}</>}
        {panel === "wire" && <Wire freshIds={fresh} />}
        {(panel==="color"||panel==="layout"||panel==="composition"||panel==="lexicon") && <CrawlPanel key={panel} panel={panel}/>}
        {!["overview", "type", "wire","color","layout","composition","lexicon"].includes(panel) && <Dormant id={panel} />}
      </main>
      <footer className="label flex min-h-6 shrink-0 items-center justify-between gap-2 border-t border-rule bg-g900 px-3 text-g500 md:h-[24px]">
        <span className="truncate max-md:hidden">DATA: GOOGLE FONTS API · DSGN-CRAWLER (WEEKLY) · DESIGN RSS · HACKER NEWS</span>
        <div className="flex shrink-0 items-center">
          <Button variant="link" onClick={() => setOverlay("mcp")} className="label h-6 px-2 text-ink max-md:h-10">MCP</Button>
          <Button variant="link" onClick={() => setOverlay("method")} className="label h-6 px-2 text-ink max-md:h-10">METHODOLOGY</Button>
        </div>
        <a href="https://brandon.wtf" target="_blank" rel="noopener" className="text-ink hover:underline">BRANDON.WTF</a>
      </footer>
      <MobileKeys active={panel} onSelect={setPanel} />
      {overlay === "mcp" && <McpOverlay onClose={() => setOverlay(null)} />}
      {overlay === "keys" && (
        <Overlay title="KEYMAP" onClose={() => setOverlay(null)}>
          <dl className="grid grid-cols-[10ch_1fr] gap-y-1">
            {KEYS.map(([k, v]) => (<Fragment key={k + v}><dt className="font-semibold text-ink">{k}</dt><dd className="text-g500">{v}</dd></Fragment>))}
          </dl>
          <div className="mt-3 border-t border-rule pt-3">
            {PANELS.map((p, i) => (
              <div key={p.id} className="flex justify-between"><span className="text-ink">{p.key} / {(i + 1) % 10}</span><span className="text-g500">{p.label}</span></div>
            ))}
          </div>
        </Overlay>
      )}
      {overlay === "method" && (
        <Overlay title="METHODOLOGY" onClose={() => setOverlay(null)}>
          <ul className="flex flex-col gap-2">
            {METHODOLOGY.map((m) => (<li key={m} className="text-ink">{m}</li>))}
          </ul>
          <h3 className="label mt-4 mb-2 text-ink">CRAWLER</h3>
          <p className="text-ink">Mainstream: Chrome UX Report top origins. Vanguard: curated design-forward studios and startups plus Show HN launches. Language comparisons default to English; ALL includes every language. Shares use all successful sites within the selected language scope.</p>
          <p className="mt-2 text-ink">Desktop homepage first viewport, 1440×900. Robots.txt respected; adult and gambling sites filtered. Rendered fonts measured via Chromium. Derived data only; no screenshots stored. Weekly Sunday 03:23 UTC.</p>
        </Overlay>
      )}
    </div>
  );
}

