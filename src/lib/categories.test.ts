import { describe, expect, it } from 'vitest';
import { CATEGORY_BRANDS, CATEGORY_TREE, CATEGORY_SECTOR_LABELS, categoriesForSector, subcategoriesForCategory, classificationForDomain, classificationProblem, categoryLabel, categoryShareEligible } from './categories';
describe('R1 owner category map', () => {
  it('holds unique domains, ten sectors, 65 categories and sub-categories that match the file\'s own tree totals', () => {
    const subs = Object.values(CATEGORY_TREE).flatMap(c=>Object.values(c)).reduce((n,s)=>n+Object.keys(s).length,0);
    const total = Object.values(CATEGORY_TREE).flatMap(c=>Object.values(c)).flatMap(s=>Object.values(s)).reduce((n,v)=>n+v,0);
    expect(new Set(CATEGORY_BRANDS.map(b=>b.domain)).size).toBe(CATEGORY_BRANDS.length); expect(total).toBe(CATEGORY_BRANDS.length);
    expect(Object.keys(CATEGORY_TREE)).toHaveLength(10);
    expect(Object.values(CATEGORY_TREE).reduce((n,c)=>n+Object.keys(c).length,0)).toBe(65);
    expect(Object.values(CATEGORY_TREE).flatMap(c=>Object.values(c)).reduce((n,s)=>n+Object.keys(s).length,0)).toBe(subs);
  });
  it('every mapped library fixture has both levels under its unchanged sector, with exact tree counts', () => {
    for(const b of CATEGORY_BRANDS) expect(classificationProblem(b),b.domain).toBeNull();
    for(const [sector,cats] of Object.entries(CATEGORY_TREE)) for(const [category,subs] of Object.entries(cats)) for(const [subcategory,n] of Object.entries(subs)) expect(CATEGORY_BRANDS.filter(b=>b.sector===sector&&b.category===category&&b.subcategory===subcategory)).toHaveLength(n);
  });
  it('rejects missing and cross-sector classifications',()=>{expect(classificationProblem({sector:'fintech'})).not.toBeNull();expect(classificationProblem({sector:'fintech',category:'payments'})).not.toBeNull();expect(classificationProblem({sector:'fintech',category:'payments',subcategory:'skincare'})).not.toBeNull();});
  it('lists categories and sub-categories within sector scope',()=>{expect(categoriesForSector('fintech')).toEqual(['payments','banking','investing','business-finance']);expect(subcategoriesForCategory('fintech','payments')).toEqual(['processing','wallets','pay-later','transfers']);expect(classificationForDomain('netlify.com')).toEqual({domain:'netlify.com',sector:'dev-tools',category:'hosting',subcategory:'frontend-cloud'});expect(classificationForDomain('unmapped.example')).toBeNull();});
  it('uses owner labels and readable acronym overrides',()=>{expect(CATEGORY_SECTOR_LABELS['enterprise-saas']).toBe('Business software');expect(categoryLabel('pay-later')).toBe('Buy now, pay later');expect(categoryLabel('ai-coding')).toBe('AI coding');expect(categoryLabel('crm')).toBe('CRM');expect(categoryLabel('hr')).toBe('HR');expect(categoryLabel('womens-health')).toBe("Women's health");expect(categoryLabel('direct-to-patient')).toBe('Direct to patient');expect(categoryLabel('ai-observability')).toBe('AI observability');expect(categoryLabel('social-and-seo')).toBe('Social and SEO');expect(categoryLabel('spirits-and-wine')).toBe('Spirits and wine');expect(categoryLabel('home-cameras')).toBe('Home Cameras');});
  it('requires fifteen distinct well-covered brands for percentages',()=>{const rows=Array.from({length:15},(_,i)=>({domain:`brand-${i}`,wellCovered:true}));expect(categoryShareEligible(rows.slice(0,14))).toBe(false);expect(categoryShareEligible(rows)).toBe(true);expect(categoryShareEligible([...rows.slice(0,14),rows[0] ?? {domain:'brand-0',wellCovered:true}])).toBe(false);expect(categoryShareEligible(rows.map((r,i)=>({...r,wellCovered:i!==14})))).toBe(false);});
});

import { categoryChips, subcategoryChips, resolveCategory, inCategory, withClass, librarySummary, libraryLine, CATEGORY_TOO_FEW, CATEGORY_SHARE_MIN } from "./categories";
describe("R1 · chips, filters, the 15-brand floor, outputs and the summary", () => {
  const sites = [
    { domain: "stripe.com", sector: "fintech" }, { domain: "adyen.com", sector: "fintech" }, { domain: "paypal.com", sector: "fintech" },
    { domain: "x-bank.example", sector: "fintech", category: "banking", subcategory: "consumer" }, { domain: "linear.app", sector: "dev-tools" },
  ];
  it("chips count the sector's brands per category, in tree order, leaving empty ones out", () => {
    const c = categoryChips(sites, "fintech");
    expect(c.map(x => [x.slug, x.count])).toEqual([["payments", 3], ["banking", 1]]);
    expect(c[0]!.label).toBe("Payments");
    expect(subcategoryChips(sites, "fintech", "payments").map(x => x.slug)).toEqual(expect.arrayContaining(["processing"]));
  });
  it("?category= filters to a category of the sector; an unknown one is no filter", () => {
    expect(resolveCategory("fintech", "payments", null)).toEqual({ category: "payments", sub: null });
    expect(resolveCategory("fintech", "nonsense", null)).toEqual({ category: null, sub: null });
    expect(sites.filter(s => inCategory(s, { category: "payments", sub: null })).length).toBe(3);
  });
  it("?sub= filters to the sub-category, with or without its category named", () => {
    expect(resolveCategory("fintech", "payments", "processing")).toEqual({ category: "payments", sub: "processing" });
    expect(resolveCategory("fintech", null, "processing")).toEqual({ category: "payments", sub: "processing" });
    expect(resolveCategory("fintech", "banking", "processing")).toEqual({ category: "banking", sub: null });
    const f = resolveCategory("fintech", null, "processing");
    expect(sites.filter(s => inCategory(s, f)).every(s => withClass(s).subcategory === "processing")).toBe(true);
  });
  it("below 15 well-covered brands there is no percentage, with the exact line", () => {
    const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ domain: `b${i}.com`, wellCovered: true }));
    expect(CATEGORY_SHARE_MIN).toBe(15);
    expect(categoryShareEligible(rows(14))).toBe(false);
    expect(categoryShareEligible(rows(15))).toBe(true);
    expect(categoryShareEligible([...rows(14), { domain: "b0.com", wellCovered: true }])).toBe(false);
    expect(CATEGORY_TOO_FEW).toBe("Too few brands here to give a percentage yet.");
  });
  it("JSON and MCP outputs carry category and subcategory keys", () => {
    expect(withClass({ domain: "stripe.com", sector: "fintech" })).toMatchObject({ category: "payments", subcategory: "processing" });
    expect(withClass({ domain: "x-bank.example", category: "banking", subcategory: "consumer" })).toMatchObject({ category: "banking", subcategory: "consumer" });
    expect(withClass({ domain: "unknown.example" })).toMatchObject({ category: null, subcategory: null });
  });
  it("the library summary counts brands per sector and the categories / sub-categories at 15 brands", () => {
    const rows = [...Array.from({ length: 15 }, (_, i) => ({ domain: `p${i}.example`, sector: "fintech", category: "payments", subcategory: "processing" })),
      ...Array.from({ length: 3 }, (_, i) => ({ domain: `w${i}.example`, sector: "fintech", category: "payments", subcategory: "wallets" })), { domain: "z.example", sector: "ai" }];
    const s = librarySummary(rows);
    expect(s).toMatchObject({ brands: 19, sectors: { fintech: 18, ai: 1 }, categories: 1, categories_15: 1, subcategories: 2, subcategories_15: 1, unclassified: 1 });
    expect(libraryLine(s)).toBe("19 brands: fintech 18, ai 1; 1 of 1 categories and 1 of 2 sub-categories hold at least 15 brands; 1 unclassified.");
  });
});
