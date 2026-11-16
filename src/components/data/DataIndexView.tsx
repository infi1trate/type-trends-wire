// /data: the numbered list of data stories — question, deck, template and last data date; drafts show why they are not live yet.
import { Link } from "@tanstack/react-router";
import type { IndexRow } from "@/lib/data-stories/build";
import { dayText } from "@/lib/data-stories/text";
import { DigestShell } from "@/components/digest/Editorial";
import { ReadFooter } from "@/components/read/Bits";
import { Receipt } from "@/components/read/StoryCard";

export function DataIndexView({ rows }: { rows: IndexRow[] }) {
  return <DigestShell label="Data stories" section="signals">
    <header className="ed-wrap pt-8 md:pt-12">
      <p className="ed-kicker">Signals · Data stories</p>
      <h1 className="ed-h1 mt-3">Questions the data can answer</h1>
      <p className="ed-standfirst mt-4 max-w-[60ch]">Each one is a question a brand or marketing lead would ask, answered by a picture you step through, built from stored captures. Every number links to its receipt.</p>
    </header>
    <ol className="ed-wrap mt-10" data-index="">{rows.map(r => <li key={r.slug} className="ed-hair grid gap-x-6 gap-y-1 py-5 md:grid-cols-[12ch_1fr_auto]" data-status={r.status}>
      <span className="ed-kicker">Data story {r.number}</span>
      <div className="min-w-0">
        <h2 className="ed-h3">{r.href ? <Receipt href={r.href} className="no-underline hover:underline">{r.question}</Receipt> : r.question}</h2>
        <p className="ed-small mt-1 max-w-[62ch]">{r.deck}</p>
        {r.status === "draft" && <p className="ed-small ed-muted mt-2 max-w-[62ch]"><span className="ed-badge mr-2">Draft</span>{r.reason}</p>}
      </div>
      <p className="ed-data ed-muted md:text-right">{r.template}{r.dataThrough && <><br />Data through {dayText(r.dataThrough)}</>}</p>
    </li>)}</ol>
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
