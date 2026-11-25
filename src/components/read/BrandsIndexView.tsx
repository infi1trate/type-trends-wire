import { EmptyState } from "@/components/a4/Pop";
import { line as voiced } from "@/lib/voice";
// /brands (Steady): the tracked brands as a grid of tiles (S1; "Moved this week" cards above) — a search over the 300, the sector lens, columns for sector, last change and
// recorded moves, sortable by each; every choice lives in the URL. A Moves tab lists recent confirmed changes across every brand.
import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { brandsQuery } from "@/lib/data";
import { sectorName } from "@/lib/labels";
import { BRAND_SORTS, brandsIndex, brandsSearch, sortBy, type BrandsView } from "@/lib/brands-index";
import { DigestShell } from "@/components/digest/Editorial";
import { RuleBox } from "@/components/brand/Containers";
import { StoryCard } from "./StoryCard";
import { ReadFooter } from "./Bits";
import { ScrollRow } from "./ScrollRow";
import { longDay, type Pic } from "@/lib/pictures";
/** "21 Nov", with the year kept when it is not the year of the directory's newest change (deterministic, so SSR and hydration agree). */
const shortDay = (iso: string, year: string) => (iso.slice(0, 4) === year ? longDay(iso).replace(/ \d{4}$/, "") : longDay(iso));
import { moveAfterName } from "@/lib/brand-tiles";
import { BrandMark } from "./BrandMark";
import { CategoryChips } from "./CategoryChips";
import { CATEGORY_TOO_FEW, CATEGORY_SHARE_MIN, categoryChips, categoryLabel, classOf, subcategoryChips } from "@/lib/categories";

type Moved = { domain: string; headline: string; at: string; hero: Pic };

/** Rows in the first response; "Show all" draws the rest from data already on the page (a link with ?all=1 without scripts). */
export const BRANDS_FIRST = 60;
export function BrandsIndexView({ v, all = false }: { v: BrandsView; all?: boolean }) {
  const { data } = useSuspenseQuery(brandsQuery());
  const [more, setMore] = useState(false);
  const navigate = useNavigate();
  const idx = useMemo(() => brandsIndex(data.sites, v), [data, v]);
  const icons: Record<string, Pic> = (data as { icons?: Record<string, Pic> }).icons ?? {};
  const extra = data as { moved?: Moved[]; movedDomains?: string[] };
  const movedNow = useMemo(() => new Set(extra.movedDomains ?? []), [extra.movedDomains]);
  const band = (extra.moved ?? []).filter(m => v.sector === "all" || data.sites.find(x => x.domain === m.domain)?.sector === v.sector);
  const year = useMemo(() => data.sites.reduce((y, x) => (x.lastChange && x.lastChange.slice(0, 4) > y ? x.lastChange.slice(0, 4) : y), ""), [data.sites]);
  const siteOf = useMemo(() => new Map(data.sites.map(x => [x.domain, x])), [data.sites]);
  const moves = data.moves.filter(m => v.sector === "all" || m.sector === v.sector);
  const go = (next: BrandsView, replace = false) => navigate({ to: "/brands", search: brandsSearch(next), replace, resetScroll: false });
  return <DigestShell label="Brands" section="brands" lens>
    <header className="ed-wrap pt-8 md:pt-12">
      <p className="ed-kicker">Brands · {sectorName(v.sector)}</p>
      <h1 className="ed-cover mt-3">Who is doing it</h1>
      <p className="ed-standfirst hold-brands-deck mt-5"><mark className="hl-mark" data-highlight="">{data.sites.length} brands slug reads</mark> in ten sectors: their identity, every confirmed change and how each sits in its sector.</p>
    </header>
    <nav aria-label="Brand views" className="ed-wrap mt-8 border-y border-ed-ink"><ScrollRow className="ed-data gap-x-6 py-2">
      <Link to="/brands" search={brandsSearch({ ...v, tab: "directory" })} aria-current={v.tab === "directory" ? "page" : undefined} className={`ed-tap no-underline ${v.tab === "directory" ? "font-semibold underline decoration-2 underline-offset-[6px]" : ""}`}>Directory <span className="ed-muted">{idx.rows.length}</span></Link>
      <Link to="/brands" search={brandsSearch({ ...v, tab: "moves" })} aria-current={v.tab === "moves" ? "page" : undefined} className={`ed-tap no-underline ${v.tab === "moves" ? "font-semibold underline decoration-2 underline-offset-[6px]" : ""}`}>Moves <span className="ed-muted">{moves.length}</span></Link>
    </ScrollRow></nav>
    {v.tab === "directory" && band.length >= 3 && <section aria-labelledby="brands-moved" className="ed-wrap mt-[var(--sys-gap-section)]" data-moved-band="">
      <h2 id="brands-moved" className="ed-kicker">Changed this week</h2>
      <ul className="moved-band mt-3">{band.map((m, i) => { const x = siteOf.get(m.domain), name = x?.name ?? m.domain; return <li key={m.domain}>
        <Link to="/brands/$domain" params={{ domain: m.domain }} className="moved-card" aria-label={`${name}: ${moveAfterName(m.headline, name, m.domain)}`}>
          <span className="moved-crop"><img src={m.hero.src} alt="" width={m.hero.width} height={m.hero.height} loading={i < 2 ? "eager" : "lazy"} decoding="async" /><BrandMark icon={icons[m.domain]} name={name} size={48} /></span>
          <span className="brand-tile-name">{name}</span>
          <span className="ed-caption brand-tile-move">{moveAfterName(m.headline, name, m.domain)}</span>
        </Link></li>; })}</ul>
      <p className="ed-caption mt-2">First screens as captured; each links to the brand.</p>
    </section>}
    {v.tab === "directory" ? <section aria-label="Brand directory" className="ed-wrap mt-[var(--sys-gap-section)]">
      <RuleBox className="p-4">
        <form role="search" method="get" action="/brands" className="flex flex-col gap-3 md:flex-row md:items-end" onSubmit={e => { e.preventDefault(); go(v); }}>
          <div className="flex min-w-0 flex-1 flex-col gap-1"><label htmlFor="brands-q" className="ed-kicker">Search the brands</label>
            <input id="brands-q" name="q" type="search" value={v.q} maxLength={80} onChange={e => go({ ...v, q: e.target.value }, true)} placeholder="Name or domain, e.g. linear" autoComplete="off" className="ed-data form-field min-h-11 w-full bg-transparent px-3" />
          </div>
          {v.sector !== "all" && <input type="hidden" name="sector" value={v.sector} />}
          <noscript><button type="submit" className="c-raised ed-kicker">Search</button></noscript>
        </form>
        <p className="ed-data mt-4 flex flex-wrap items-center gap-x-4 gap-y-1" aria-label="Sort by"><span className="ed-kicker">Sort</span>
          {BRAND_SORTS.map(s => { const on = v.sort === s.id; return <Link key={s.id} to="/brands" search={brandsSearch(sortBy(v, s.id))} resetScroll={false} aria-current={on ? "true" : undefined} className={`ed-tap ${on ? "font-semibold underline decoration-2 underline-offset-[6px]" : ""}`}>{s.label}{on ? (v.dir === "asc" ? " ↑" : " ↓") : ""}</Link>; })}</p>
      </RuleBox>
      {v.sector !== "all" && <CategoryChips chips={categoryChips(data.sites, v.sector)} subs={v.category ? subcategoryChips(data.sites, v.sector, v.category) : []} value={{ category: v.category ?? null, sub: v.sub ?? null }}
        href={n => ({ to: "/brands", search: brandsSearch({ ...v, category: n.category, sub: n.sub }) as Record<string, string | undefined> })} />}
      <p className="ed-caption mt-3" aria-live="polite" data-count-line="">{idx.countLine}{v.category && idx.rows.length < CATEGORY_SHARE_MIN ? ` ${CATEGORY_TOO_FEW}` : ""}</p>
      {idx.empty ? <div className="mt-4"><EmptyState mark="Nothing yet"><p>{idx.empty} <Link to="/audit/new" search={{ sites: undefined }} className="ed-tap">Audit a site →</Link></p></EmptyState></div>
        // S1 · the directory as tiles (a compact row under 480 px): logo plate, name, sector chip, moves and last change, the latest move.
        : <><ul className="brand-grid mt-3" aria-label="Tracked brands" data-brand-grid="">{(all || more ? idx.rows : idx.rows.slice(0, BRANDS_FIRST)).map((s, i) => { const name = s.name ?? s.domain, moved = movedNow.has(s.domain);
          const facts = `${s.moves} ${s.moves === 1 ? "change" : "changes"} · ${s.lastChange ? `changed ${shortDay(s.lastChange, year)}` : voiced("read.brandsIndexView.1")}`;
          return <li key={s.domain} className="brand-grid-item">
            <Link to="/brands/$domain" params={{ domain: s.domain }} className="brand-tile" data-brand-tile="" aria-label={`${name}, ${sectorName(s.sector)}, ${facts}${moved ? ", moved this week" : ""}`}>
              <BrandMark icon={icons[s.domain]} name={name} size={72} mobileSize={56} eager={i < 10} />
              <span className="brand-tile-body">
                <span className="brand-tile-name">{name}</span>
                {(() => { const c = classOf(s); return c.subcategory ? <span className="ed-kicker brand-tile-sub" data-brand-sub="">{categoryLabel(c.subcategory)}</span> : null; })()}
                <span className="brand-tile-chips"><span className="ledger-tag">{sectorName(s.sector)}</span></span>
                <span className="ed-caption brand-tile-facts">{facts}</span>
                {s.lastMove && <span className="ed-caption brand-tile-move">{moveAfterName(s.lastMove, name, s.domain)}</span>}
              </span>
              {moved && <span className="c-sticker brand-tile-sticker" aria-hidden="true" data-container="sticker">Changed</span>}
            </Link></li>; })}</ul>
          {!all && !more && idx.rows.length > BRANDS_FIRST && <p className="ed-data mt-4"><Link to="/brands" search={{ ...brandsSearch(v), all: "1" }} resetScroll={false} className="c-raised ed-kicker no-underline" data-container="raised" data-show-all=""
            onClick={e => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); setMore(true); requestAnimationFrame(() => document.querySelectorAll<HTMLElement>("[data-brand-tile]")[BRANDS_FIRST]?.focus()); }}>Show all {idx.rows.length} brands</Link> <span className="ed-caption">The first {BRANDS_FIRST} are shown.</span></p>}</>}
    </section> : <section aria-label="Recent changes" className="ed-wrap mt-[var(--sys-gap-section)]">
      <p className="ed-caption">Confirmed changes (two captures agree) and rebrands in the last 30 days, newest first.</p>
      {moves.length ? <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-2 lg:grid-cols-3">{moves.map(s => <StoryCard key={s.id} s={s} />)}</div> : <p className="ed-body mt-4">No confirmed move{v.sector !== "all" ? ` in ${sectorName(v.sector)}` : ""} in the last 30 days. Moves land here as soon as two captures agree on a change.</p>}
    </section>}
    <ReadFooter terminal="/terminal?panel=library" />
  </DigestShell>;
}
