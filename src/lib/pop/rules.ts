// A3 · pop rules, pure: where the tilted sticker may go, the study cover band, and "new" (published in the last 24 hours).
/** The only places the sticker may appear. Anything else is refused by stickers.test. */
/** "arrivals" is the existing control on Today ("3 new stories · show them"), kept as it was before A3. */
export const STICKER_USES = ["moved", "arrivals", "new-story", "forecast-legend"] as const;
export type StickerUse = (typeof STICKER_USES)[number];
export const STICKER_WORD: Record<StickerUse, string> = { moved: "Changed", arrivals: "New stories", "new-story": "New", "forecast-legend": "Forecast" };
export const NEW_WINDOW_MS = 24 * 3600_000;
/** A story is new for 24 hours after it was published. */
export const isNewStory = (at: string, now: number) => { const t = Date.parse(at); return Number.isFinite(t) && now - t >= 0 && now - t < NEW_WINDOW_MS; };
export const BAND_COLOURS = ["pink", "yellow", "green"] as const;
/** The study's cover band: stable by study number modulo 3 (0 pink, 1 yellow, 2 green). */
export const studyBand = (n: number) => (((Math.trunc(n) % 3) + 3) % 3) as 0 | 1 | 2;
/** One highlighter word per page: the pages that carry it and what is marked. */
export const HIGHLIGHT_PAGES = { brands: "the tracked-brand count" } as const;
