// R1 · category and sub-category chips for one sector, in the existing chip style. Choosing one changes only the address (?category=, ?sub=).
import { Link } from "@tanstack/react-router";
import type { CategoryChip } from "@/lib/categories";

type To = { category: string | null; sub: string | null };
export function CategoryChips({ chips, subs, value, href, hash }: { hash?: string; chips: CategoryChip[]; subs: CategoryChip[]; value: To; href: (next: To) => { to: string; search: Record<string, string | undefined>; params?: Record<string, string> } }) {
  if (!chips.length) return null;
  const chip = (c: CategoryChip, on: boolean, next: To) => { const h = href(next); return <li key={c.slug}>
    <Link to={h.to} params={h.params as never} search={h.search as never} resetScroll={false} {...(hash ? { hash } : {})} aria-current={on ? "true" : undefined} className={`ledger-tag cat-chip no-underline ${on ? "cat-chip-on" : ""}`} data-category-chip={c.slug}>{c.label} <span className="ed-muted tabular-nums">{c.count}</span></Link>
  </li>; };
  return <nav aria-label="Categories" className="mt-4" data-category-chips="">
    <ul className="flex flex-wrap gap-2">{chips.map(c => chip(c, value.category === c.slug, value.category === c.slug ? { category: null, sub: null } : { category: c.slug, sub: null }))}</ul>
    {value.category && subs.length > 0 && <ul className="mt-2 flex flex-wrap gap-2" aria-label="Sub-categories">{subs.map(s => chip(s, value.sub === s.slug, { category: value.category, sub: value.sub === s.slug ? null : s.slug }))}</ul>}
  </nav>;
}
