import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { FKeys, MobileKeys, Ticker, TopBar } from "@/components/terminal/Chrome";
import { PANELS, type PanelId } from "@/components/terminal/panels";
import { Overlay } from "@/components/terminal/primitives";
import { TypeIndex } from "@/components/terminal/TypeIndex";
import { Dormant, Overview } from "@/components/terminal/Views";
import { Wire, useWireRealtime } from "@/components/terminal/Wire";
import { METHODOLOGY } from "@/lib/bands";

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
  component: Terminal,
});

const KEYS = [
  ["F1–F10", "Switch panel"],
  ["1–0", "Switch panel"],
  ["/", "Focus query bar"],
  ["?", "Open keymap"],
  ["ESC", "Close overlay / drawer"],
  ["ENTER", "Open focused row"],
];

function Terminal() {
  const [panel, setPanel] = useState<PanelId>("overview");
  const [overlay, setOverlay] = useState<null | "keys" | "method">(null);
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
        if (i >= 0 && i < 10) { e.preventDefault(); setPanel(PANELS[i].id); }
        return;
      }
      if (e.key === "Escape") { setOverlay(null); return; }
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) { setPanel(PANELS[e.key === "0" ? 9 : Number(e.key) - 1].id); return; }
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
    <div className="flex min-h-screen flex-col bg-void pb-10 md:pb-0">
      <div className="sticky top-0 z-30">
        <TopBar active={panel} onSelect={setPanel} />
        <Ticker />
      </div>
      <main className="flex min-h-0 flex-1 flex-col">
        {panel === "overview" && <Overview go={setPanel} freshIds={fresh} />}
        {panel === "type" && <div className="flex h-[calc(100vh-84px)] flex-col max-md:h-[calc(100vh-124px)]"><TypeIndex /></div>}
        {panel === "wire" && <div className="flex h-[calc(100vh-84px)] flex-col max-md:h-[calc(100vh-124px)]"><Wire freshIds={fresh} /></div>}
        {!["overview", "type", "wire"].includes(panel) && <Dormant id={panel} />}
      </main>
      <footer className="label flex min-h-6 items-center justify-between gap-2 border-t border-rule bg-g900 px-3 text-g500">
        <span className="truncate max-md:hidden">DATA: GOOGLE FONTS DEVELOPER API · DESIGN RSS · HACKER NEWS</span>
        <button onClick={() => setOverlay("method")} className="h-6 px-2 text-ink hover:underline max-md:h-10">METHODOLOGY</button>
        <a href="https://brandon.wtf" target="_blank" rel="noopener" className="text-ink hover:underline">BRANDON.WTF</a>
      </footer>
      <MobileKeys active={panel} onSelect={setPanel} />
      {overlay === "keys" && (
        <Overlay title="KEYMAP" onClose={() => setOverlay(null)}>
          <dl className="grid grid-cols-[10ch_1fr] gap-y-1">
            {KEYS.map(([k, v]) => (<><dt key={k} className="font-semibold text-ink">{k}</dt><dd key={k + "d"} className="text-g500">{v}</dd></>))}
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
        </Overlay>
      )}
    </div>
  );
}

// keep FKeys import used for tree-shaking clarity on desktop bar
void FKeys;
