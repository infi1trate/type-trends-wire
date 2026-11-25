// U4 · "Copy as CSV" for every table in a Data view or terminal panel: the table as shown (its header cells, then each row's cells as
// text), on the clipboard. It reads the table it sits beside in the page, so every table gets it without a second copy of its rows.
import { useRef, useState, type ReactNode } from "react";
import { tableCsv } from "@/lib/views/receipts";

const text = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim();
/** A table element's cells as a header row and body rows (pure over the DOM; tested). */
export function tableCells(t: HTMLTableElement): { head: string[]; rows: string[][] } {
  // Staff-only controls (the Pitch column) are not data: cells marked data-no-csv, or holding such a control, are left out.
  const keep = (c: Element) => !c.hasAttribute("data-no-csv") && !c.querySelector("[data-no-csv]");
  const headRow = t.tHead?.rows[0] ?? null;
  const head = headRow ? [...headRow.cells].filter(keep).map(text) : [];
  const rows = [...t.tBodies].flatMap(b => [...b.rows]).map(r => [...r.cells].filter(keep).map(text));
  return { head, rows };
}
export function CopyCsv({ getTable, className = "" }: { getTable: () => HTMLTableElement | null; className?: string }) {
  const [done, setDone] = useState<null | "ok" | "fail">(null);
  const copy = async () => {
    const t = getTable(); if (!t) return;
    try { await navigator.clipboard.writeText(tableCsv(tableCells(t))); setDone("ok"); } catch { setDone("fail"); }
    window.setTimeout(() => setDone(null), 1200);
  };
  return <button type="button" onClick={() => void copy()} className={`label inline-flex min-h-11 cursor-pointer items-center text-ink underline underline-offset-2 md:min-h-6 ${className}`} data-csv-copy="">
    {done === "ok" ? "Copied" : done === "fail" ? "Could not copy" : "Copy as CSV"}<span className="sr-only" aria-live="polite">{done === "ok" ? " The table is on the clipboard." : ""}</span>
  </button>;
}
/** Wraps one table with its "Copy as CSV" button above it (terminal panels). */
export function CsvScope({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return <div ref={ref} className="min-w-0" data-csv-scope="">
    <div className="flex justify-end px-3 pt-1"><CopyCsv getTable={() => ref.current?.querySelector("table:not(.sr-only)") ?? null} /></div>
    {children}
  </div>;
}
