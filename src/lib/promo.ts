// Seasonal and promotional skins (pure, dependency-free): a sale or holiday headline, sub-headline or button on either capture of a
// change (entering a sale, moving between two sales, leaving a sale) makes it seasonal. Seasonal changes stay in the data as measured; they never run as stories.
/** Terms matched case-insensitively on word boundaries ("wholesale" and "Salesforce" do not match "sale"). Edit here only. */
export const PROMO_TERMS = ["black friday", "cyber monday", "cyber week", "holiday", "gift guide", "gifting", "sale", "deals", "% off", "percent off", "<currency amount> off", "save $", "save up to", "limited time", "free shipping", "doorbuster", "clearance"] as const;
const L = "(?<![\\p{L}\\p{N}])", R = "(?![\\p{L}\\p{N}])";
const WORDS = ["black friday", "cyber monday", "cyber week", "holidays?", "gift guides?", "gifting", "sale", "deals", "percent off", "save up to", "limited[- ]time", "free shipping", "doorbusters?", "clearance"];
const PATTERNS: [string, RegExp][] = [
  ...WORDS.map((w): [string, RegExp] => [w.replace(/\?|s\?$/g, "").replace("[- ]", " "), new RegExp(`${L}${w.replace(/ /g, "\\s+")}${R}`, "iu")]),
  ["% off", /\d\s?%\s*off(?![\p{L}\p{N}])/iu],
  ["<currency amount> off", /(?:[$€£¥]\s?\d[\d,.]*k?|(?<![\p{L}\p{N}])(?:usd|eur|gbp)\s?\d[\d,.]*k?)\+?\s+off(?![\p{L}\p{N}])/iu],
  ["save $", /(?<![\p{L}\p{N}])save\s+[$€£¥]/iu],
];
/** The promo term a text reads like, or null. */
export function promoSignal(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = text.replace(/\s+/g, " ");
  for (const [term, re] of PATTERNS) if (re.test(t)) return term;
  return null;
}
const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
/** The texts a capture's promo check reads: headline, first sub-headline and the first three button labels (library lexicon). */
export function promoTexts(r: { lx_h1?: unknown; lx_h2?: unknown; lx_ctas?: unknown } | null | undefined): string[] {
  if (!r) return [];
  const h2 = Array.isArray(r.lx_h2) ? r.lx_h2.map(s).filter((x): x is string => !!x)[0] ?? null : s(r.lx_h2);
  const ctas = Array.isArray(r.lx_ctas) ? r.lx_ctas.map(s).filter((x): x is string => !!x).slice(0, 3) : [];
  return [s(r.lx_h1), h2, ...ctas].filter((x): x is string => !!x);
}
/** PostgREST select fragment for promoTexts (library_snapshots). */
export const PROMO_COLS = "lx_h1:signals->lexicon->>h1,lx_h2:signals->lexicon->h2,lx_ctas:signals->lexicon->ctas";
export const isPromo = (texts: readonly string[] | null | undefined) => (texts ?? []).some(t => promoSignal(t) !== null);
/** Seasonal: the after capture or the before capture (when there is one) reads like a promotion. */
export const seasonalChange = (after: readonly string[] | null | undefined, before: readonly string[] | null | undefined) => isPromo(after) || isPromo(before);
/** Event ids whose change is seasonal, from snapshot texts keyed by snapshot id. */
export function seasonalEventIds(events: { id: number; snapshot_id?: number | null; prev_snapshot_id?: number | null }[], texts: ReadonlyMap<number, string[]>): Set<number> {
  const out = new Set<number>();
  for (const e of events) if (e.snapshot_id != null && seasonalChange(texts.get(e.snapshot_id), e.prev_snapshot_id != null ? texts.get(e.prev_snapshot_id) : null)) out.add(e.id);
  return out;
}
/** Changes held on a seasonal capture: palette, accent, theme, hero media, headline copy, layout (and the AI reads of the same page). */
export const SEASONAL_HELD_EVENTS = new Set(["palette_shift", "theme_flip", "layout_change", "message_pivot", "redesign", "imagery_shift", "aesthetic_shift"]);
export const SEASONAL_REASON = "Seasonal promotion on the page";
export const SEASONAL_LABEL = "Seasonal";
export const PROMO_RULE = "A change made when either capture carries a sale or seasonal promotion (Black Friday, holiday, gift guide, percent or money off, free shipping and similar wording in the headline or buttons), whether the page enters a sale, moves between two sales or leaves one, is held as seasonal: it stays in the data, marked Seasonal, but is never a rebrand, a counter-move or a story.";
