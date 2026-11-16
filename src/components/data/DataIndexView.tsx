// /data: the numbered list of data stories — question, deck, template and last data date; drafts show why they are not live yet.
import { Link } from "@tanstack/react-router";
import type { IndexRow } from "@/lib/data-stories/build";
import { dayText } from "@/lib/data-stories/text";
import { DigestShell } from "@/components/digest/Editorial";
import { ReadFooter } from "@/components/read/Bits";
import { Ledger } from "@/components/brand/Ledger";

export function DataIndexView({ rows }: { rows: IndexRow[] }) {
  return <DigestShell label="Data stories" section="signals">
    <header className="ed-wrap pt-8 md:pt-12">
      <p className="ed-kicker">Signals · Data stories</p>
      <h1 className="ed-h1 mt-3">Questions the data can answer</h1>
      <p className="ed-standfirst mt-4 max-w-[60ch]">Each one is a question a brand or marketing lead would ask, answered by a picture you step through, built from stored captures. Every number links to its receipt.</p>
    </header>
    {/* The index is a ledger: numbered, ruled rows; the question in the serif, facts in Big Shoulders, the template and status as tags. */}
    <div className="ed-wrap mt-10" data-index=""><Ledger label="Data stories" rows={rows.map(r => ({ key: r.slug, href: r.href ?? `/data/${r.slug}`, number: r.number,
      title: r.question, line: r.status === "draft" ? `Draft: ${r.reason}` : r.deck, tags: [r.template, ...(r.status === "draft" ? ["Draft"] : [])],
      ...(r.dataThrough ? { facts: [`Data through ${dayText(r.dataThrough)}`] } : {}) }))} /></div>
    <ReadFooter terminal="/terminal?panel=history" />
  </DigestShell>;
}
export function DraftView({ d }: { d: { number: number; question: string; deck: string; template: string; reason: string | null } }) {
  return <DigestShell label="Data stories" section="signals">
    <header className="ed-wrap pt-8 md:pt-12">
      <p className="ed-kicker flex gap-3"><Link to="/data" className="ed-tap no-underline">Data story {d.number}</Link><span>{d.template}</span><span className="ed-badge">Draft</span></p>
      <h1 className="ed-h1 mt-3 max-w-[22ch]">{d.question}</h1>
      <p className="ed-standfirst mt-4 max-w-[60ch]">{d.deck}</p>
      <p className="ed-body mt-6 max-w-[60ch]"><strong>Not live yet.</strong> {d.reason}</p>
      <p className="ed-data mt-6"><Link to="/data" className="ed-tap">← All data stories</Link></p>
    </header>
    <ReadFooter terminal="/terminal?panel=history" />
  </DigestShell>;
}
