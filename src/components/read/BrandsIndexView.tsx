// /brands (Steady): the tracked brands as one Ledger — a search over the 300, the sector lens, columns for sector, last change and
// recorded moves, sortable by each; every choice lives in the URL. A Moves tab lists recent confirmed changes across every brand.
import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { brandsQuery } from "@/lib/data";
import { sectorName } from "@/lib/labels";
import { storyTime } from "@/lib/stories";
import { BRAND_SORTS, brandsIndex, brandsSearch, sortBy, type BrandsView } from "@/lib/brands-index";
import { DigestShell } from "@/components/digest/Editorial";
import { Ledger } from "@/components/brand/Ledger";
import { RuleBox } from "@/components/brand/Containers";
import { StoryCard } from "./StoryCard";
import { ReadFooter } from "./Bits";
import { ScrollRow } from "./ScrollRow";

/** Rows in the first response; "Show all" draws the rest from data already on the page (a link with ?all=1 without scripts). */
export const BRANDS_FIRST = 60;
export function BrandsIndexView({ v, all = false }: { v: BrandsView; all?: boolean }) {
  const { data } = useSuspenseQuery(brandsQuery());
  const [more, setMore] = useState(false);
  const navigate = useNavigate();
  const idx = useMemo(() => brandsIndex(data.sites, v), [data, v]);
  const moves = data.moves.filter(m => v.sector === "all" || m.sector === v.sector);
  const go = (next: BrandsView, replace = false) => navigate({ to: "/brands", search: brandsSearch(next), replace, resetScroll: false });
  return <DigestShell label="Brands" section="brands" lens>
    <header className="ed-wrap pt-8 md:pt-12">
      <p className="ed-kicker">Brands · {sectorName(v.sector)}</p>
      <h1 className="ed-cover mt-3">Who is doing it</h1>
      <p className="ed-standfirst mt-5">{data.sites.length} tracked brands in ten sectors: their identity, every confirmed move and how each sits against its sector.</p>
    </header>
    <nav aria-label="Brand views" className="ed-wrap mt-8 border-y border-ed-ink"><ScrollRow className="ed-data gap-x-6 py-2">
      <Link to="/brands" search={brandsSearch({ ...v, tab: "directory" })} aria-current={v.tab === "directory" ? "page" : undefined} className={`ed-tap no-underline ${v.tab === "directory" ? "font-semibold underline decoration-2 underline-offset-[6px]" : ""}`}>Directory <span className="ed-muted">{idx.rows.length}</span></Link>
      <Link to="/brands" search={brandsSearch({ ...v, tab: "moves" })} aria-current={v.tab === "moves" ? "page" : undefined} className={`ed-tap no-underline ${v.tab === "moves" ? "font-semibold underline decoration-2 underline-offset-[6px]" : ""}`}>Moves <span className="ed-muted">{moves.length}</span></Link>
    </ScrollRow></nav>
    {v.tab === "directory" ? <section aria-label="Brand directory" className="ed-wrap mt-6">
      <RuleBox className="p-4">
        <form role="search" method="get" action="/brands" className="flex flex-col gap-3 md:flex-row md:items-end" onSubmit={e => { e.preventDefault(); go(v); }}>
          <div className="flex min-w-0 flex-1 flex-col gap-1"><label htmlFor="brands-q" className="ed-kicker">Search the tracked brands</label>
            <input id="brands-q" name="q" type="search" value={v.q} maxLength={80} onChange={e => go({ ...v, q: e.target.value }, true)} placeholder="Name or domain, e.g. linear" autoComplete="off" className="ed-data form-field min-h-11 w-full bg-transparent px-3" />
          </div>
          {v.sector !== "all" && <input type="hidden" name="sector" value={v.sector} />}
          <noscript><button type="submit" className="c-raised ed-kicker">Search</button></noscript>
        </form>
        <p className="ed-data mt-4 flex flex-wrap items-center gap-x-4 gap-y-1" aria-label="Sort by"><span className="ed-kicker">Sort</span>
          {BRAND_SORTS.map(s => { const on = v.sort === s.id; return <Link key={s.id} to="/brands" search={brandsSearch(sortBy(v, s.id))} resetScroll={false} aria-current={on ? "true" : undefined} className={`ed-tap ${on ? "font-semibold underline decoration-2 underline-offset-[6px]" : ""}`}>{s.label}{on ? (v.dir === "asc" ? " ↑" : " ↓") : ""}</Link>; })}</p>
      </RuleBox>
      <p className="ed-caption mt-3" aria-live="polite" data-count-line="">{idx.countLine}</p>
      {idx.empty ? <p className="ed-body mt-4 max-w-[60ch]">{idx.empty} <Link to="/audit/new" search={{ sites: undefined }} className="ed-tap">Audit a site →</Link></p>
        : <><Ledger className="mt-3" label="Tracked brands" rows={(all || more ? idx.rows : idx.rows.slice(0, BRANDS_FIRST)).map(s => ({ key: s.domain, href: `/brands/${encodeURIComponent(s.domain)}`, title: s.name ?? s.domain,
          line: <><span className="ed-code">{s.domain}</span>{s.lastMove ? ` · ${s.lastMove}` : ""}</>, facts: [sectorName(s.sector), s.lastChange ? `Changed ${storyTime(s.lastChange)}` : "No recorded move", `${s.moves} ${s.moves === 1 ? "move" : "moves"}`] }))} />
          {!all && !more && idx.rows.length > BRANDS_FIRST && <p className="ed-data mt-4"><Link to="/brands" search={{ ...brandsSearch(v), all: "1" }} resetScroll={false} className="c-raised ed-kicker no-underline" data-container="raised" data-show-all=""
            onClick={e => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); setMore(true); requestAnimationFrame(() => document.querySelectorAll<HTMLElement>("[data-ledger] .ledger-link")[BRANDS_FIRST]?.focus()); }}>Show all {idx.rows.length} brands</Link> <span className="ed-caption">The first {BRANDS_FIRST} are shown.</span></p>}</>}
    </section> : <section aria-label="Recent moves" className="ed-wrap mt-6">
      <p className="ed-caption">Confirmed changes (two captures agree) and rebrands in the last 30 days, newest first.</p>
      {moves.length ? <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-2 lg:grid-cols-3">{moves.map(s => <StoryCard key={s.id} s={s} />)}</div> : <p className="ed-body mt-4">No confirmed move{v.sector !== "all" ? ` in ${sectorName(v.sector)}` : ""} in the last 30 days. Moves land here as soon as two captures agree on a change.</p>}
    </section>}
    <ReadFooter terminal="/terminal?panel=library" />
  </DigestShell>;
}
