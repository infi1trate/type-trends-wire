import { line as voiced } from "@/lib/voice";
import type { ArchiveRow } from "@/lib/digest/edition";
import { DIGEST_NAME } from "@/lib/site";
import { Ledger } from "@/components/brand/Ledger";
import { DigestShell, DigestFooter } from "./Editorial";

/** Every issue as a Ledger (README "The Ledger"): "No. N", the dates, the written headline. A week with no story has no issue. */
export function ArchiveView({ issues }: { issues: ArchiveRow[] }) {
  return <DigestShell label={`${DIGEST_NAME} archive`}>
    <header className="ed-wrap pt-8 md:pt-12">
      <p className="ed-kicker">{DIGEST_NAME}</p>
      <h1 className="ed-cover mt-2">Every issue</h1>
    </header>
    {issues.length ? <section aria-label="Every issue" className="ed-wrap d-air">
      <Ledger label="Every issue" rows={issues.map(i => ({ key: i.week, href: i.href, number: `No. ${i.number}`, title: i.headline, line: null, facts: [i.dates] }))} />
    </section> : <p className="ed-wrap ed-body mt-8">{voiced("digest.archiveView.1")}</p>}
    <DigestFooter footer={{ methodology: "/#m-the-digest", glossary: "/#g-stage", rss: "/digest/rss.xml", terminal: "/terminal", contact: null }} />
  </DigestShell>;
}
