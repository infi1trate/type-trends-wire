/** Owner's taxonomy; keys stay unchanged across labels, links and public outputs. */
import map from '@/data/category-map.json';
export type Classification = { sector: string; category: string; subcategory: string };
export const CATEGORY_TREE: Readonly<Record<string, Readonly<Record<string, Readonly<Record<string, number>>>>>> = map.tree;
export const CATEGORY_SECTOR_LABELS: Readonly<Record<string, string>> = map.labels;
export const CATEGORY_BRANDS = map.brands;
const LABEL_OVERRIDES: Readonly<Record<string, string>> = {
  'pay-later': 'Buy now, pay later', 'ai-coding': 'AI coding', 'ai-app-builders': 'AI app builders',
  crm: 'CRM', hr: 'HR', it: 'IT', apis: 'APIs', css: 'CSS',
  'api-tools': 'API tools', 'communications-apis': 'Communications APIs',
  'womens-health': "Women's health", 'direct-to-patient': 'Direct to patient',
};
export const categoryLabel = (slug: string) => LABEL_OVERRIDES[slug] ?? slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
export const categoriesForSector = (sector: string) => Object.keys(CATEGORY_TREE[sector] ?? {});
/** Category names repeat between sectors, so callers always supply their sector. */
export const subcategoriesForCategory = (sector: string, category: string) => Object.keys(CATEGORY_TREE[sector]?.[category] ?? {});
export function classificationProblem(row: { sector?: string | null; category?: string | null; subcategory?: string | null }): string | null {
  if (!row.sector || !CATEGORY_TREE[row.sector]) return 'Choose a sector from the category map.';
  if (!row.category || !CATEGORY_TREE[row.sector]?.[row.category]) return 'Choose a category in this sector.';
  if (!row.subcategory || CATEGORY_TREE[row.sector]?.[row.category]?.[row.subcategory] === undefined) return 'Choose a sub-category in this category.';
  return null;
}
const byDomain = new Map(map.brands.map(b => [b.domain, b]));
export const classificationForDomain = (domain: string): Classification | null => byDomain.get(domain) ?? null;
export const CATEGORY_SHARE_MIN = 15;
export const CATEGORY_TOO_FEW = 'Too few brands here to give a percentage yet.';
/** Count well-covered distinct brands, not captures; duplicate captures cannot meet the floor. */
export function categoryShareEligible(rows: readonly { domain: string; wellCovered: boolean }[]): boolean {
  return new Set(rows.filter(r => r.wellCovered).map(r => r.domain)).size >= CATEGORY_SHARE_MIN;
}
/** A brand's category pair: the stored row when it carries one, otherwise the owner's map. */
export function classOf(row: { domain: string; category?: string | null; subcategory?: string | null }): { category: string | null; subcategory: string | null } {
  if (row.category) return { category: row.category, subcategory: row.subcategory ?? null };
  const m = byDomain.get(row.domain);
  return { category: m?.category ?? null, subcategory: m?.subcategory ?? null };
}
export type CategoryChip = { slug: string; label: string; count: number };
/** Chips in tree order with the brand count among `sites`; empty categories are left out. */
export function categoryChips(sites: readonly { domain: string; sector: string; category?: string | null }[], sector: string): CategoryChip[] {
  const n = new Map<string, number>();
  for (const s of sites) if (s.sector === sector) { const c = classOf(s).category; if (c) n.set(c, (n.get(c) ?? 0) + 1); }
  return categoriesForSector(sector).flatMap(slug => (n.get(slug) ? [{ slug, label: categoryLabel(slug), count: n.get(slug)! }] : []));
}
export function subcategoryChips(sites: readonly { domain: string; sector: string; category?: string | null; subcategory?: string | null }[], sector: string, category: string): CategoryChip[] {
  const n = new Map<string, number>();
  for (const s of sites) if (s.sector === sector) { const c = classOf(s); if (c.category === category && c.subcategory) n.set(c.subcategory, (n.get(c.subcategory) ?? 0) + 1); }
  return subcategoriesForCategory(sector, category).flatMap(slug => (n.get(slug) ? [{ slug, label: categoryLabel(slug), count: n.get(slug)! }] : []));
}
/** Keeps only a category in the sector's tree and a sub-category in that category; anything else reads as no filter. */
export function resolveCategory(sector: string, category?: string | null, sub?: string | null): { category: string | null; sub: string | null } {
  const c = category && CATEGORY_TREE[sector]?.[category] ? category : null;
  const s = c && sub && CATEGORY_TREE[sector]?.[c]?.[sub] !== undefined ? sub : null;
  return { category: c, sub: s };
}
export function inCategory(row: { domain: string; category?: string | null; subcategory?: string | null }, f: { category: string | null; sub: string | null }): boolean {
  if (!f.category) return true;
  const c = classOf(row);
  return c.category === f.category && (!f.sub || c.subcategory === f.sub);
}
