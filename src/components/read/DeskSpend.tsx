// T1 · /desk's Spend table (staff only): eight Eastern-time weeks, current week first — the site's own model calls, build credits in
// dollars at the stated price, agent sessions recorded by hand, the total against the owner's cap, and three unit costs, each with its
// count and base. Below 1280 px each week becomes a stacked block, so no width scrolls sideways.
import { CREDIT_PRICE_READ, CREDIT_USD, usd, type LedgerWeek } from "@/lib/newsroom/ledger";

const td = "px-3 py-2 align-top", th = "ed-kicker px-3 py-2 text-left align-bottom";
const HEAD = ["Week", "Model calls", "Model", "Build", "Agent sessions", "Total", "Against the cap", "Per published story", "Per capture read", "Per shipped change"] as const;
const n = (x: number) => x.toLocaleString("en-US");

function Unit({ u }: { u: LedgerWeek["per_story"] }) {
  if (u.value == null) return <>{u.line}</>;
  const [head, ...rest] = u.line.split(" (");
  return <>{head}<span className="ed-caption block">{rest.length ? `(${rest.join(" (")}` : ""}</span></>;
}
function Kinds({ w, title }: { w: LedgerWeek; title: string }) {
  return <div className="mt-4">
    <h4 className="ed-kicker">{title} · week of {w.label}</h4>
    {w.model.by_kind.length ? <ul className="ed-data mt-2 space-y-1">{w.model.by_kind.map(k => <li key={`${k.kind}:${k.model}`} className="break-words">
      <span className="font-semibold">{k.kind}</span> · {k.model}: {n(k.calls)} calls{k.failed ? `, ${n(k.failed)} failed` : ""}, {n(k.tokens_in)} tokens in, {n(k.tokens_out)} out, {usd(k.usd)}
    </li>)}</ul> : <p className="ed-small mt-2">No model calls.</p>}
  </div>;
}

export function DeskSpend({ weeks }: { weeks: LedgerWeek[] | null }) {
  return <section aria-labelledby="desk-spend" className="mt-6" data-desk-spend="">
    <h3 id="desk-spend" className="ed-h3">Spend</h3>
    <p className="ed-small mt-2">Eastern-time weeks, Monday to Sunday, current week first. Build credits at {usd(CREDIT_USD)} a credit (price read {CREDIT_PRICE_READ}). Agent sessions are recorded by hand through the door; the product cannot measure them. Shipped changes are queue items moved to live in the week, or already live and passing a gate in the week.</p>
    {weeks ? <>
      <table className="ed-data ruled-table spend-table mt-4 w-full border-collapse">
        <caption className="sr-only">Spend per Eastern-time week, current week first, with three unit costs</caption>
        <thead><tr className="ed-hair">{HEAD.map(h => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
        <tbody>{weeks.map(w => <tr key={w.start} className="ed-hair" data-current={w.current ? "" : undefined}>
          <th scope="row" className={`${td} text-left font-semibold`} data-label="Week">{w.label}{w.current ? <span className="ed-caption block">this week</span> : null}</th>
          <td className={`${td} num`} data-label="Model calls">{n(w.model.calls)}<span className="ed-caption block">{n(w.model.failed)} failed</span></td>
          <td className={`${td} num`} data-label="Model">{usd(w.model.usd)}</td>
          <td className={`${td} num`} data-label="Build">{n(w.build.credits)} credits<span className="ed-caption block">{usd(w.build.usd)}</span></td>
          <td className={td} data-label="Agent sessions">{w.agent.line}</td>
          <td className={`${td} num font-semibold`} data-label="Total">{usd(w.total_usd)}</td>
          <td className={td} data-label="Against the cap">{w.cap.line}</td>
          <td className={td} data-label="Per published story"><Unit u={w.per_story} /></td>
          <td className={td} data-label="Per capture read"><Unit u={w.per_capture} /></td>
          <td className={td} data-label="Per shipped change"><Unit u={w.per_change} /></td>
        </tr>)}</tbody>
      </table>
      {weeks[0] ? <Kinds w={weeks[0]} title="Model calls by kind, this week" /> : null}
      {weeks[1] ? <Kinds w={weeks[1]} title="Model calls by kind, last week" /> : null}
    </> : <p className="ed-small mt-3">The spend ledger could not be read.</p>}
  </section>;
}
