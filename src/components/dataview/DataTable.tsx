// U1 · one dense table for Data views and the receipt drawer: scrolls inside its own container (never the page) with the first column
// kept in view; optional "Download CSV" (a data: link, so it works before hydration).
import type { ReactNode } from "react";
import { tableCsv } from "@/lib/views/receipts";

export type Cell = ReactNode;
export function DataTable({ caption, head, rows, csv, id }: { caption: string; head: string[]; rows: Cell[][]; csv?: { name: string; rows: string[][] } | undefined; id?: string | undefined }) {
  return <div className="min-w-0" id={id} data-data-table="">
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-3">
      <p className="label text-compare-muted">{caption.toUpperCase()}</p>
      {csv && <a className="label inline-flex min-h-11 items-center text-ink underline underline-offset-2 md:min-h-6" download={`${csv.name}.csv`} href={`data:text/csv;charset=utf-8,${encodeURIComponent(tableCsv({ head, rows: csv.rows }))}`} data-csv="">Download CSV</a>}
    </div>
    <div className="mt-2 max-w-full overflow-x-auto" tabIndex={0} role="region" aria-label={caption}>
      <table className="w-full min-w-[28rem] border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead className="label text-compare-muted"><tr>{head.map((h, i) => <th key={h + i} scope="col" className={`border-b border-rule p-2 font-semibold ${i === 0 ? "sticky left-0 z-[1] bg-void" : ""}`}>{h.toUpperCase()}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-rule align-top">{r.map((c, j) => j === 0 ? <th key={j} scope="row" className="sticky left-0 z-[1] bg-void p-2 text-left font-normal">{c}</th> : <td key={j} className="p-2 break-words">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  </div>;
}
