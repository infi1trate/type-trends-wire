import { Link } from "@tanstack/react-router";
import { numberLabel } from "@/lib/stories/numbers";
import type { Issue } from "@/lib/digest/issue";
import { pct } from "@/lib/digest/copy";
import { BasisWord, DigestShell, DigestFooter, Dim, Figure, SectionHead, SiteCard, StageWord, Swatches, pr } from "./Editorial";
import { EditionCover } from "@/components/read/Covers";
import { FiltersScope } from "@/components/brand/Illustration";
import { Ledger, StoryNo } from "@/components/brand/Ledger";
import { RuleBox } from "@/components/brand/Containers";
import { isNewIssue } from "@/lib/digest/week";

const SECTION_TITLE: Record<string, string> = { stories: "The week in stories", movers: "The Movers", specimens: "Specimens", palette: "Palette", wild: "Seen in the wild", rebrands: "Rebrands of the week", numbers: "The Numbers" };
const SECTION_WORD = (n: number) => `${n + 1} ${n + 1 === 1 ? "section" : "sections"}`;

const two = (n: number) => String(n).padStart(2, "0");
export function IssueView({ issue }: { issue: Issue }) {
  const c = issue.cover, sec = issue.sections.filter(s => s !== "cover");
  const n = (id: string) => two(sec.indexOf(id) + 1);
  return <DigestShell label={`${issue.name} No. ${issue.number}`}>
    <FiltersScope>
    <article aria-labelledby="ed-cover-title">
      <EditionCover seed={issue.number} object={String(issue.number)} objectLabel={`Issue ${issue.number}, drawn as a soft object`} titleId="ed-cover-title" isNew={isNewIssue(issue.week, Date.now())}
        kicker={<>{issue.name} · {c.kicker}</>} title={c.headline}
        left={<><span className="cover-num block">No. {issue.number}</span><span className="block">{issue.dates.label}</span></>}
        right={<>{issue.dataThrough && <span className="block">Data through {issue.dataThrough}</span>}<span className="block">{SECTION_WORD(sec.length)}</span></>}
        deck={<>
          {c.standfirst && <p className="ed-standfirst">{c.standfirst}</p>}
          {c.lead && <p className="ed-data mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="font-semibold">{c.lead.name}</span><Dim d={c.lead.dimension} /><BasisWord b={c.lead.basis} /><StageWord stage={c.lead.stage} />
            {c.lead.share != null && <span>{pct(c.lead.share, 1)} of homepages</span>}
            <span className="ed-muted">{c.lead.scopeText}</span>
            <Link to="/signals/$key" params={{ key: c.lead.key }} className="ed-tap" {...pr(c.lead.href)}>Explainer →</Link>
          </p>}
        </>} />

      {/* The contents: a ledger of the issue's sections. */}
      <nav aria-labelledby="ed-contents" className="ed-wrap d-air d-quiet">
        <h2 id="ed-contents" className="d-quiet-label ed-kicker">In this issue</h2>
        <Ledger rows={[{ key: "cover", href: "#ed-cover-story", plain: true, number: "00", title: "Cover story", line: c.lead?.name ?? null },
          ...sec.map(id => ({ key: id, href: `#ed-${id}`, plain: true, number: n(id), title: SECTION_TITLE[id] ?? id }))]} label="In this issue" />
      </nav>

      <section id="ed-cover-story" aria-label="Cover story" className="ed-wrap d-air ed-grid">
        {c.why && <aside aria-label="Why it matters" className="lg:col-span-4">
          <p className="ed-kicker mb-2">Why it matters</p>
          <p className="ed-pull">{c.why}</p>
        </aside>}
        {c.card && c.card.series.length > 0 && c.lead && <div className={c.why ? "lg:col-span-8" : "lg:col-span-12"}>
          <Figure card={c.card} label={`${c.lead.name}: share of tracked homepages by quarter, with the forecast band`}
            caption={<>{c.lead.name} [{c.lead.dimension}] · share of tracked homepages by quarter, solid line measured, band forecast. {c.call ? `${c.call} ` : ""}Source: forecast run {c.card.forecast_run ?? c.card.run_id}, data through {issue.dataThrough ?? "—"}. <Link to="/chart/$week" params={{ week: issue.week }} {...pr(`/chart/${issue.week}`)}>Chart card →</Link></>} />
        </div>}
        {c.body.length > 0 && <div className="ed-body lg:col-span-8 lg:col-start-3">
          {c.body.map(s => <section key={s.title} className="mt-8 first:mt-2" aria-label={s.title}>
            <h2 className="ed-h3">{s.title}</h2>
            {s.body && <p className="mt-2">{s.body}</p>}
            {s.citations.length > 0 && <p className="ed-caption mt-2">Receipts: {s.citations.map((x, i) => <span key={x.text + i}>{i ? " · " : ""}{x.href ? (x.href.startsWith("http") ? <a href={x.href} target="_blank" rel="noopener" {...pr(x.href)}>{x.text}</a> : <a href={x.href} {...pr(x.href)}>{x.text}</a>) : x.text}</span>)}</p>}
          </section>)}
          {c.caveats && <p className="ed-caption mt-6">Caveats: {c.caveats}</p>}
        </div>}
      </section>

      {issue.stories && <section id="ed-stories" aria-labelledby="ed-stories-h" className="ed-wrap d-air">
        <SectionHead n={n("stories")} id="ed-stories-h" title="The week in stories" kicker="The week's top published stories by score, each with its receipts." />
        <Ledger label="The week in stories" rows={issue.stories.map((x, i) => ({ key: x.id, href: x.href, number: x.number != null ? <StoryNo n={x.number} /> : i + 1, title: x.headline, line: x.deck ?? null, tags: [x.kicker.split(" · ")[0] ?? x.kicker], facts: [`Score ${x.score}`] }))} />
      </section>}

      {issue.movers && <section id="ed-movers" aria-labelledby="ed-movers-h" className="ed-wrap d-air"><RuleBox>
        <SectionHead n={n("movers")} id="ed-movers-h" title="The Movers" kicker="Signals that broke out or changed stage since the previous forecast run." />
        <ol className="grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
          {issue.movers.map(m => <li key={`${m.key}|${m.scope}`} className="ed-hair pt-4">
            <p className="ed-data flex flex-wrap items-center gap-2"><Dim d={m.dimension} /><BasisWord b={m.basis} />{m.breakout && <span className="ed-badge">Breakout</span>}<StageWord stage={m.to} /></p>
            <h3 className="ed-h3 mt-2"><Link to="/signals/$key" params={{ key: m.key }} className="no-underline hover:underline" {...pr(m.href)}>{m.name}</Link></h3>
            <p className="mt-2">{m.name} {m.change}. {m.sentence}</p>
            {m.soWhat && <p className="ed-caption mt-1">{m.soWhat}</p>}
            <p className="ed-data mt-2"><Link to="/signals/$key" params={{ key: m.key }} className="ed-tap">Explainer →</Link></p>
          </li>)}
        </ol>
      </RuleBox></section>}

      {issue.specimens && <section id="ed-specimens" aria-labelledby="ed-specimens-h" className="ed-wrap d-air"><RuleBox>
        <SectionHead n={n("specimens")} id="ed-specimens-h" title="Specimens" kicker={issue.specimens.since && issue.specimens.date ? `Google Fonts popularity, ${issue.specimens.since} to ${issue.specimens.date}, plus faces sites switched to this week. Google Fonts are set in their own face; anything else is shown by name.` : "Faces sites switched to this week. Google Fonts are set in their own face; anything else is shown by name."} />
        <div className="space-y-10">
          {([["Rising", issue.specimens.rising], ["Fading", issue.specimens.fading], ["Seen this week", issue.specimens.seen]] as const).filter(([, l]) => l.length).map(([title, list]) => <div key={title}>
            <h3 className="ed-kicker mb-3">{title}</h3>
            <ul className="space-y-8">{list.map(s => <li key={s.family} className="ed-hair grid grid-cols-1 gap-2 pt-4 lg:grid-cols-12">
              <p className="ed-specimen lg:col-span-8" style={s.google ? { fontFamily: `"${s.family}", var(--tk-font-text)` } : undefined} lang="en">{s.google ? s.family : <span className="italic">{s.family}</span>}</p>
              <div className="lg:col-span-4">
                <p className="ed-data">{s.family} · {s.role}</p>
                <p className="ed-small mt-1">{s.line}</p>
                {s.note && <p className="ed-caption mt-1">{s.note}</p>}
                {s.href && (s.href.startsWith("http") ? <a href={s.href} target="_blank" rel="noopener" className="ed-data ed-tap" {...pr(s.href)}>Specimen ↗</a> : <a href={s.href} className="ed-data ed-tap" {...pr(s.href)}>Terminal page →</a>)}
              </div>
            </li>)}</ul>
          </div>)}
        </div>
      </RuleBox></section>}

      {issue.palette && <section id="ed-palette" aria-labelledby="ed-palette-h" className="ed-wrap d-air"><RuleBox>
        <SectionHead n={n("palette")} id="ed-palette-h" title="Palette" kicker="Accent and palette changes confirmed on two captures this week. Names are readable approximations; hexes are measured." />
        <ul className="grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3">{issue.palette.map(p => <li key={p.domain + p.at} className="ed-hair pt-4">
          <p className="ed-data"><a href={p.href} {...pr(p.href)}>{p.domain}</a> <span className="ed-muted">· {p.sector ?? "—"} · {p.kind === "accent" ? "accent" : "palette"}</span></p>
          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-start gap-3">
            <Swatches colors={p.before} label={`${p.domain} before`} />
            <span className="ed-data pt-4" aria-hidden="true">→</span>
            <Swatches colors={p.after} label={`${p.domain} after`} />
          </div>
          <p className="ed-small mt-2">{p.kind === "accent" ? `${p.before[0]!.name} gave way to ${p.after[0]!.name.toLowerCase()}.` : `The palette moved from ${p.before[0]!.name.toLowerCase()} to ${p.after[0]!.name.toLowerCase()}.`}</p>
        </li>)}</ul>
      </RuleBox></section>}

      {issue.wild && <section id="ed-wild" aria-labelledby="ed-wild-h" className="ed-wrap d-air"><RuleBox>
        <SectionHead n={n("wild")} id="ed-wild-h" title="Seen in the wild" kicker="Library sites that led this week's signals. Thumbnails are small homepage crops, credited and linked; sites without one are set as type." />
        <div className="grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-4">{issue.wild.map(w => <SiteCard key={w.domain} domain={w.domain} name={w.name} sector={w.sector} thumb={w.thumb} lines={[...w.traits, ...(w.adopted ? [`since ${w.adopted}`] : [])]} />)}</div>
      </RuleBox></section>}

      {issue.rebrands && <section id="ed-rebrands" aria-labelledby="ed-rebrands-h" className="ed-wrap d-air"><RuleBox>
        <SectionHead n={n("rebrands")} id="ed-rebrands-h" title="Rebrands of the week" kicker="Identity changes confirmed on two captures." />
        <ul className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-2">{issue.rebrands.map(r => <li key={r.domain + r.confirmed_at} className="ed-hair pt-4">
          <h3 className="ed-h3"><a href={r.href} className="no-underline hover:underline" {...pr(r.href)}>{r.name ?? r.domain}</a></h3>
          <p className="ed-data ed-muted">{r.name ? `${r.domain} · ` : ""}{r.sector} · {r.reasons.join(", ")}</p>
          <p className="mt-2">{r.read}</p>
        </li>)}</ul>
      </RuleBox></section>}

      <section id="ed-numbers" aria-labelledby="ed-numbers-h" className="ed-wrap d-air"><RuleBox>
        <SectionHead n={n("numbers")} id="ed-numbers-h" title="The Numbers" />
        <dl className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-5">{issue.numbers.map(x => <div key={x.label} className="ed-hair pt-3">
          <dt className="ed-kicker">{x.label}</dt>
          <dd className="ed-data ed-stat mt-1">{x.value}</dd>
          <dd className="ed-caption mt-1">{x.note}</dd>
        </div>)}</dl>
      </RuleBox></section>
    </article>
    </FiltersScope>
    <DigestFooter footer={issue.footer} />
  </DigestShell>;
}
