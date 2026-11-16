import type { ArchiveEntry } from "@/lib/digest/issue";
import { DIGEST_NAME } from "@/lib/site";
import { Ledger } from "@/components/brand/Ledger";
import { DigestShell, DigestFooter } from "./Editorial";

/** Every issue as a Ledger (README "The Ledger"): number, title, the lead signal as the line, the dates as the fact. */
export function ArchiveView({ issues }: { issues: ArchiveEntry[] }) {
  return <DigestShell label={`${DIGEST_NAME} archive`}>
    <header className="ed-wrap pt-8 md:pt-12">
      <p className="ed-kicker">{DIGEST_NAME}</p>
      <h1 className="ed-cover mt-2">Every issue</h1>
    </header>
    {issues.length ? <section aria-label="Every issue" className="ed-wrap d-air">
      <Ledger label="Every issue" rows={issues.map(i => ({ key: i.week, href: `/digest/${i.week}`, number: i.number, title: i.headline,
        line: i.lead ? `Lead signal: ${i.lead.name} [${i.lead.dimension}]` : null, facts: [i.dates] }))} />
    </section> : <p className="ed-wrap ed-body mt-8">No issues yet. The first issue is assembled after the Sunday forecast and brief are stored.</p>}
    <DigestFooter footer={{ methodology: "/#m-the-digest", glossary: "/#g-stage", rss: "/digest/rss.xml", terminal: "/terminal", contact: null }} />
  </DigestShell>;
}
