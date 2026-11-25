// B2 · PAGE ANATOMY (pure, proposed form "page-anatomy"): a homepage as one vertical strip, each section a band whose height is its share
// of the page; many pages as strips side by side sorted by where a chosen role starts, under one "typical page" strip (each role's
// median start and median share among the pages shown); over time, one typical strip per year with 15 or more pages read.
import type { Section } from "@/lib/structure";
import { ROLE_NAME, STRUCTURE_FLOOR } from "@/lib/structure";

/** The fixed role palette: paper, ink tints, pink, yellow and green only. Hero is always the strongest (solid ink). */
export const FILLS = {
  ink: "var(--sys-color-ink)", ink60: "color-mix(in srgb, var(--sys-color-ink) 60%, var(--sys-color-page))",
  ink30: "color-mix(in srgb, var(--sys-color-ink) 30%, var(--sys-color-page))", ink12: "color-mix(in srgb, var(--sys-color-ink) 12%, var(--sys-color-page))",
  pink: "var(--tk-accent-1)", yellow: "var(--sys-color-highlight)", green: "var(--sys-color-positive)", paper: "var(--sys-color-page)",
} as const;
export type Fill = keyof typeof FILLS;
export const ROLE_FILL: Record<string, Fill> = {
  hero: "ink", logos: "ink12", cards: "ink30", feature: "ink30", stats: "yellow", testimonials: "pink", pricing: "green", faq: "ink12",
  how: "ink30", integrations: "ink12", work: "ink60", news: "ink12", about: "ink12", signup: "green", code: "ink60", video: "ink60",
  ask: "yellow", content: "paper", footer: "ink60",
};
export const fillOf = (role: string): Fill => ROLE_FILL[role] ?? "paper";
/** Text drawn on a band: paper on the dark fills, ink elsewhere. */
export const textOn = (f: Fill): "ink" | "paper" => (f === "ink" || f === "ink60" ? "paper" : "ink");
export const roleName = (r: string) => ROLE_NAME[r] ?? r.replace(/^./, c => c.toUpperCase());

export type Band = { role: string; index: number; y: number; h: number; share: number; start: number };
/** One page's bands scaled to `height`: proportional to each section's height over the sum of section heights, so they sum to the strip. */
export function stripBands(sections: readonly Section[] | null, height: number): Band[] {
  const secs = (sections ?? []).filter(s => s.h > 0).sort((a, b) => a.y - b.y), sum = secs.reduce((t, s) => t + s.h, 0);
  if (!sum) return [];
  let at = 0;
  return secs.map((s, i) => { const share = s.h / sum, b = { role: s.r, index: i, y: at * height, h: share * height, share, start: at }; at += share; return b; });
}
export type Page = { domain: string; name: string; sections: readonly Section[] | null };
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2) : 0; };
/** The typical page: roles present on at least half the pages, ordered by median start, heights from the median share (normalised). */
export function typicalPage(pages: readonly Page[]): { role: string; start: number; share: number; n: number }[] {
  const by = new Map<string, { start: number[]; share: number[]; seen: Set<string> }>();
  for (const p of pages) for (const b of stripBands(p.sections, 1)) {
    const e = by.get(b.role) ?? { start: [], share: [], seen: new Set<string>() };
    if (!e.seen.has(p.domain)) { e.seen.add(p.domain); e.start.push(b.start); e.share.push(b.share); }
    by.set(b.role, e);
  }
  const read = pages.filter(p => stripBands(p.sections, 1).length).length;
  const rows = [...by].filter(([, e]) => e.start.length * 2 >= read).map(([role, e]) => ({ role, start: median(e.start), share: median(e.share), n: e.start.length }))
    .sort((a, b) => a.start - b.start || a.role.localeCompare(b.role));
  const sum = rows.reduce((t, r) => t + r.share, 0) || 1;
  return rows.map(r => ({ ...r, share: r.share / sum }));
}
/** Typical-page sections (as a synthetic page) so the one strip drawing serves both. */
export const typicalSections = (t: ReturnType<typeof typicalPage>): Section[] => { let y = 0; return t.map(r => { const s = { r: r.role, y, h: r.share * 1000, t: null }; y += s.h; return s; }); };
/** Pages sorted by where `role` first starts (pages without it last, then by name). */
export function sortByRole(pages: readonly Page[], role: string): Page[] {
  const at = (p: Page) => stripBands(p.sections, 1).find(b => b.role === role)?.start ?? Infinity;
  return [...pages].filter(p => stripBands(p.sections, 1).length).sort((a, b) => at(a) - at(b) || a.name.localeCompare(b.name));
}
/** Many-pages layout: strip width and gap that fit `width` (at least 6 px a strip), or null below the 15-page floor. */
export function multiplesLayout(n: number, width: number): { strip: number; gap: number; rows: number; perRow: number } | null {
  if (n < STRUCTURE_FLOOR) return null;
  const gap = width < 600 ? 2 : 4, perRow = Math.max(1, Math.min(n, Math.floor((width + gap) / (6 + gap)))), rows = Math.ceil(n / perRow);
  const strip = Math.max(6, Math.floor((width - (perRow - 1) * gap) / perRow));
  return { strip: Math.min(strip, 28), gap, rows, perRow };
}
/** The readout: "Linear · section 4 of 9 · Quotes · 11% of the page · starts 46% down". */
export const bandLine = (name: string, b: Band, of: number) => `${name} · section ${b.index + 1} of ${of} · ${roleName(b.role)} · ${Math.round(b.share * 100)}% of the page · starts ${Math.round(b.start * 100)}% down`;
/** Over time: the quarters (newest per year) with at least the floor of pages read; slug began reading structure in late November 2026. */
export function yearsRead(byQuarter: Record<string, number>): string[] {
  const ok = Object.entries(byQuarter).filter(([, n]) => n >= STRUCTURE_FLOOR).map(([q]) => q).sort();
  const last = new Map<string, string>(); for (const q of ok) last.set(q.slice(0, 4), q);
  return [...last.values()].slice(-6);
}
export const STRUCTURE_BEGAN = "slug began reading page structure in late November 2026";
