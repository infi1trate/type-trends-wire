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
