// A4 · keys through Read lists: j/k (arrows inside a list), Enter opens, "/" search, g+t/s/b, "?" the keys panel.
// Only a keydown listener is attached; nothing runs on first paint. Never takes a key while the reader types.
import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { KEY_HELP, isTyping, keyAction } from "@/lib/pop/keys";

const ITEMS = "#ed-main [data-ledger-row] > a.ledger-link, #ed-main a.brand-tile, #ed-main a.moved-card, #ed-main a.study-card, #ed-main [data-signal-row] a";
const SEARCH = "#ed-main input[type=search], #ed-main [role=search] input, #ed-main input#brands-q, #ed-main input[type=text]";

export function KeyNav() {
  const [open, setOpen] = useState(false);
  const g = useRef<number | null>(null);
  const nav = useNavigate();
  const path = useLocation({ select: l => l.pathname });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const items = () => [...document.querySelectorAll<HTMLElement>(ITEMS)].filter(el => el.offsetParent !== null);
      const active = document.activeElement as HTMLElement | null;
      const list = items(), at = active ? list.indexOf(active) : -1;
      const a = keyAction({ key: e.key, typing: isTyping(active), mod: e.metaKey || e.ctrlKey || e.altKey, inList: at >= 0, pendingG: g.current != null, path });
      if (g.current != null) { window.clearTimeout(g.current); g.current = null; }
      if (!a) return;
      if (a.do === "close") { setOpen(false); return; }
      e.preventDefault();
      if (a.do === "help") setOpen(o => !o);
      else if (a.do === "g") g.current = window.setTimeout(() => { g.current = null; }, 1200);
      else if (a.do === "go") void nav({ to: a.to });
      else if (a.do === "search") document.querySelector<HTMLElement>(SEARCH)?.focus();
      else if (list.length) {
        const i = a.do === "next" ? Math.min(list.length - 1, at + 1) : Math.max(0, at < 0 ? 0 : at - 1);
        list[i]!.focus(); list[i]!.scrollIntoView({ block: "nearest" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nav, path]);
  if (!open) return null;
  return <div role="dialog" aria-label="Keys" className="keys-panel c-card" data-container="card" data-keys-panel="">
    <p className="ed-kicker">Keys</p>
    <dl className="ed-small mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">{KEY_HELP.map(([k, w]) => <div key={k} className="contents"><dt><kbd>{k}</kbd></dt><dd>{w}</dd></div>)}</dl>
    <button type="button" className="ed-tap mt-3 underline" onClick={() => setOpen(false)} autoFocus>Close</button>
  </div>;
}
