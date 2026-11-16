// Competitive audit page in the Digest editorial system. Pure render of auditModel; print stylesheet makes it a pitch appendix.
import { Fragment } from "react";
import { Link } from "@tanstack/react-router";
import type { Audit, TraitRef, Matrix } from "@/lib/agency/audit";
import { scopeText, label as traitLabel } from "@/lib/labels";
import { BasisWord, SectionHead, SiteCard, StageWord, Swatches, Dim, pr } from "@/components/digest/Editorial";
import { AgencyShell, Btn, CopyField, day } from "./Shell";

const pct = (x: number | null) => (x == null ? "—" : `${Math.round(x * 100)}%`);
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const TITLES: Record<string, string> = { glance: "At a glance", type: "Type", color: "Color", layout: "Layout & components", vibe: "Vibe & voice", market: "Versus the market", moves: "Recent moves", whitespace: "White space", method: "Methodology" };

function Trait({ t }: { t: TraitRef }) {
  return <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-1">
    <a href={t.explainer} {...pr(t.explainer)}>{t.name}</a> <Dim d={t.dimension} /> <BasisWord b={t.basis} /> <StageWord stage={t.stage} />
    <a href={t.receipt} className="ed-data ed-muted" {...pr(t.receipt)}>{pct(t.share)} of sites</a>
  </li>;
}
function MatrixTable({ m, caption, head }: { m: Matrix; caption: string; head: string }) {
  return <div className="overflow-x-auto">
    <table className="ed-data w-full min-w-[480px] border-collapse text-left">
      <caption className="ed-caption mb-2 text-left">{caption}</caption>
      <thead><tr className="border-b border-ed-ink"><th scope="col" className="py-2 pr-4 font-semibold">{head}</th>{m.domains.map(d => <th key={d} scope="col" className="py-2 pr-3 font-semibold">{d}</th>)}</tr></thead>
      <tbody>{m.rows.map(r => <tr key={r.trait} className="ed-hair">
        <th scope="row" className="py-2 pr-4 font-normal"><a href={`/signals/${encodeURIComponent(r.trait)}`}>{r.name}</a> <BasisWord b={r.basis} /></th>
        {r.cells.map((c, i) => <td key={m.domains[i]} className="py-2 pr-3" aria-label={c == null ? "no data" : c ? "yes" : "no"}>{c == null ? "·" : c ? "✓" : "–"}</td>)}
      </tr>)}</tbody>
    </table>
  </div>;
}
function FaceLine({ role, f }: { role: string; f: NonNullable<Audit["type"]>["sites"][number]["h1"] }) {
  if (!f) return <p className="ed-caption">{role}: not measured</p>;
  const facts = [f.style, f.size ? `${Math.round(f.size)} px` : null, f.weight ? `weight ${f.weight}` : null, f.tracking != null ? `tracking ${f.tracking.toFixed(3)} em` : null, f.case].filter(Boolean).join(" · ");
  return <div className="py-1">
    <p className="ed-kicker ed-muted">{role}</p>
    <p className="ed-h3 break-words" style={f.google ? { fontFamily: `'${f.family}', ${f.style === "serif" ? "serif" : f.style === "mono" ? "monospace" : "sans-serif"}` } : undefined}>{f.family}</p>
    <p className="ed-caption">{f.google ? "Google Fonts face, shown in its own face" : "Proprietary face, shown by name"} · {facts}</p>
  </div>;
}

export function AuditView({ a }: { a: Audit }) {
  const n = a.domains.length, where = scopeText(a.sector);
  const latest = a.glance.map(g => g.captured).filter((x): x is string => !!x).sort().at(-1) ?? null;
  const num = (k: string) => String(a.sections.indexOf(k) + 1).padStart(2, "0");
  return <AgencyShell label={`Competitive audit of ${list(a.domains)}`} crumb="Competitive audit">
    <header className="ed-wrap pb-10 pt-10">
      <p className="ed-kicker">Competitive audit · DSGN/TERMINAL</p>
      <h1 className="ed-cover mt-4 break-words">{list(a.domains)}</h1>
      <p className="ed-standfirst mt-6">{n} sites compared on type, color, layout and voice, read against {where}{a.sectorSource === "majority" ? " (their most common sector)" : a.sectorSource === "chosen" ? "" : ""}.</p>
      <p className="ed-data mt-4">{latest ? `Latest capture ${day(latest)}` : "No captures yet"}{a.dataThrough ? ` · forecast data through ${a.dataThrough}` : ""} · prepared {day(a.now)}</p>
      {a.pending.length > 0 && <p className="ed-small mt-3">Pending: {list(a.pending)} {a.pending.length === 1 ? "is" : "are"} not tracked yet and {a.pending.length === 1 ? "is" : "are"} left out of the comparisons until rendered.</p>}
      <div className="no-print mt-6 flex flex-wrap gap-3">
        <Btn kind="solid" onClick={() => window.print()}>Print / Save as PDF</Btn>
        <Link to="/audit/new" search={{ sites: a.domains.join(",") }} className="ed-kicker inline-flex min-h-[44px] items-center border border-ed-ink px-4 no-underline">Change sites</Link>
        <Link to="/watch/new" search={{ add: a.domains.join(","), name: undefined }} className="ed-kicker inline-flex min-h-[44px] items-center border border-ed-ink px-4 no-underline">Watch these sites</Link>
      </div>
      <nav aria-label="Sections" className="no-print ed-data mt-6 flex flex-wrap gap-x-4">{a.sections.map(k => <a key={k} href={`#a-${k}`} className="ed-tap">{num(k)} {TITLES[k]}</a>)}</nav>
    </header>

    <section className="ed-wrap" aria-labelledby="a-glance">
      <SectionHead n={num("glance")} title="At a glance" id="a-glance" />
      <div className={`grid gap-8 sm:grid-cols-2 ${n > 2 ? "lg:grid-cols-3" : ""}`}>
        {a.glance.map(g => <div key={g.domain} className="flex flex-col gap-1">
          {g.status === "tracked"
            ? <SiteCard domain={g.domain} name={g.name} sector={g.sector ?? "untracked"} thumb={g.thumb} lines={[g.sector ?? "", `captured ${day(g.captured)}`].filter(Boolean)} sizes="(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw" />
            : <article className="flex flex-col gap-2"><div className="ed-typo" role="img" aria-label={`${g.domain}: ${g.status === "rendered" ? "rendered once, not tracked" : "pending render"}`}>
                <span className="ed-kicker ed-muted">{g.status === "rendered" ? "Rendered once" : "Pending"}</span><span className="ed-h3 break-words">{g.domain}</span><span className="ed-caption">{g.status === "rendered" ? `rendered ${day(g.captured)} · not tracked` : "Not tracked yet — render requested"}</span></div>
                <p className="ed-data"><a href={g.terminal} className="ed-tap" {...pr(g.terminal)}>Analyse in the terminal →</a></p></article>}
          <p className="ed-small">{g.latest ? <>Latest change: {g.latest.text} <span className="ed-data ed-muted">{day(g.latest.at)}</span></> : <span className="ed-muted">No recorded changes yet.</span>}</p>
        </div>)}
      </div>
    </section>

    {a.type && <section className="ed-wrap mt-14" aria-labelledby="a-type">
      <SectionHead n={num("type")} title="Type" id="a-type" kicker="Headline and body faces from each homepage, with measured size, weight, tracking and case." />
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">{a.type.sites.map(s => <article key={s.domain} className="ed-hair pt-3"><h3 className="ed-kicker">{s.domain}</h3><FaceLine role="Headline" f={s.h1} /><FaceLine role="Body" f={s.body} /></article>)}</div>
      <p className="ed-body mt-6">{a.type.shared.length ? a.type.shared.map(x => `${list(x.domains)} share ${x.family}`).join("; ") + "." : "No two sites share a face."}</p>
    </section>}

    {a.color && <section className="ed-wrap mt-14" aria-labelledby="a-color">
      <SectionHead n={num("color")} title="Color" id="a-color" kicker={a.color.themes} />
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">{a.color.sites.map(s => <article key={s.domain} className="ed-hair flex flex-col gap-3 pt-3">
        <h3 className="ed-kicker">{s.domain} <span className="ed-muted">· {s.theme ?? "theme unknown"}</span></h3>
        {s.accent && <p className="ed-small">Accent: {s.accent.name} <span className="ed-data">{s.accent.hex}</span></p>}
        {s.palette.length > 0 && <Swatches colors={s.palette.slice(0, 5)} label={`${s.domain} palette`} />}
      </article>)}</div>
      {a.color.overlap.length > 0 && <p className="ed-body mt-6">Shared colors: {a.color.overlap.map(o => `${o.name} (${list(o.domains)})`).join("; ")}.</p>}
    </section>}

    {a.layout && <section className="ed-wrap mt-14" aria-labelledby="a-layout">
      <SectionHead n={num("layout")} title="Layout & components" id="a-layout" kicker="Hero layout and components are AI estimates; alignment, grid, buttons, CSS and stack are measured." />
      <div className="overflow-x-auto"><table className="ed-data w-full min-w-[560px] border-collapse text-left">
        <thead><tr className="border-b border-ed-ink">{["Site", "Hero", "Media", "Headline", "Grid", "Buttons", "Stack"].map(h => <th key={h} scope="col" className="py-2 pr-3 font-semibold">{h}</th>)}</tr></thead>
        <tbody>{a.layout.sites.map(s => <tr key={s.domain} className="ed-hair align-top">
          <th scope="row" className="py-2 pr-3 font-normal">{s.domain}</th><td className="py-2 pr-3">{s.heroLayout ? traitLabel(`hero_layout:${s.heroLayout}`).name : "—"}</td><td className="py-2 pr-3">{s.heroMedia ? traitLabel(`hero_media:${s.heroMedia}`).name : "—"}</td><td className="py-2 pr-3">{s.align ?? "—"}</td><td className="py-2 pr-3">{s.gridCols ? `${s.gridCols} cols` : "—"}</td><td className="py-2 pr-3">{s.buttons ?? "—"}</td><td className="py-2 pr-3">{s.stack.join(", ") || "—"}</td>
        </tr>)}</tbody></table></div>
      {a.layout.components && <div className="mt-8"><MatrixTable m={a.layout.components} head="Component" caption="Components present (AI-tagged estimates): ✓ present, – not seen, · no confident read" /></div>}
      {a.layout.css && <div className="mt-8"><MatrixTable m={a.layout.css} head="CSS feature" caption="Modern CSS features in use (measured): ✓ used, – not used, · not measured" /></div>}
    </section>}

    {a.vibe && <section className="ed-wrap mt-14" aria-labelledby="a-vibe">
      <SectionHead n={num("vibe")} title="Vibe & voice" id="a-vibe" kicker="AI-tagged estimates from homepage images and copy; shown only for confident reads." />
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">{a.vibe.sites.map(s => <article key={s.domain} className="ed-hair pt-3">
        <h3 className="ed-kicker">{s.domain}</h3>
        <dl className="ed-small mt-2 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1">
          {([["Aesthetic", s.aesthetic.map(x => traitLabel(`aesthetic:${x}`).name).join(", ")], ["Imagery", s.imagery.map(x => traitLabel(`imagery:${x}`).name).join(", ")], ["Tone", s.tone.join(", ")], ["AI positioning", s.aiPositioning ? traitLabel(`ai_positioning:${s.aiPositioning}`).name : ""], ["Color mood", s.colorMood ?? ""]] as const).filter(([, v]) => v).map(([k, v]) => <Fragment key={k}><dt className="ed-muted">{k}</dt><dd>{v}</dd></Fragment>)}
        </dl>
        {s.confidence != null && <p className="ed-caption mt-2">Estimate confidence {pct(s.confidence)}</p>}
      </article>)}</div>
    </section>}

    {a.market && <section className="ed-wrap mt-14" aria-labelledby="a-market">
      <SectionHead n={num("market")} title="Versus the market" id="a-market" kicker="Ahead: signals each site shows that are Rising or Emerging in its own sector. Behind: Fading signals it still uses." />
      <div className="grid gap-10 lg:grid-cols-2">{a.market.sites.map(s => <article key={s.domain} className="ed-hair pt-3">
        <h3 className="ed-kicker">{s.domain} <span className="ed-muted">· {scopeText(s.scope)}</span></h3>
        <p className="ed-body mt-2">{s.sentence}</p>
        {s.ahead.length > 0 && <><p className="ed-kicker mt-4">Ahead</p><ul>{s.ahead.slice(0, 8).map(t => <Trait key={t.trait} t={t} />)}</ul></>}
        {s.behind.length > 0 && <><p className="ed-kicker mt-4">Behind</p><ul>{s.behind.slice(0, 8).map(t => <Trait key={t.trait} t={t} />)}</ul></>}
      </article>)}</div>
    </section>}

    {a.moves && <section className="ed-wrap mt-14" aria-labelledby="a-moves">
      <SectionHead n={num("moves")} title="Recent moves" id="a-moves" kicker="Confirmed changes in the last 90 days (a change counts after two captures agree) and confirmed rebrands." />
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">{a.moves.sites.map(s => <article key={s.domain} className="ed-hair pt-3">
        <h3 className="ed-kicker">{s.domain}</h3>
        <ul className="mt-2 flex flex-col gap-2">{s.items.map((i, k) => <li key={k} className="ed-small"><span className="ed-data ed-muted">{day(i.at)}</span> {i.text} <a href={i.href} className="ed-data" {...pr(i.href)}>receipt</a></li>)}</ul>
      </article>)}</div>
    </section>}

    {a.whitespace && <section className="ed-wrap mt-14" aria-labelledby="a-whitespace">
      <SectionHead n={num("whitespace")} title="White space" id="a-whitespace" kicker={`Open territory: signals Rising or Emerging in ${scopeText(a.whitespace.scope)} that none of these ${a.whitespace.basedOn === a.whitespace.of ? a.whitespace.of : `${a.whitespace.basedOn} measured`} sites use yet, strongest momentum first.`} />
      <ol className="grid gap-x-10 md:grid-cols-2">{a.whitespace.traits.map(t => <Trait key={t.trait} t={t} />)}</ol>
    </section>}

    <section className="ed-wrap mt-14" aria-labelledby="a-method">
      <SectionHead n={num("method")} title="Methodology" id="a-method" />
      <ul className="ed-small ed-body flex flex-col gap-2">{a.method.notes.map(x => <li key={x}>{x}</li>)}</ul>
      <table className="ed-data mt-6 border-collapse text-left"><caption className="ed-caption mb-2 text-left">Capture dates</caption>
        <tbody>{a.method.captures.map(c => <tr key={c.domain} className="ed-hair"><th scope="row" className="py-1 pr-6 font-normal">{c.domain}</th><td className="py-1 pr-6">{day(c.at)}</td><td className="py-1">{c.source}</td></tr>)}</tbody></table>
      <div className="no-print mt-8 max-w-xl"><CopyField label="Share this audit" value={a.url} note="The page is behind the site password while DSGN/TERMINAL is in private preview." /></div>
    </section>
  </AgencyShell>;
}
