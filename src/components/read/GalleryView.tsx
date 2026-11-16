// /patterns (Steady): the pattern gallery — a wall of stored captures that show a pattern, filtered by sector (the lens), pattern,
// period, measured or AI estimate, and page section (offered only once crops exist). The server builds and caches the model.
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { galleryQuery } from "@/lib/data";
import { galleryQuery as galleryHref, gallerySearch, parseGallerySearch, type GallerySearch } from "@/lib/gallery";
import { CROP_SECTION_NAME, sectorName } from "@/lib/labels";
import { BASIS_WORD } from "@/lib/labels";
import { ILLUSTRATED_MIN } from "@/lib/crops";
import { DigestShell } from "@/components/digest/Editorial";
import { RuleBox } from "@/components/brand/Containers";
import { Ledger } from "@/components/brand/Ledger";
import { PagedWall } from "./Wall";
import { ReadFooter } from "./Bits";

const SELECT = "ed-data form-field min-h-11 w-full bg-transparent px-3";
export function GalleryView({ search }: { search: GallerySearch }) {
  const { data: g } = useSuspenseQuery(galleryQuery(search));
  const qc = useQueryClient(), navigate = useNavigate();
  const f = g.filter, sector = f.sectors[0] ?? "all";
  const set = (patch: Partial<GallerySearch>) => navigate({ to: "/patterns", search: { ...gallerySearch({ ...f, page: 1 }), ...patch, page: undefined }, resetScroll: false });
  const onSel = (k: keyof GallerySearch) => (e: React.ChangeEvent<HTMLSelectElement>) => set({ [k]: e.target.value || undefined });
  const p = g.pattern;
  return <DigestShell label="Patterns" section="patterns" lens>
    <header className="ed-wrap pt-8 md:pt-12">
      <p className="ed-kicker">Patterns · {sectorName(sector)}</p>
      <h1 className="ed-cover mt-3">{p ? p.name : "Patterns, seen on the page"}</h1>
      <p className="ed-standfirst mt-5 max-w-[62ch]">{p ? `Every stored capture showing ${p.name.toLowerCase()}, newest first. Open a tile for the brand.` : "Stored captures of tracked homepages that show a headline pattern, newest first. Filter by pattern, period and how it was read; open a tile for the brand."}</p>
    </header>
    <section aria-label="Filters" className="ed-wrap mt-8">
      <RuleBox className="p-4">
        <form method="get" action="/patterns" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={e => e.preventDefault()}>
          {sector !== "all" && <input type="hidden" name="sector" value={sector} />}
          <div className="flex min-w-0 flex-col gap-1"><label htmlFor="g-pattern" className="ed-kicker">Pattern</label>
            <select id="g-pattern" name="pattern" value={f.pattern ?? ""} onChange={onSel("pattern")} className={SELECT}>
              <option value="">Every pattern with a wall</option>
              {g.options.patterns.map(o => <option key={o.key} value={o.key}>{o.name} ({o.count})</option>)}
              {p && !g.options.patterns.some(o => o.key === p.key) && <option value={p.key}>{p.name}</option>}
            </select></div>
          <div className="flex min-w-0 flex-col gap-1"><label htmlFor="g-period" className="ed-kicker">Period</label>
            <select id="g-period" name="period" value={f.period ?? ""} onChange={onSel("period")} className={SELECT}>
              <option value="">Every quarter</option>{g.options.periods.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select></div>
          <div className="flex min-w-0 flex-col gap-1"><label htmlFor="g-basis" className="ed-kicker">Read as</label>
            <select id="g-basis" name="basis" value={f.basis ?? ""} onChange={onSel("basis")} className={SELECT}>
              <option value="">Measured or AI estimate</option><option value="measured">{BASIS_WORD.measured} only</option><option value="ai">{BASIS_WORD.ai} only</option>
            </select></div>
          {g.options.sections.length > 0 && <div className="flex min-w-0 flex-col gap-1"><label htmlFor="g-section" className="ed-kicker">Page section</label>
            <select id="g-section" name="section" value={f.section ?? ""} onChange={onSel("section")} className={SELECT}>
              <option value="">First screen</option>{g.options.sections.map(s => <option key={s} value={s}>{CROP_SECTION_NAME[s]}</option>)}
            </select></div>}
          <noscript><button type="submit" className="c-raised ed-kicker">Show</button></noscript>
        </form>
      </RuleBox>
      {p && !p.walled && <p className="ed-body mt-4 max-w-[60ch]" role="status">{p.name} has no wall yet: fewer than {ILLUSTRATED_MIN} stored captures show it. It will get one once {ILLUSTRATED_MIN} do.</p>}
    </section>
    <section aria-label="Captures" className="ed-wrap mt-4">
      {g.total === 0 ? <p className="ed-body mt-4 max-w-[60ch]">No stored capture matches these filters. Widen the period, pick another pattern or switch the sector to All.</p>
        : <PagedWall key={JSON.stringify(f)} tiles={g.tiles} total={g.total} page={g.page} pages={g.pages} label={p ? `Captures showing ${p.name}` : "Captures showing a pattern"}
          hrefFor={n => `/patterns${galleryHref({ ...f, page: n })}`}
          fetchPage={async n => (await qc.fetchQuery(galleryQuery(gallerySearch({ ...parseGallerySearch(search), page: n })))).tiles} />}
    </section>
    <section aria-labelledby="g-all" className="ed-wrap mt-14">
      <h2 id="g-all" className="ed-h3">Every pattern with a wall</h2>
      <p className="ed-caption mt-1">At least {ILLUSTRATED_MIN} stored captures show each one. Open one for its brands, stage and stories.</p>
      <Ledger className="mt-3" label="Patterns" small rows={g.options.patterns.map(o => ({ key: o.key, href: `/patterns/${encodeURIComponent(o.key)}`, title: o.name, facts: [`${o.count} captures`, BASIS_WORD[o.basis]] }))} />
    </section>
    <ReadFooter terminal="/terminal?panel=patterns" />
  </DigestShell>;
}
