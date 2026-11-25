import { describe, expect, it } from 'vitest';
import { CATEGORY_BRANDS, CATEGORY_TREE, CATEGORY_SECTOR_LABELS, categoriesForSector, subcategoriesForCategory, classificationForDomain, classificationProblem, categoryLabel, categoryShareEligible } from './categories';
describe('R1 owner category map', () => {
  it('contains 328 unique domains, ten sectors, 65 categories and 174 sub-categories', () => {
    expect(CATEGORY_BRANDS).toHaveLength(328); expect(new Set(CATEGORY_BRANDS.map(b=>b.domain)).size).toBe(328);
    expect(Object.keys(CATEGORY_TREE)).toHaveLength(10);
    expect(Object.values(CATEGORY_TREE).reduce((n,c)=>n+Object.keys(c).length,0)).toBe(65);
    expect(Object.values(CATEGORY_TREE).flatMap(c=>Object.values(c)).reduce((n,s)=>n+Object.keys(s).length,0)).toBe(174);
  });
  it('every mapped library fixture has both levels under its unchanged sector, with exact tree counts', () => {
    for(const b of CATEGORY_BRANDS) expect(classificationProblem(b),b.domain).toBeNull();
    for(const [sector,cats] of Object.entries(CATEGORY_TREE)) for(const [category,subs] of Object.entries(cats)) for(const [subcategory,n] of Object.entries(subs)) expect(CATEGORY_BRANDS.filter(b=>b.sector===sector&&b.category===category&&b.subcategory===subcategory)).toHaveLength(n);
  });
  it('rejects missing and cross-sector classifications',()=>{expect(classificationProblem({sector:'fintech'})).not.toBeNull();expect(classificationProblem({sector:'fintech',category:'payments'})).not.toBeNull();expect(classificationProblem({sector:'fintech',category:'payments',subcategory:'skincare'})).not.toBeNull();});
  it('lists categories and sub-categories within sector scope',()=>{expect(categoriesForSector('fintech')).toEqual(['payments','banking','investing','business-finance']);expect(subcategoriesForCategory('fintech','payments')).toEqual(['processing','wallets','pay-later','transfers']);expect(classificationForDomain('netlify.com')).toEqual({domain:'netlify.com',sector:'dev-tools',category:'hosting',subcategory:'frontend-cloud'});expect(classificationForDomain('unmapped.example')).toBeNull();});
  it('uses owner labels and readable acronym overrides',()=>{expect(CATEGORY_SECTOR_LABELS['enterprise-saas']).toBe('Business software');expect(categoryLabel('pay-later')).toBe('Buy now, pay later');expect(categoryLabel('ai-coding')).toBe('AI coding');expect(categoryLabel('crm')).toBe('CRM');expect(categoryLabel('hr')).toBe('HR');expect(categoryLabel('womens-health')).toBe("Women's health");expect(categoryLabel('direct-to-patient')).toBe('Direct to patient');});
  it('requires fifteen distinct well-covered brands for percentages',()=>{const rows=Array.from({length:15},(_,i)=>({domain:`brand-${i}`,wellCovered:true}));expect(categoryShareEligible(rows.slice(0,14))).toBe(false);expect(categoryShareEligible(rows)).toBe(true);expect(categoryShareEligible([...rows.slice(0,14),rows[0] ?? {domain:'brand-0',wellCovered:true}])).toBe(false);expect(categoryShareEligible(rows.map((r,i)=>({...r,wellCovered:i!==14})))).toBe(false);});
});
