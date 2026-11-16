// FORMATS — the one mapping from story type and front-page surface to a reading format. Pure, no I/O.
// Live: things as they are detected. Updating: pages that redraw. Explore: object pages to browse. Read: pieces to sit with.
import { STORY_KINDS, type StoryKind } from "../stories/types";

export const FORMATS = ["live", "updating", "explore", "read"] as const;
export type Format = (typeof FORMATS)[number];
export type FormatFilter = Format | "all";
export const FORMAT_LABEL: Record<FormatFilter, string> = { all: "All", live: "Live", updating: "Updating", explore: "Explore", read: "Read" };
export const FORMAT_NOTE: Record<Format, string> = {
  live: "Moves, rebrands, counter-moves and news, as they are detected.",
  updating: "Pages that redraw: Moving now, signals, the chart of the day, the Morning Line and sector reports.",
  explore: "Brand and pattern pages to browse.",
  read: "Roundups, white-space pieces and Digest issues.",
};

/** Every story type, exactly one format. Signal stories (shift, breakout, first seen, crossover) report a page that redraws, so they are Updating. */
export const STORY_FORMAT: Record<StoryKind, Format> = {
  move: "live", rebrand: "live", counter_move: "live", news: "live", launch: "live",
  shift: "updating", breakout: "updating", first_seen: "updating", crossover: "updating",
  roundup: "read", white_space: "read",
};
/** Every front-page surface, exactly one format. The masthead (wordmark, clock, freshness, ticker) and the footer are chrome, not items. */
export const FRONT_SURFACES = ["moving-now", "signals", "chart-of-the-day", "morning-line", "sector-reports", "your-sector", "new-on-the-scene", "patterns", "brands", "digest"] as const;
export type FrontSurface = (typeof FRONT_SURFACES)[number];
export const SURFACE_FORMAT: Record<FrontSurface, Format> = {
  "moving-now": "updating", signals: "updating", "chart-of-the-day": "updating", "morning-line": "updating", "sector-reports": "updating", "your-sector": "updating",
  "new-on-the-scene": "live",
  patterns: "explore", brands: "explore",
  digest: "read",
};

export const storyFormat = (type: string): Format => ((STORY_KINDS as readonly string[]).includes(type) ? STORY_FORMAT[type as StoryKind] : "live");
export const resolveFormat = (v: unknown): FormatFilter => (typeof v === "string" && (FORMATS as readonly string[]).includes(v) ? (v as Format) : "all");
/** Whether an item of `format` shows under `filter`. */
export const shows = (filter: FormatFilter, format: Format) => filter === "all" || filter === format;
export const surfaceShows = (filter: FormatFilter, s: FrontSurface) => shows(filter, SURFACE_FORMAT[s]);

/** `/` search params: written only when not the default, so `/` stays clean. */
export function frontSearch(o: { sector: string; format: FormatFilter }): { sector?: string; format?: Format } {
  return { ...(o.sector !== "all" ? { sector: o.sector } : {}), ...(o.format !== "all" ? { format: o.format } : {}) };
}
