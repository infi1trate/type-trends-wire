// I3 · LEAD PICTURES CHOSEN BY RULE. One pure plan per subject (a story, a study, a Digest week) from data already loaded plus one
// batched picture lookup (lead-picture.server.ts). Every surface with a lead picture slot renders this plan; nothing here fetches.
// Pictures are the brands' own published material only (section crops, fold thumbnails, social cards), credited, linked and reportable;
// never stock, never generated, never a drawn wireframe when a real crop exists, never slug's link-preview image.
import type { Crop } from "./crops";
import type { Cover, Pic } from "./pictures";
import type { Thumb } from "./thumbs";

export type LeadKind = "pair" | "single" | "mosaic" | "words" | "swatches" | "card" | "chart" | "marks" | "none";
export type LeadItem = {
  domain: string; section: string; date: string; src: string; srcSet: string | null; width: number; height: number;
  /** "crop:<path>", "thumb:<path>" or "card:<path>": the stored object the picture is. */ asset: string;
  credit: string; alt: string; live: string; report: string; role: "before" | "after" | null;
};
export type LeadWords = { domain: string | null; name: string; line: string; href: string | null };
export type LeadPlan = {
  kind: LeadKind; items: LeadItem[]; rule: LeadRule; caption: string | null;
  words?: LeadWords[]; swatches?: { domain: string; before: string[]; after: string[] }; marks?: { domain: string; name: string; icon: Pic }[];
};
export const LEAD_RULES = {
  pair: "A single-brand change with stored captures of the changed section either side of it: before and after.",
  single: "A single-brand change with one stored capture of the changed section after it.",
  swatches: "A palette-only change: the measured colours before and after.",
  roundup: "A roundup: up to four members' first screens after their change.",
  census: "A census: up to six of the exact headlines it counted.",
  seasonal: "A seasonal or sale piece: up to four members' first screens from the cited dates.",
  breakout: "A breakout: up to four of the named sector brands' first screens.",
  whiteSpace: "A white space: up to four of the named brands outside the sector that use it.",
  news: "Outside news: the subject brand's own social card, else its hero crop.",
  study: "A study leads with its chart.",
  digest: "The Digest keeps the cover its edition chose.",
  fallbackCrops: "No picture by type: the subject brands' latest first screens.",
  fallbackCard: "No first screen: the subject brand's own social card.",
  fallbackChart: "No picture of a page: the signal's trail.",
  fallbackMarks: "No picture and no trail: the brands' marks.",
  none: "Nothing to show.",
} as const;
export type LeadRule = keyof typeof LEAD_RULES;
export const CAROUSEL_CAPTION = "one frame of a rotating hero";
export const MOSAIC_MAX = 4, WORDS_MAX = 6, LEAD_MIN_WIDTH = 480;

// QUALITY -----------------------------------------------------------------------------------------------------------------------------
/** Below this many bytes per pixel a WebP section crop is near-blank or flat (calibrated on 1,369 stored crops, I3). */
export const FLAT_BYTES_PER_PX = 0.009;
/** Pixel thresholds (stored in crop_quality): one luminance level covering this share of the picture, or this little local contrast. */
export const FLAT_TOP_SHARE = 0.97, FLAT_EDGE_MEAN = 1.0;
export type Quality = { ok: boolean; reason: string | null };
export type PixelStats = { std: number; top: number; edges: number };
/** The lead-quality rule: source at least 480 px wide, not near-blank or flat, brand not opted out. Pixel stats decide when measured;
 *  otherwise the stored byte density does. */
export function leadQuality(c: { width: number; height: number; bytes?: number | null; domain: string }, o: { stats?: PixelStats | null; optedOut?: ReadonlySet<string> } = {}): Quality {
  if (o.optedOut?.has(c.domain)) return { ok: false, reason: "opted out" };
  if (c.width < LEAD_MIN_WIDTH) return { ok: false, reason: `source under ${LEAD_MIN_WIDTH} px wide` };
  if (o.stats) {
    if (o.stats.top >= FLAT_TOP_SHARE) return { ok: false, reason: "near-blank (one tone covers the picture)" };
    if (o.stats.edges < FLAT_EDGE_MEAN) return { ok: false, reason: "flat (almost no detail)" };
    return { ok: true, reason: null };
  }
  if (c.bytes == null) return { ok: false, reason: "not measured" };
  return c.bytes / Math.max(1, c.width * c.height) < FLAT_BYTES_PER_PX ? { ok: false, reason: "near-blank or flat (byte density)" } : { ok: true, reason: null };
}

// INPUT -------------------------------------------------------------------------------------------------------------------------------
export type LeadStoryIn = {
  id: string; type: string; domains: string[]; happened_at: string;
  evidence?: { compare: { before: Crop; after: Crop } | null; after?: Crop | null; grid: { domain: string; crop: Crop | null }[] | null } | null;
  /** Fields the story's changes touch (palette-only changes draw swatches). */ fields?: string[];
  palette?: { before: string[]; after: string[] } | null;
  census?: { name: string; line: string; href: string | null }[] | null;
  /** Dates the story cites (YYYY-MM-DD), for seasonal and sale pieces. */ dates?: string[];
  chart?: boolean;
};
export type LeadPics = {
  okCrop: (c: Crop) => boolean;
  hero: (domain: string) => Crop | null;
  thumb: (domain: string) => Thumb | null;
  card: (domain: string) => Cover | null;
  carousel: (domain: string) => boolean;
  name: (domain: string) => string;
  icon: (domain: string) => Pic | null;
};
export type LeadSubject = { kind: "story"; story: LeadStoryIn } | { kind: "study"; chart: boolean } | { kind: "digest"; cover: "picture" | "chart" | "none" };

// ITEMS -------------------------------------------------------------------------------------------------------------------------------
const day = (iso: string) => iso.slice(0, 10);
const pathOf = (src: string) => src.replace(/^\/(?:crops|thumbs|assets)\//, "");
export const cropItem = (c: Crop, role: LeadItem["role"] = null): LeadItem => ({
  domain: c.domain, section: c.sectionName, date: day(c.captured_at), src: c.src, srcSet: null, width: c.width, height: c.height, asset: `crop:${pathOf(c.src)}`,
  credit: c.caption, alt: c.alt, live: c.live, report: c.report, role,
});
const thumbItem = (t: Thumb, report: string): LeadItem => ({
  domain: t.domain, section: "First screen", date: day(t.captured_at), src: t.src, srcSet: t.srcSet || null, width: t.width, height: t.height, asset: `thumb:${pathOf(t.src)}`,
  credit: t.caption, alt: t.alt, live: t.live, report, role: "after",
});
const cardItem = (c: Cover): LeadItem => ({ domain: c.domain, section: c.kind === "card" ? "Social card" : "Hero", date: day(c.at), src: c.src, srcSet: null, width: c.width, height: c.height, asset: `${c.kind}:${pathOf(c.src)}`, credit: c.credit, alt: c.alt, live: c.live, report: c.report, role: null });

/** One brand's first screen after `since` (or its latest): the fold thumbnail with its smaller renditions, else its hero crop. */
function firstScreen(d: string, p: LeadPics, since: string | null, report: (d: string) => string): LeadItem | null {
  const t = p.thumb(d);
  if (t && (!since || t.captured_at >= since)) return thumbItem(t, report(d));
  const h = p.hero(d);
  if (h && p.okCrop(h) && (!since || h.captured_at >= since || h.last_seen_at >= since)) return cropItem(h, "after");
  return null;
}
/** A rotating first screen is captioned as one frame: alone, or named when several pictures share the caption. */
const captionOf = (items: LeadItem[], p: LeadPics, lead: string) => {
  const rotating = items.filter(i => p.carousel(i.domain));
  if (!rotating.length) return lead;
  return items.length === 1 ? `${lead} · ${CAROUSEL_CAPTION}` : `${lead} · ${rotating.map(i => `${p.name(i.domain)}: ${CAROUSEL_CAPTION}`).join(" · ")}`;
};
const plan = (kind: LeadKind, rule: LeadRule, items: LeadItem[], caption: string | null, extra: Partial<LeadPlan> = {}): LeadPlan => ({ kind, rule, items, caption, ...extra });

function fallback(s: LeadStoryIn, p: LeadPics): LeadPlan {
  const reportOf = (d: string) => p.card(d)?.report ?? p.hero(d)?.report ?? "/what-we-show#ed-w-images";
  const screens = s.domains.slice(0, MOSAIC_MAX).flatMap(d => { const x = firstScreen(d, p, null, reportOf); return x ? [x] : []; });
  if (screens.length === 1 && s.domains.length === 1) return plan("single", "fallbackCrops", screens, captionOf(screens, p, `${p.name(screens[0]!.domain)} · first screen · ${screens[0]!.date}`));
  if (screens.length >= 2) return plan("mosaic", "fallbackCrops", screens, captionOf(screens, p, "First screens"));
  const card = s.domains[0] ? p.card(s.domains[0]) : null;
  if (card && card.kind === "card") return plan("card", "fallbackCard", [cardItem(card)], card.credit);
  if (s.chart) return plan("chart", "fallbackChart", [], null);
  const marks = s.domains.flatMap(d => { const icon = p.icon(d); return icon ? [{ domain: d, name: p.name(d), icon }] : []; }).slice(0, 6);
  if (marks.length) return plan("marks", "fallbackMarks", [], null, { marks });
  return plan("none", "none", [], null);
}

/** The lead picture of one subject. */
export function leadPicture(subject: LeadSubject, p: LeadPics): LeadPlan {
  if (subject.kind === "study") return subject.chart ? plan("chart", "study", [], null) : plan("none", "none", [], null);
  if (subject.kind === "digest") return plan(subject.cover === "picture" ? "card" : subject.cover === "chart" ? "chart" : "none", "digest", [], null);
  const s = subject.story, ev = s.evidence ?? null, id = s.id;
  const reportOf = (d: string) => p.card(d)?.report ?? p.hero(d)?.report ?? "/what-we-show#ed-w-images";
  const mosaicOf = (domains: string[], since: string | null) => domains.flatMap(d => { const x = firstScreen(d, p, since, reportOf); return x ? [x] : []; }).slice(0, MOSAIC_MAX);
  const census = id.startsWith("census:"), sale = id.startsWith("census:sale"), seasonal = id.startsWith("seasonal:");
  if (census && !sale) {
    const words = (s.census ?? []).slice(0, WORDS_MAX).map(l => ({ domain: l.href?.startsWith("/brands/") ? decodeURIComponent(l.href.slice(8)) : null, name: l.name, line: l.line, href: l.href }));
    if (words.length) return plan("words", "census", [], "The exact headlines, as captured", { words });
    return fallback(s, p);
  }
  if (sale || seasonal) {
    const since = [...(s.dates ?? [])].sort()[0] ?? null, tiles = mosaicOf(s.domains, since ? `${since}T00:00:00Z` : null);
    if (tiles.length >= 2) return plan("mosaic", "seasonal", tiles, captionOf(tiles, p, "First screens from the cited dates"));
    return fallback(s, p);
  }
  if (s.type === "move" || s.type === "rebrand" || s.type === "counter_move") {
    const fields = s.fields ?? [];
    if (s.palette && fields.length && fields.every(f => f === "palette" || f === "accent")) return plan("swatches", "swatches", [], "Measured colours, before and after", { swatches: { domain: s.domains[0] ?? "", ...s.palette } });
    if (ev?.compare && p.okCrop(ev.compare.before) && p.okCrop(ev.compare.after)) {
      const items = [cropItem(ev.compare.before, "before"), cropItem(ev.compare.after, "after")];
      return plan("pair", "pair", items, captionOf(items, p, `${ev.compare.after.sectionName} · before ${items[0]!.date}, after ${items[1]!.date}`));
    }
    const after = ev?.after ?? ev?.compare?.after ?? null;
    if (after && p.okCrop(after)) { const items = [cropItem(after, "after")]; return plan("single", "single", items, captionOf(items, p, `${after.sectionName} · after · ${items[0]!.date}`)); }
    return fallback(s, p);
  }
  if (s.type === "roundup") {
    // The same first screen, lighter: a member's fold thumbnail (with 320/640 px renditions) taken no earlier than its kept crop.
    const fromGrid = (ev?.grid ?? []).flatMap(g => {
      if (!g.crop || !p.okCrop(g.crop)) return [];
      const t = p.thumb(g.domain);
      return [t && t.captured_at.slice(0, 10) >= g.crop.captured_at.slice(0, 10) ? thumbItem(t, g.crop.report) : cropItem(g.crop, "after")];
    });
    const tiles = (fromGrid.length >= 2 ? fromGrid : mosaicOf(s.domains, null)).slice(0, MOSAIC_MAX);
    if (tiles.length >= 2) return plan("mosaic", "roundup", tiles, captionOf(tiles, p, "After the change"));
    return fallback(s, p);
  }
  if (s.type === "breakout" || s.type === "first_seen" || s.type === "white_space") {
    const tiles = mosaicOf(s.domains, null);
    if (tiles.length >= 2) return plan("mosaic", s.type === "white_space" ? "whiteSpace" : "breakout", tiles, captionOf(tiles, p, s.type === "white_space" ? "Named brands outside the sector" : "Named brands in the sector"));
    return fallback(s, p);
  }
  if (s.type === "news") {
    const d = s.domains[0];
    const card = d ? p.card(d) : null;
    if (card && card.kind === "card") return plan("card", "news", [cardItem(card)], card.credit);
    const h = d ? p.hero(d) : null;
    if (h && p.okCrop(h)) { const items = [cropItem(h, null)]; return plan("single", "news", items, captionOf(items, p, h.caption)); }
    return s.chart ? plan("chart", "fallbackChart", [], null) : plan("none", "none", [], null);
  }
  return fallback(s, p);
}
/** The plan's first real picture (cards and rows show one), or null. */
export const leadThumb = (pl: LeadPlan): LeadItem | null => pl.items.find(i => i.role !== "before") ?? pl.items[0] ?? null;
/** The Data view's "Pictures" rows: what each item is and where it came from. */
export const pictureRows = (pl: LeadPlan) => pl.items.map(i => ({ brand: i.domain, section: i.section, captured: i.date, role: i.role ?? "", asset: i.asset, rule: LEAD_RULES[pl.rule], live: i.live }));
