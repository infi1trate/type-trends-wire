// Y2 · the "Why now" block: Known (dated, linked facts), Likely (hedged, with superscript marks to what it rests on), Our read (signed
// opinion on the raised paper panel). Read from stored passed blocks only; nothing renders when there is none. In the Data view it is a
// three-row table (Known / Likely / Our read) with dates and sources as columns.
import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { BRAND_NAME } from "@/lib/brand";
import { whyNowQuery } from "@/lib/data";
import type { WhyNow as Block } from "@/lib/evidence/whynow";

const monthDay = (d: string) => d.length === 7 ? d : d.slice(0, 10);
export function WhyNowView({ b }: { b: Block }) {
  const mark = (id: string) => { const i = b.known.findIndex(k => k.entry === id); return i >= 0 ? String(i + 1) : null; };
  return <section className="mt-10" aria-labelledby="why-now" data-why-now="">
    <h2 id="why-now" className="ed-h3 ed-rule pt-3">Why now</h2>
    <div className="mt-4 grid gap-6">
      <div><p className="ed-kicker">Known</p>
        <ol className="mt-2 grid gap-2">{b.known.map((k, i) => <li key={k.entry} className="ed-body max-w-[68ch]"><sup className="ed-data">{i + 1}</sup> {k.sentence} <span className="ed-data ed-muted whitespace-nowrap">{monthDay(k.date)} · <a href={k.link} className="ed-tap" rel="noopener">{k.source}</a></span></li>)}</ol></div>
      {b.likely.length > 0 && <div><p className="ed-kicker">Likely</p>
        <ul className="mt-2 grid gap-2">{b.likely.map((l, i) => <li key={i} className="ed-body max-w-[68ch]">{l.sentence}{l.refs.map(r => r.kind === "entry" ? mark(r.id) : null).filter(Boolean).map(m => <sup key={m} className="ed-data">{m}</sup>)}{l.refs.some(r => r.kind === "figure") && <sup className="ed-data">m</sup>}</li>)}</ul></div>}
      {b.read.length > 0 && <aside className="c-raised p-4 max-w-[68ch]" aria-label={`Our read, ${BRAND_NAME}'s view`}><p className="ed-kicker">Our read</p>{b.read.map((r, i) => <p key={i} className="ed-body mt-2">{r}</p>)}<p className="ed-caption mt-2">{BRAND_NAME}'s view.</p></aside>}
    </div>
  </section>;
}
export function WhyNowTable({ b }: { b: Block }) {
  return <table className="tk-table mt-4 w-full" data-why-now-table="">
    <caption className="tk-t-label text-left">Why now</caption>
    <thead><tr><th scope="col">Part</th><th scope="col">Text</th><th scope="col">Dates</th><th scope="col">Sources</th></tr></thead>
    <tbody>
      <tr><th scope="row">Known</th><td>{b.known.map(k => k.sentence).join(" ")}</td><td className="tabular-nums">{b.known.map(k => monthDay(k.date)).join(", ")}</td><td>{b.known.map((k, i) => <a key={i} href={k.link} className="tk-link mr-2" rel="noopener">{k.source}</a>)}</td></tr>
      {b.likely.length > 0 && <tr><th scope="row">Likely</th><td>{b.likely.map(l => l.sentence).join(" ")}</td><td>—</td><td>{b.likely.flatMap(l => l.refs.map(r => r.id)).join(", ")}</td></tr>}
      {b.read.length > 0 && <tr><th scope="row">Our read</th><td>{b.read.join(" ")}</td><td>—</td><td>{BRAND_NAME}</td></tr>}
    </tbody>
  </table>;
}
/** The stored block for a subject, or nothing. */
export function WhyNow(p: { kind: "signal" | "study" | "story"; id: string; data?: boolean }) {
  return <Suspense fallback={null}><WhyNowRead {...p} /></Suspense>;
}
function WhyNowRead({ kind, id, data = false }: { kind: "signal" | "study" | "story"; id: string; data?: boolean }) {
  const { data: w } = useSuspenseQuery(whyNowQuery(kind, id));
  return w ? (data ? <WhyNowTable b={w.block} /> : <WhyNowView b={w.block} />) : null;
}
