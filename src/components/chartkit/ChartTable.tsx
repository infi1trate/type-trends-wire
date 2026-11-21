// THE CHART KIT (U3) · the table every chart ships for screen readers: visually hidden, the first column as row headers.
export type TableCell = string | number;
export function ChartTable({ caption, columns, rows }: { caption: string; columns: string[]; rows: TableCell[][] }) {
  return <div className="sr-only"><table data-chart-table="">
    <caption>{caption}</caption>
    <thead><tr>{columns.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}</tr>)}</tbody>
  </table></div>;
}
