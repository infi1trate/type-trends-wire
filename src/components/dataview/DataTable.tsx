// U1 · one dense table for Data views and the receipt drawer: scrolls inside its own container (never the page) with the first column
// kept in view; "Copy as CSV" (U4) on every table and optional "Download CSV" (a data: link, so it works before hydration).
import { useRef, type ReactNode } from "react";
import { CopyCsv } from "./CopyCsv";
import { PitchButton, type PitchTarget } from "@/components/pitch/Pitch";
import { useStaffKey } from "@/lib/staff-key";
import { tableCsv } from "@/lib/views/receipts";

export type Cell = ReactNode;
/** The row's facts as shown: each text cell with its column name (what a pitch carries to the desk). */
export const rowFacts = (head: readonly string[], row: readonly Cell[]) => row.flatMap((c, j) => (typeof c === "string" || typeof c === "number") && String(c) !== "–" ? [`${head[j] ?? ""}: ${String(c)}`] : []);
/** `tools`: extra links beside the exports (a study figure's "Open in console"). `pitch`: what row `i` is about, for the staff-only
 *  Pitch column (absent for visitors: the key is read only after hydration). */
export function DataTable({ caption, head: shownHead, rows: shownRows, csv, id, tools, pitch }: { caption: string; head: string[]; rows: Cell[][]; csv?: { name: string; rows: string[][] } | undefined; id?: string | undefined; tools?: ReactNode; pitch?: ((i: number) => Omit<PitchTarget, "facts"> | null) | undefined }) {
  const ref = useRef<HTMLDivElement>(null), staff = useStaffKey() != null && !!pitch;
  const head = shownHead;
  const rows = staff ? shownRows.map((r, i) => { const t = pitch!(i); return [...r, t ? <PitchButton key="pitch" target={{ ...t, facts: rowFacts(shownHead, r) }} /> : "–"]; }) : shownRows;
  const allHead = staff ? [...head, "Pitch"] : head;
  return <div ref={ref} className="min-w-0" id={id} data-data-table="">
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-3">
      <p className="label text-compare-muted">{caption.toUpperCase()}</p>
      <span className="flex flex-wrap items-center gap-x-4">{tools}<CopyCsv getTable={() => ref.current?.querySelector("table") ?? null} />
      {csv && <a className="label inline-flex min-h-11 items-center text-ink underline underline-offset-2 md:min-h-6" download={`${csv.name}.csv`} href={`data:text/csv;charset=utf-8,${encodeURIComponent(tableCsv({ head, rows: csv.rows }))}`} data-csv="">Download CSV</a>}</span>
    </div>
    <div className="mt-2 max-w-full overflow-x-auto" tabIndex={0} role="region" aria-label={caption}>
      <table className="w-full min-w-[28rem] border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead className="label text-compare-muted"><tr>{allHead.map((h, i) => <th key={h + i} scope="col" {...(staff && i === allHead.length - 1 ? { "data-no-csv": "" } : {})} className={`border-b border-rule p-2 font-semibold ${i === 0 ? "sticky left-0 z-[1] bg-void" : ""}`}>{h.toUpperCase()}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-rule align-top">{r.map((c, j) => j === 0 ? <th key={j} scope="row" className="sticky left-0 z-[1] bg-void p-2 text-left font-normal">{c}</th> : <td key={j} className="p-2 break-words">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  </div>;
}
