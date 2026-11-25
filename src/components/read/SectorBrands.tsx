// R1 · the sector page's brand list: category chips under the title, the sector's brands by name (filtered by ?category= / ?sub=).
// Reads the stored brands directory already used by /brands; the sector's headline signals above and below stay sector-wide.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { brandsQuery } from "@/lib/data";
import { CATEGORY_SHARE_MIN, CATEGORY_TOO_FEW, categoryChips, categoryLabel, classOf, inCategory, subcategoryChips } from "@/lib/categories";
import type { Pic } from "@/lib/pictures";
import { CategoryChips } from "./CategoryChips";
import { MarkedName } from "./BrandMark";

const useSectorRows = (sector: string, category: string | null, sub: string | null) => {
  const { data } = useSuspenseQuery(brandsQuery());
  const rows = data.sites.filter(s => s.sector === sector && inCategory(s, { category, sub })).sort((a, b) => (a.name ?? a.domain).localeCompare(b.name ?? b.domain));
  return { data, rows };
};
export const BRANDS_LIST_ID = "sector-brands";
/** R1b · phones show this many rows until "Show all N"; 768 px and up show every row. */
export const PHONE_ROWS = 10;

/** R1b · one row of category chips (plus sub-category chips once a category is chosen) directly under the report's standfirst. */
export function SectorChips({ sector, category, sub }: { sector: string; category: string | null; sub: string | null }) {
  const { data } = useSectorRows(sector, category, sub);
  return <CategoryChips chips={categoryChips(data.sites, sector)} subs={category ? subcategoryChips(data.sites, sector, category) : []} value={{ category, sub }} hash={BRANDS_LIST_ID}
    href={n => ({ to: "/sectors/$sector", params: { sector }, search: { ...(n.category ? { category: n.category } : {}), ...(n.sub ? { sub: n.sub } : {}) } })} />;
}

/** R1b · the sector's brands, below the small multiples: "Brands in <sector>" or "Brands in <category>". */
export function SectorBrands({ sector, sectorName, category, sub }: { sector: string; sectorName: string; category: string | null; sub: string | null }) {
  const { data, rows } = useSectorRows(sector, category, sub);
  const [all, setAll] = useState(false);
  const icons: Record<string, Pic> = (data as { icons?: Record<string, Pic> }).icons ?? {};
  const scope = sub ? categoryLabel(sub) : category ? categoryLabel(category) : sectorName;
  return <section aria-labelledby={`${BRANDS_LIST_ID}-h`} id={BRANDS_LIST_ID} className="ed-wrap mt-[var(--sys-gap-section)] scroll-mt-16" data-sector-brands="">
    <h2 id={`${BRANDS_LIST_ID}-h`} className="ed-kicker">Brands in {scope} <span className="ed-muted tabular-nums">{rows.length}</span></h2>
    <ul className="sector-brand-list mt-4" data-all={all ? "" : undefined}>{rows.map(s => { const c = classOf(s); return <li key={s.domain}>
      <Link to="/brands/$domain" params={{ domain: s.domain }} className="ed-tap no-underline sector-brand-row items-start">
        <MarkedName icon={icons[s.domain]} name={s.name ?? s.domain} reserve>{s.name ?? s.domain}</MarkedName>
        {c.subcategory && <span className="ed-kicker ed-muted">{categoryLabel(c.subcategory)}</span>}
      </Link></li>; })}</ul>
    {!all && rows.length > PHONE_ROWS && <button type="button" className="ledger-tag cat-chip mt-3 md:hidden" onClick={() => setAll(true)} data-show-all="">Show all {rows.length}</button>}
    {category && rows.length < CATEGORY_SHARE_MIN && <p className="ed-caption mt-3" data-too-few="">{CATEGORY_TOO_FEW}</p>}
  </section>;
}
