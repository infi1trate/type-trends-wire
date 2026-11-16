// /brands: searchable directory (sector lens, sort by most recent move) and a Moves tab across every brand.
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { brandsQuery } from "@/lib/data";
import { sectorName } from "@/lib/labels";
import { storyTime } from "@/lib/stories";
import { DigestShell } from "@/components/digest/Editorial";
import { StoryCard } from "./StoryCard";
import { ReadFooter } from "./Bits";

export function BrandsIndexView({ tab, sector, sort }: { tab: "directory" | "moves"; sector: string; sort: "recent" | "name" }) {
  const { data } = useSuspenseQuery(brandsQuery());
  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();
  const sites = useMemo(() => data.sites.filter(s => (sector === "all" || s.sector === sector) && (!ql || s.domain.includes(ql) || (s.name ?? "").toLowerCase().includes(ql)))
    .sort((a, b) => sort === "name" ? (a.name ?? a.domain).localeCompare(b.name ?? b.domain) : (b.lastChange ?? "").localeCompare(a.lastChange ?? "") || a.domain.localeCompare(b.domain)), [data, sector, ql, sort]);
  const lensQ = sector === "all" ? undefined : sector, sortQ = sort === "name" ? "name" : undefined;
  const moves = data.moves.filter(m => sector === "all" || m.sector === sector);
  return <DigestShell label="Brands" section="brands" lens>
    <header className="ed-wrap pt-8 md:pt-12">
      <p className="ed-kicker">Brands · {sectorName(sector)}</p>
      <h1 className="ed-cover mt-3">Who is doing it</h1>
      <p className="ed-standfirst mt-5">{data.sites.length} tracked brands in ten sectors: their identity, every confirmed move and how each sits against its sector.</p>
    </header>
    <nav aria-label="Brand views" className="ed-wrap ed-data mt-8 flex flex-wrap gap-x-6 border-y border-ed-ink py-2">
      <Link to="/brands" search={{ tab: undefined, sector: lensQ, sort: sortQ }} aria-current={tab === "directory" ? "page" : undefined} className={`ed-tap no-underline ${tab === "directory" ? "font-semibold underline decoration-2 underline-offset-[6px]" : ""}`}>Directory <span className="ed-muted">{sites.length}</span></Link>
      <Link to="/brands" search={{ tab: "moves", sector: lensQ, sort: sortQ }} aria-current={tab === "moves" ? "page" : undefined} className={`ed-tap no-underline ${tab === "moves" ? "font-semibold underline decoration-2 underline-offset-[6px]" : ""}`}>Moves <span className="ed-muted">{moves.length}</span></Link>
    </nav>
    {tab === "directory" ? <section aria-label="Brand directory" className="ed-wrap mt-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <label className="ed-data flex max-w-md flex-1 items-center gap-2 border border-ed-ink px-2"><span className="sr-only">Search brands</span><span aria-hidden>⌕</span><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search brands by name or domain" className="min-h-11 w-full bg-transparent outline-none" /></label>
        <p className="ed-data flex flex-wrap items-center gap-x-4"><span className="ed-kicker">Sort</span>
          <Link to="/brands" search={{ tab: undefined, sector: lensQ, sort: undefined }} className={`ed-tap ${sort === "recent" ? "font-semibold" : ""}`}>Most recent move</Link>
          <Link to="/brands" search={{ tab: undefined, sector: lensQ, sort: "name" }} className={`ed-tap ${sort === "name" ? "font-semibold" : ""}`}>Name</Link></p>
      </div>
      <p className="ed-caption mt-2" aria-live="polite">{sites.length} brands</p>
      <ul className="mt-4 grid grid-cols-1 gap-x-8 md:grid-cols-2 lg:grid-cols-3">{sites.map((s, i) => <li key={s.domain} className="ed-hair min-w-0 py-3">
        <Link to="/brands/$domain" params={{ domain: s.domain }} className="ed-h3 no-underline hover:underline" data-tour={i === 0 ? "r-brand" : undefined}>{s.name ?? s.domain}</Link>
        <p className="ed-data ed-muted mt-1">{s.domain} · {sectorName(s.sector)}</p>
        <p className="ed-caption mt-1 line-clamp-2">{s.lastMove ? `${s.lastMove} · ${storyTime(s.lastChange!)}` : s.lastChange ? `Last confirmed change ${storyTime(s.lastChange)}` : "No confirmed change yet"}</p>
      </li>)}</ul>
    </section> : <section aria-label="Recent moves" className="ed-wrap mt-6">
      <p className="ed-caption">Confirmed changes (two captures agree) and rebrands, newest first.</p>
      {moves.length ? <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-2 lg:grid-cols-3">{moves.map(s => <StoryCard key={s.id} s={s} />)}</div> : <p className="ed-body mt-4">No confirmed move{sector !== "all" ? ` in ${sectorName(sector)}` : ""} in the last 30 days.</p>}
    </section>}
    <ReadFooter terminal="/terminal?panel=library" />
  </DigestShell>;
}
