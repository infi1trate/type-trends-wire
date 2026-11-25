// R1 · the sector page's brand list: category chips under the title, the sector's brands by name (filtered by ?category= / ?sub=).
// Reads the stored brands directory already used by /brands; the sector's headline signals above and below stay sector-wide.
import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { brandsQuery } from "@/lib/data";
import { CATEGORY_SHARE_MIN, CATEGORY_TOO_FEW, categoryChips, categoryLabel, classOf, inCategory, subcategoryChips } from "@/lib/categories";
import type { Pic } from "@/lib/pictures";
import { CategoryChips } from "./CategoryChips";
import { MarkedName } from "./BrandMark";

export function SectorBrands({ sector, category, sub }: { sector: string; category: string | null; sub: string | null }) {
  const { data } = useSuspenseQuery(brandsQuery());
  const icons: Record<string, Pic> = (data as { icons?: Record<string, Pic> }).icons ?? {};
  const rows = data.sites.filter(s => s.sector === sector && inCategory(s, { category, sub })).sort((a, b) => (a.name ?? a.domain).localeCompare(b.name ?? b.domain));
  const scope = sub ? categoryLabel(sub) : category ? categoryLabel(category) : null;
  return <section aria-labelledby="sector-brands" className="ed-wrap mt-[var(--sys-gap-section)]" data-sector-brands="">
    <h2 id="sector-brands" className="ed-kicker">Brands{scope ? ` · ${scope}` : ""} <span className="ed-muted tabular-nums">{rows.length}</span></h2>
    <CategoryChips chips={categoryChips(data.sites, sector)} subs={category ? subcategoryChips(data.sites, sector, category) : []} value={{ category, sub }}
      href={n => ({ to: "/sectors/$sector", params: { sector }, search: { ...(n.category ? { category: n.category } : {}), ...(n.sub ? { sub: n.sub } : {}) } })} />
    <ul className="sector-brand-list mt-4">{rows.map(s => { const c = classOf(s); return <li key={s.domain}>
      <Link to="/brands/$domain" params={{ domain: s.domain }} className="ed-tap no-underline sector-brand-row">
        <MarkedName icon={icons[s.domain]} name={s.name ?? s.domain} reserve>{s.name ?? s.domain}</MarkedName>
        {c.subcategory && <span className="ed-kicker ed-muted">{categoryLabel(c.subcategory)}</span>}
      </Link></li>; })}</ul>
    {category && rows.length < CATEGORY_SHARE_MIN && <p className="ed-caption mt-3" data-too-few="">{CATEGORY_TOO_FEW}</p>}
  </section>;
}
