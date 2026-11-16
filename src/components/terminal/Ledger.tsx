import { line as voiced } from "@/lib/voice";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ledgerQuery } from "@/lib/data";
import { longDay } from "@/lib/ledger/ledger";
import { DimTag } from "./Info";
import { BasisChip } from "./SignalBits";

/** Console `ledger`: the live record in terminal density, newest calls first. */
export function LedgerOutput() {
  const { data, isError } = useQuery(ledgerQuery());
  if (isError) return <p role="alert" className="text-g500">{voiced("terminal.ledger.1")}</p>;
  if (!data) return <p role="status" role="status">{voiced("busy.terminal")} <span aria-hidden="true">▍</span></p>;
  const s = data.summary;
  return <div className="min-w-0 space-y-3">
    <p>{s.headline}</p>
    <p className="label text-g500">CALLS {s.total} · OPEN {s.open} · HIT {s.hits} · MISS {s.misses} · VOID {s.voids} (NOT COUNTED)</p>
    <p className="label break-words text-g500">BY DIMENSION · {s.byDimension.map(g => `${g.key} ${g.text}`).join(" · ")}</p>
    <ul className="divide-y divide-rule border-y border-rule">{data.calls.slice(0, 10).map(c => <li key={c.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2 py-2">
      <span className="label font-semibold">{c.outcome_word.toUpperCase()}</span>
      <span className="min-w-0 break-words"><span className="normal-case">{c.name}</span> <DimTag d={c.dimension} /> <BasisChip k={c.trait} /> <span className="label text-g500">· {c.scope_text} · {c.target_text}</span><br /><span className="text-g500">{c.said}{c.outcome_reason ? ` ${c.outcome_reason}` : c.resolves_on ? ` Resolves ${longDay(c.resolves_on)}.` : ""}</span></span>
    </li>)}</ul>
    {!data.calls.length && <p className="text-g500">{voiced("terminal.ledger.2")}</p>}
    <p className="label text-g500">BACKTEST (HISTORY REPLAY, NOT LIVE) · {data.backtest?.text ?? "none stored"}</p>
    <Link to="/ledger" className="label inline-flex min-h-11 items-center text-ink underline md:min-h-0">FULL LEDGER →</Link>
  </div>;
}
