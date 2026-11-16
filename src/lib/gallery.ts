// THE PATTERN GALLERY, pure: stored captures as a wall of tiles. A tile is one home/desktop capture of a brand that shows a pattern:
// its section crop in one ink when one exists, otherwise the capture redrawn from its stored skeleton (at most TILE_BOXES boxes, the
// first screen only, so a wall stays light). Filters live in the URL; the server builds this model, caches it and the page renders it.
import type { Basis } from "./labels";
import { sectorName } from "./labels";
import { CROP_SECTIONS, isCropSection, toCrop, type Crop, type CropRow, type CropSection } from "./crops";
import { ILLUSTRATED_MIN } from "./crops";
import { brandPath } from "./ia";
import { resolveSector } from "./sector-lens";
import { dayText, qText } from "./data-stories/text";
import { typeWord } from "./data-stories/templates/frames";
import type { Box, Frame } from "./data-stories/types";

export const GALLERY_PAGE = 48;
/** A tile redraws at most this many boxes, and only the first screen (page pixels from the top). */
export const TILE_BOXES = 60, TILE_FOLD = 900;
/** A section crop belongs to a capture when taken within this many days of it. */
export const TILE_CROP_DAYS = 2;
/** Every LARGE_EVERY-th tile (from the first) is large; the rest are small. Deterministic, so a shared link draws the same wall. */
export const LARGE_EVERY = 9;
/** "Changed this month": captures either side of a recorded change in the last this-many days. */
export const CHANGED_DAYS = 30;

export type GalleryCapture = { id: number; domain: string; at: string; quarter: string | null; source: "live" | "wayback"; traits: string[] };
export type GalleryChange = { domain: string; at: string; type: string; before: number; after: number };
export type GalleryPattern = { key: string; name: string; basis: Basis };
export type GalleryIn = {
  now: number; sites: { domain: string; name: string | null; sector: string }[];
  /** Quarterly samples (one per brand per quarter) with the capture's traits; only captures that can be drawn (stored skeleton). */
  captures: GalleryCapture[];
  /** Recorded changes with the two captures either side (snapshot ids), for "changed" views. */
  changes: GalleryChange[];
  /** Every drawable stored capture by id (for the two sides of a change). */
  stamps: { id: number; domain: string; at: string; source: "live" | "wayback" }[];
  /** Pattern signals (headline layout + composites) and any extra keys a collection filters by, with names and basis. */
  patterns: GalleryPattern[]; keys: GalleryPattern[]; crops: CropRow[];
};
export type GalleryFilter = { sectors: string[]; pattern: string | null; period: string | null; since: string | null; basis: Basis | null; section: CropSection | null; changed: number | null; page: number };
export const NO_FILTER: GalleryFilter = { sectors: [], pattern: null, period: null, since: null, basis: null, section: null, changed: null, page: 1 };

export type Tile = { id: string; snapshot: number; domain: string; name: string; sector: string; at: string; day: string; quarter: string | null; source: "live" | "wayback"; label: string; href: string; size: "lg" | "sm"; crop: Crop | null; note: string | null };
/** The URL search a gallery view is shared with (only non-default fields). */
export type GallerySearch = { sector?: string; pattern?: string; period?: string; basis?: string; section?: string; page?: number };

const Q = /^(\d{4})Q([1-4])$/;
const qNum = (q: string) => { const m = Q.exec(q); return m ? Number(m[1]) * 4 + Number(m[2]) : NaN; };
const quarterOf = (iso: string) => { const d = new Date(iso); return `${d.getUTCFullYear()}Q${Math.floor(d.getUTCMonth() / 3) + 1}`; };

/** Parse URL search into a filter. Unknown values fall back to "everything"; the page reads the resolved filter, never the raw one. */
export function parseGallerySearch(s: Record<string, unknown>): GalleryFilter {
  const str = (k: string) => (typeof s[k] === "string" && (s[k] as string).length <= 80 ? (s[k] as string) : null);
  const sector = resolveSector(str("sector")), period = str("period"), b = str("basis"), sec = str("section");
  const page = Math.max(1, Math.min(999, Math.floor(Number(s["page"]) || 1)));
  return { ...NO_FILTER, sectors: sector === "all" ? [] : [sector], pattern: str("pattern"), period: period && (Q.test(period) || period === "latest") ? period : null,
    basis: b === "measured" || b === "ai" ? b : null, section: isCropSection(sec) ? sec : null, page };
}
export function gallerySearch(f: GalleryFilter): GallerySearch {
  return { ...(f.sectors.length === 1 ? { sector: f.sectors[0]! } : {}), ...(f.pattern ? { pattern: f.pattern } : {}), ...(f.period ? { period: f.period } : {}),
    ...(f.basis ? { basis: f.basis } : {}), ...(f.section ? { section: f.section } : {}), ...(f.page > 1 ? { page: f.page } : {}) };
}
/** The same view as a query string (no-JavaScript paged links and shareable URLs). */
export function galleryQuery(f: GalleryFilter): string {
  const s = gallerySearch(f), p = new URLSearchParams();
  for (const [k, v] of Object.entries(s)) p.set(k, String(v));
  const q = p.toString();
  return q ? `?${q}` : "";
}
/** "48 of 212 captures"; a later page alone reads "49–96 of 212 captures". */
export function countLine(from: number, to: number, total: number): string {
  if (!total) return "0 captures";
  const noun = total === 1 ? "capture" : "captures";
  return from <= 1 ? `${to} of ${total} ${noun}` : `${from}–${to} of ${total} ${noun}`;
}
/** A tile's accessible name: "neon.com, first screen, 16 Nov 2026" (the section name when the tile is a section crop). */
export const tileLabel = (domain: string, at: string, section: CropSection | null) => `${domain}, ${section ? `${section === "cta" ? "call to action" : section === "nav" ? "navigation" : section}` : "first screen"}, ${dayText(at)}`;

/** The crop a tile shows: the section's crop taken within TILE_CROP_DAYS of the capture (the hero when no section is chosen). */
export function tileCrop(crops: CropRow[], domain: string, at: string, section: CropSection | null): CropRow | null {
  const t = Date.parse(at), s = section ?? "hero";
  return crops.filter(r => r.domain === domain && r.section === s && r.viewport === "desktop" && Math.abs(Date.parse(r.captured_at) - t) <= TILE_CROP_DAYS * 864e5)
    .sort((a, b) => Math.abs(Date.parse(a.captured_at) - t) - Math.abs(Date.parse(b.captured_at) - t))[0] ?? null;
}
/** A frame cut to a tile: the first TILE_FOLD page pixels and at most TILE_BOXES boxes (sections first, then the largest). */
export function tileFrame(fr: Frame, max = TILE_BOXES, fold = TILE_FOLD): Frame {
  const h = Math.min(fr.h, fold), inFold = fr.boxes.filter(b => b[2] < h);
  const kept = [...inFold].sort((a, b) => Number(b[0] === "s") - Number(a[0] === "s") || b[3] * b[4] - a[3] * a[4]).slice(0, max)
    .sort((a, b) => a[2] - b[2] || a[1] - b[1]).map(b => [b[0], b[1], b[2], b[3], Math.min(b[4], h - b[2])] as Box);
  return { ...fr, h, boxes: kept };
}
/** Sections that can be offered as a filter: only those with at least one stored crop. */
export const sectionsWithCrops = (crops: CropRow[]) => CROP_SECTIONS.filter(s => crops.some(c => c.section === s && c.viewport === "desktop"));

type Cand = { snapshot: number; domain: string; at: string; quarter: string | null; source: "live" | "wayback"; traits: string[] | null; note: string | null };

export function galleryModel(i: GalleryIn, raw: GalleryFilter) {
  const site = new Map(i.sites.map(s => [s.domain, s])), allKeys = new Map([...i.keys, ...i.patterns].map(p => [p.key, p]));
  // Quarterly samples, one tile per stored capture (a capture can be the sample for more than one row).
  const seen = new Set<number>(), caps: Cand[] = [];
  for (const c of [...i.captures].sort((a, b) => (a.quarter ?? "").localeCompare(b.quarter ?? "") || a.id - b.id)) {
    if (seen.has(c.id) || !site.has(c.domain)) continue; seen.add(c.id);
    caps.push({ snapshot: c.id, domain: c.domain, at: c.at, quarter: c.quarter, source: c.source, traits: c.traits, note: null });
  }
  // Which patterns have a wall at all: the "illustrated" rule, counted in captures (a crop, or a capture redrawn from its skeleton).
  const counts = new Map<string, number>();
  for (const c of caps) for (const t of new Set(c.traits)) counts.set(t, (counts.get(t) ?? 0) + 1);
  const walled = i.patterns.filter(p => (counts.get(p.key) ?? 0) >= ILLUSTRATED_MIN);
  const walledKeys = new Set(walled.map(p => p.key));
  const sections = sectionsWithCrops(i.crops);
  const f: GalleryFilter = { ...raw, sectors: raw.sectors.filter(s => resolveSector(s) !== "all"), section: raw.section && sections.includes(raw.section) ? raw.section : null };
  const pattern = f.pattern ? allKeys.get(f.pattern) ?? null : null;
  if (f.pattern && !pattern) f.pattern = null;
  // A pattern signal without a wall shows nothing; a collection's extra key (say, dark mode) is not a pattern and always may.
  const patternWalled = !pattern || walledKeys.has(pattern.key) || !i.patterns.some(p => p.key === pattern.key);
  const periods = [...new Set(caps.map(c => c.quarter).filter((q): q is string => !!q && Q.test(q)))].sort((a, b) => qNum(b) - qNum(a));
  const period = f.period === "latest" ? periods[0] ?? null : f.period;

  // "Changed": the two captures either side of each recorded change in the window, newest change first.
  let pool: Cand[];
  if (f.changed) {
    const since = i.now - f.changed * 864e5, stamp = new Map(i.stamps.map(s => [s.id, s])), out: Cand[] = [], used = new Set<number>();
    for (const ch of [...i.changes].filter(c => Date.parse(c.at) >= since).sort((a, b) => b.at.localeCompare(a.at) || a.domain.localeCompare(b.domain))) {
      for (const [id, side] of [[ch.before, "Before"], [ch.after, "After"]] as const) {
        const s = stamp.get(id); if (!s || used.has(id) || !site.has(s.domain)) continue; used.add(id);
        out.push({ snapshot: id, domain: s.domain, at: s.at, quarter: quarterOf(s.at), source: s.source, traits: null, note: `${side} · ${typeWord(ch.type)}` });
      }
    }
    pool = out;
  } else pool = caps;

  const inSector = (d: string) => !f.sectors.length || f.sectors.includes(site.get(d)?.sector ?? "");
  const shows = (c: Cand) => {
    if (!c.traits) return !pattern && !f.basis; // change tiles carry no trait list; they match only unfiltered pattern views
    if (pattern) return patternWalled && c.traits.includes(pattern.key) && (!f.basis || pattern.basis === f.basis);
    return c.traits.some(t => walledKeys.has(t) && (!f.basis || allKeys.get(t)?.basis === f.basis));
  };
  const hasSection = (c: Cand) => !f.section || !!tileCrop(i.crops, c.domain, c.at, f.section);
  const matched = pool.filter(c => inSector(c.domain) && (!period || c.quarter === period) && (!f.since || (c.quarter != null && qNum(c.quarter) >= qNum(f.since))) && shows(c) && hasSection(c));
  const ordered = f.changed ? matched : [...matched].sort((a, b) => b.at.localeCompare(a.at) || a.domain.localeCompare(b.domain));
  const total = ordered.length, pages = Math.max(1, Math.ceil(total / GALLERY_PAGE)), page = Math.min(f.page, pages);
  const from = (page - 1) * GALLERY_PAGE;
  const tiles: Tile[] = ordered.slice(from, from + GALLERY_PAGE).map((c, k) => {
    const s = site.get(c.domain)!, crop = tileCrop(i.crops, c.domain, c.at, f.section);
    return { id: `${c.snapshot}`, snapshot: c.snapshot, domain: c.domain, name: s.name ?? c.domain, sector: s.sector, at: c.at, day: dayText(c.at), quarter: c.quarter, source: c.source,
      label: tileLabel(c.domain, c.at, crop && f.section ? f.section : null), href: brandPath(c.domain), size: (from + k) % LARGE_EVERY === 0 ? "lg" : "sm", crop: crop ? toCrop(crop) : null, note: c.note };
  });
  const resolved: GalleryFilter = { ...f, page };
  const at = (p: number) => galleryQuery({ ...resolved, page: p });
  return {
    filter: resolved, total, page, pages, tiles, countLine: countLine(total ? from + 1 : 0, from + tiles.length, total),
    pattern: pattern ? { ...pattern, walled: patternWalled, count: counts.get(pattern.key) ?? 0 } : null,
    options: {
      patterns: walled.map(p => ({ ...p, count: counts.get(p.key) ?? 0 })).sort((a, b) => a.name.localeCompare(b.name)),
      periods: periods.map(q => ({ value: q, label: qText(q) })),
      sections,
      sectors: f.sectors.map(s => ({ value: s, label: sectorName(s) })),
    },
    prev: page > 1 ? at(page - 1) : null, next: page < pages ? at(page + 1) : null,
    period,
  };
}
export type GalleryModel = ReturnType<typeof galleryModel>;
