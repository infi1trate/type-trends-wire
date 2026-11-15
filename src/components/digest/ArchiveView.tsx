import { Link } from "@tanstack/react-router";
import type { ArchiveEntry } from "@/lib/digest/issue";
import { figureSvg } from "@/lib/chart/card";
import { DIGEST_NAME } from "@/lib/site";
import { DigestShell, DigestFooter, pr } from "./Editorial";

export function ArchiveView({ issues }: { issues: ArchiveEntry[] }) {
  return <DigestShell label={`${DIGEST_NAME} archive`}>
    <header className="ed-wrap border-b-2 border-ed-ink pb-6 pt-10">
      <p className="ed-kicker">{DIGEST_NAME}</p>
      <h1 className="ed-cover mt-2">Every issue</h1>
    </header>
    {issues.length ? <ol className="ed-wrap mt-8 grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-3">{issues.map(i => <li key={i.week} className="ed-hair pt-4">
      <Link to="/digest/$week" params={{ week: i.week }} className="block no-underline" {...pr(`/digest/${i.week}`)}>
        {i.card && i.card.series.length > 0 ? <div className="ed-figure border border-ed-rule" dangerouslySetInnerHTML={{ __html: figureSvg(i.card, 640, 360, `${i.lead?.name ?? "Lead signal"} share by quarter`) }} />
          : <div className="ed-typo"><span className="ed-kicker ed-muted">No. {i.number}</span><span className="ed-h3">{i.lead?.name ?? i.headline}</span><span className="ed-caption">{i.dates}</span></div>}
        <p className="ed-data mt-3">No. {i.number} · {i.dates}</p>
        <h2 className="ed-h3 mt-1 hover:underline">{i.headline}</h2>
        {i.lead && <p className="ed-caption mt-1">Lead signal: {i.lead.name} [{i.lead.dimension}]</p>}
      </Link>
    </li>)}</ol> : <p className="ed-wrap ed-body mt-8">No issues yet. The first issue is assembled after the Sunday forecast and brief are stored.</p>}
    <DigestFooter footer={{ methodology: "/#m-the-digest", glossary: "/#g-stage", rss: "/digest/rss.xml", terminal: "/", contact: null }} />
  </DigestShell>;
}
