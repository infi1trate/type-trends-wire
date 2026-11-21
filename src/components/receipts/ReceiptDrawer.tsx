// U2 · THE RECEIPT DRAWER — opens over a Read page when the address carries `?receipt=<type>:<id>`: from the right at 1024 px and wider
// (max 560 px), a bottom sheet below (max 85% of the height). The record behind the number in the Data look (dark, dense, mono labels),
// then "Open the full Data view →". Back, Esc and the close button close it; focus is trapped while open and returns to the link that
// opened it. Content loads when it opens (skeleton rows meanwhile); drawn only after hydration, never before the page's first byte.
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useHydrated, useRouterState } from "@tanstack/react-router";
import { receiptQuery } from "@/lib/data";
import { parseReceipt, receiptParam, type ReceiptModel } from "@/lib/views/receipts";
import { isDataView } from "@/lib/ia";
import { AppLink } from "@/components/terminal/AppLink";
import { DataTable } from "@/components/dataview/DataTable";
import { takeOpener, useReceiptNav } from "./open";
import { Bars } from "@/components/chartkit";
import { PitchButton } from "@/components/pitch/Pitch";
import { readablePath } from "@/lib/path-text";

export function ReceiptDrawer() {
  const hydrated = useHydrated();
  const loc = useRouterState({ select: s => ({ path: readablePath(s.location.pathname), search: s.location.search as Record<string, unknown> }) });
  const r = parseReceipt(loc.search["receipt"]);
  if (!hydrated || !r || isDataView(loc.path, loc.search)) return null;
  return <Drawer r={receiptParam(r)} />;
}

const FOCUSABLE = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"]),input,select,textarea';
function Drawer({ r }: { r: string }) {
  const { data, isLoading, isError } = useQuery(receiptQuery(r));
  const nav = useReceiptNav(), panel = useRef<HTMLDivElement>(null), closeBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    closeBtn.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); nav.close(); return; }
      if (e.key !== "Tab" || !panel.current) return;
      const f = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(x => x.offsetParent !== null || x === document.activeElement);
      if (!f.length) return;
      const first = f[0]!, last = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("keydown", key, true); document.body.style.overflow = prev;
      const o = takeOpener() ?? back;
      (o && o.isConnected ? o : document.querySelector<HTMLElement>("main"))?.focus({ preventScroll: true });
    };
  }, [nav]);
  return <div data-mode="dark" data-density="loud" className="fixed inset-0 z-50" data-receipt-drawer={r}>
    <button type="button" aria-label="Close the receipt" tabIndex={-1} className="absolute inset-0 h-full w-full cursor-default bg-void/60" onClick={nav.close} />
    <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="receipt-title"
      className="receipt-panel font-sans absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col border-t border-rule bg-void text-ink lg:inset-y-0 lg:left-auto lg:right-0 lg:max-h-none lg:w-full lg:max-w-[560px] lg:border-l lg:border-t-0">
      <div className="flex items-start justify-between gap-3 border-b border-rule bg-g900 p-3">
        <div className="min-w-0">
          <p className="label text-g500">RECEIPT{data ? <> · {data.kicker}</> : null}</p>
          <h2 id="receipt-title" className="mt-1 break-words font-semibold">{data?.title ?? (isLoading ? "Loading the receipt…" : "Receipt")}</h2>
        </div>
        <button ref={closeBtn} type="button" onClick={nav.close} className="label inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center border border-rule px-2 text-ink hover:bg-g800">CLOSE ✕</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-receipt-body="">
        {isLoading ? <Skeleton /> : isError || !data ? <p className="p-3 text-compare-muted">This receipt did not load. The full record is one step away.</p> : <Body m={data} />}
      </div>
      {data && <div className="flex flex-wrap items-start justify-between gap-x-4 border-t border-rule p-3"><PitchButton target={{ kind: "receipt", ref: r, facts: [data.title, ...data.lines].slice(0, 20) }} /><AppLink href={data.full} className="label inline-flex min-h-[44px] items-center text-ink underline underline-offset-2" data-receipt-full="">Open the full Data view →</AppLink></div>}
    </div>
  </div>;
}
function Skeleton() {
  return <div aria-busy="true" aria-label="Loading" className="space-y-2 p-3">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-6 animate-pulse bg-g900 motion-reduce:animate-none" />)}</div>;
}
function Body({ m }: { m: ReceiptModel }) {
  return <>
    <div className="space-y-1 p-3">{m.lines.map(l => <p key={l} className="text-body">{l}</p>)}</div>
    {m.chart && <Bars look="data" label={m.chart.label} points={m.chart.points} />}
    {m.tables.map(t => <DataTable key={t.caption} caption={t.caption} head={t.head} rows={t.rows} />)}
  </>;
}

