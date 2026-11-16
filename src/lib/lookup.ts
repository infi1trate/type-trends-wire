// The 404 page's lookup over tracked brands and staged signals: a plain substring match on names, domains and keys, brands first,
// at most LOOKUP_MAX results. Pure, so the server read and tests share it.
export const LOOKUP_MAX = 8;
export type LookupItem = { kind: "brand" | "signal"; label: string; detail: string; href: string };
const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
export function lookup(q: string, brands: { domain: string; name: string | null }[], signals: { key: string; name: string; dimension: string }[]): LookupItem[] {
  const n = norm(q).slice(0, 80);
  if (n.length < 2) return [];
  const score = (s: string) => { const t = norm(s); return t === n ? 0 : t.startsWith(n) ? 1 : t.includes(n) ? 2 : 9; };
  const b = brands.map(x => ({ x, s: Math.min(score(x.domain), x.name ? score(x.name) : 9) })).filter(r => r.s < 9).sort((a, c) => a.s - c.s || a.x.domain.localeCompare(c.x.domain))
    .map(({ x }): LookupItem => ({ kind: "brand", label: x.name || x.domain, detail: x.domain, href: `/brands/${encodeURIComponent(x.domain)}` }));
  const g = signals.map(x => ({ x, s: Math.min(score(x.name), score(x.key)) })).filter(r => r.s < 9).sort((a, c) => a.s - c.s || a.x.name.localeCompare(c.x.name))
    .map(({ x }): LookupItem => ({ kind: "signal", label: x.name, detail: `Signal · ${x.dimension}`, href: `/signals/${encodeURIComponent(x.key)}` }));
  const half = Math.ceil(LOOKUP_MAX / 2), out = [...b.slice(0, Math.max(half, LOOKUP_MAX - g.length)), ...g].slice(0, LOOKUP_MAX);
  return out;
}
