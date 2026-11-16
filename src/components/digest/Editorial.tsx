// Shared building blocks for the Digest and trait explainers: the brand's Read type (Big Shoulders + Newsreader), mono only for code-like values.
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { SITE_URL, DIGEST_NAME } from "@/lib/site";
import { figureSvg, type CardModel } from "@/lib/chart/card";
import type { Thumb } from "@/lib/thumbs";
import { BASIS_WORD, type Basis, type StageName } from "@/lib/labels";
import { GATE_ENABLED } from "@/lib/gate";
import type { SectionId } from "@/lib/ia";
import { ReadShell } from "@/components/read/ReadShell";
import { ScrollRow } from "@/components/read/ScrollRow";
import { Wordmark } from "@/components/brand/Wordmark";

/** Absolute URL printed after a link in the print stylesheet. */
export const pr = (href: string) => ({ "data-print": href.startsWith("http") || href.startsWith("mailto:") ? href : `${SITE_URL}${href}` });

/** Digest, explainer and ledger pages sit inside the shared Read shell; Digest pages keep their own Archive / RSS sub-nav. */
type EditionId = "morning" | "digest" | "sectors";
/** Digest-section pages: the editions sub-nav (Morning Line · Digest · Sector reports) plus the current edition's archive and feed. */
export function DigestShell({ children, label, section = "digest", lens = false, note = null, tour = false, edition = "digest", fixedSector, dateline, segmented }: { children: ReactNode; label: string; section?: SectionId; lens?: boolean; note?: string | null; tour?: boolean; edition?: EditionId | null; fixedSector?: { value: string; onChange: (s: string) => void }; dateline?: ReactNode; segmented?: boolean | undefined }) {
  const cur = (id: EditionId) => (edition === id ? { "aria-current": "page" as const, className: "ed-tap py-2 font-semibold no-underline" } : { className: "ed-tap py-2 no-underline" });
  const sub = section === "digest" ? <nav aria-label="Editions" className="ed-nav no-print mt-2 border-y border-ed-ink">
    <div className="ed-wrap"><ScrollRow className="ed-navtext gap-x-4 md:justify-between">
      <span className="flex shrink-0 items-center gap-x-4">
        <Link to="/editions" className="ed-tap py-2 no-underline">Editions</Link>
        <Link to="/morning" {...cur("morning")}>Morning Line</Link>
        <Link to="/digest" {...cur("digest")}>{DIGEST_NAME}</Link>
        <Link to="/sectors" {...cur("sectors")}>Sector reports</Link>
      </span>
      <span className="flex shrink-0 items-center gap-x-4">
        {edition === "digest" && <><Link to="/digest/archive" className="ed-tap py-2">Archive</Link><a href="/digest/rss.xml" className="ed-tap py-2">RSS</a></>}
        {edition === "morning" && <a href="/morning/rss.xml" className="ed-tap py-2">RSS</a>}
        {edition === "sectors" && <button type="button" onClick={() => window.print()} className="ed-tap cursor-pointer py-2 uppercase">Print</button>}
      </span>
    </ScrollRow></div>
  </nav> : undefined;
  return <ReadShell label={label} section={section} lens={lens} note={note} sub={sub} tour={tour} fixedSector={fixedSector} dateline={dateline} segmented={segmented}>{children}</ReadShell>;
}

export function StageWord({ stage }: { stage: StageName | null }) {
  return stage ? <span className="ed-badge" data-stage={stage.toLowerCase()} title="Stage">{stage}</span> : <span className="ed-badge ed-muted">Not staged yet</span>;
}
export const Dim = ({ d }: { d: string }) => <span className="ed-data ed-muted">[{d}]</span>;
/** MEASURED / AI ESTIMATE in the editorial system: a small outlined word, no color. */
export const BasisWord = ({ b }: { b: Basis }) => <span className="ed-badge ed-basis" data-basis={b} title={b === "ai" ? "Read by our AI tagger from homepage captures: an estimate." : "Measured from each page's code and rendered styles."}>{BASIS_WORD[b]}</span>;

export function SectionHead({ n, title, kicker, id }: { n: string; title: string; kicker?: string | undefined; id: string }) {
  return <header className="ed-rule mb-6 flex flex-wrap items-baseline gap-x-4 gap-y-1 pt-3">
    <span className="ed-kicker">{n}</span>
    <h2 id={id} className="ed-h2">{title}</h2>
    {kicker && <p className="ed-caption w-full max-w-[60ch]">{kicker}</p>}
  </header>;
}

/** Lead chart at two sizes: wide for ≥768, compact for phones (keeps axis labels legible). */
export function Figure({ card, label, caption }: { card: Pick<CardModel, "series" | "forecast">; label: string; caption: ReactNode }) {
  return <figure className="ed-figure ed-bleed">
    <div className="hidden md:block" dangerouslySetInnerHTML={{ __html: figureSvg(card, 1280, 520, label) }} />
    <div className="md:hidden" dangerouslySetInnerHTML={{ __html: figureSvg(card, 640, 480, label) }} />
    <figcaption className="ed-caption mt-2 px-5 md:px-0">{caption}</figcaption>
  </figure>;
}

/** Thumbnail with caption and links, or a typographic card when none is stored (or the site opted out). */
export function SiteCard({ domain, name, sector, lines, thumb, sizes = "(min-width: 1024px) 25vw, 100vw" }: { domain: string; name: string | null; sector: string; lines: string[]; thumb: Thumb | null; sizes?: string }) {
  return <article className="flex flex-col gap-2">
    {thumb ? <figure>
      <a href={thumb.live} target="_blank" rel="noopener" {...pr(thumb.live)}><img src={thumb.src} srcSet={thumb.srcSet} sizes={sizes} width={thumb.width} height={thumb.height} loading="lazy" decoding="async" alt={thumb.alt} className="ed-thumb" /></a>
      <figcaption className="ed-caption mt-1">{thumb.caption}</figcaption>
    </figure> : <div className="ed-typo" role="img" aria-label={`${domain}, ${sector}: ${lines.join(", ")}`}>
      <span className="ed-kicker ed-muted">{sector}</span>
      <span className="ed-h3 break-words">{domain}</span>
      <span className="ed-caption">{lines.join(" · ")}</span>
    </div>}
    <h3 className="ed-small font-medium">{name ?? domain}</h3>
    {thumb && <p className="ed-caption">{lines.join(" · ")}</p>}
    <p className="ed-data flex flex-wrap gap-x-3"><Link to="/brands/$domain" params={{ domain }} className="ed-tap" data-tour="r-brand" {...pr(`/brands/${domain}`)}>Brand page →</Link><a href={`https://${domain}`} target="_blank" rel="noopener" className="ed-tap" {...pr(`https://${domain}`)}>Live site ↗</a></p>
  </article>;
}

export function Swatches({ colors, label }: { colors: { hex: string; name: string }[]; label: string }) {
  const single = colors.length === 1;
  return <ul aria-label={label} className={`grid gap-2 ${single ? "grid-cols-1" : "grid-cols-5"}`}>{colors.map((c, i) => <li key={`${c.hex}${i}`} className="min-w-0">
    <span className={`ed-swatch ${single ? "aspect-[3/2]" : ""}`} style={{ background: c.hex }} aria-hidden="true" />
    <span className={`ed-caption mt-1 block ${single ? "" : "truncate"}`} title={c.name}>{c.name}</span>
    <span className="ed-data block text-[11px]">{c.hex}</span>
  </li>)}</ul>;
}

export function DigestFooter({ footer }: { footer: { methodology: string; glossary: string; rss: string; terminal: string; contact: string | null } }) {
  // The footer is a slab: ink, paper type, the mark on its pink slab.
  return <footer className="ed-footer c-slab mt-16 pb-16 pt-8" data-container="slab">
    <div className="ed-wrap"><Wordmark height={32} ground="ink" /></div>
    <div className="ed-wrap ed-navtext mt-6 flex flex-wrap gap-x-6 gap-y-1">
      <a href={footer.methodology} className="ed-tap" {...pr(footer.methodology)}>Methodology</a>
      <a href={footer.glossary} className="ed-tap" {...pr(footer.glossary)}>Glossary</a>
      <a href={footer.rss} className="ed-tap" {...pr(footer.rss)}>RSS</a>
      <Link to="/terminal" className="ed-tap" {...pr("/terminal")}>Open the terminal</Link>
      <Link to="/tools" className="ed-tap">Tools</Link>
      <Link to="/digest/archive" className="ed-tap">All issues</Link>
      <Link to="/what-we-show" className="ed-tap" {...pr("/what-we-show")}>What we show and why</Link>
      {GATE_ENABLED && <form method="post" action="/lock" className="no-print contents"><button type="submit" className="ed-tap cursor-pointer uppercase">Lock</button></form>}
    </div>
    {footer.contact && <p className="ed-wrap ed-caption mt-3">Spotted an error? <a href={footer.contact}>Write to the editor</a>.</p>}
    <p className="ed-wrap ed-caption mt-4 max-w-[72ch]">Every number links to its receipts in the terminal. Thumbnails are small homepage crops, credited and linked to the site; owners can ask for removal and the site is then shown by name only.</p>
  </footer>;
}
