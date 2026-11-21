// The library history series: six materialized views refreshed one per call (library_history_refresh_view) by
// history-refresh.server.ts. Pure so the name guard, timings and health note are testable and match the database list.

/** The only views the refresh step may touch, in refresh order (the database function refuses any other name). The stored site
 *  rows go first (pages read them; refreshed concurrently, so readers never block); the large share view goes last, so if it ever
 *  fails through the API the small views are already fresh. */
export const HISTORY_VIEWS = ["library_site_history_mat", "library_signal_series_mat", "library_css_series_mat", "library_font_series_mat", "library_tag_series_mat", "library_history_share_mat"] as const;
export type HistoryView = (typeof HISTORY_VIEWS)[number];
export const isHistoryView = (name: unknown): name is HistoryView => typeof name === "string" && (HISTORY_VIEWS as readonly string[]).includes(name);

/** A refresh that started less than this long ago is not started again. */
export const HISTORY_MIN_INTERVAL_MS = 5 * 60_000;
/** Starting per-view estimates (ms): measured refresh time on 20 Nov 2026 × ~1.5, until this instance has timed the view once. */
export const HISTORY_VIEW_ESTIMATE_MS: Readonly<Record<HistoryView, number>> = {
  library_site_history_mat: 3_000, library_history_share_mat: 5_500, library_signal_series_mat: 1_500, library_css_series_mat: 1_500, library_font_series_mat: 500, library_tag_series_mat: 1_000,
};
/** Time the step may use: after a crawl batch (in the background) and on the wire poll / crawl finish (before the records sweep). */
export const HISTORY_BACKGROUND_MS = 20_000;
export const HISTORY_JOB_MS = 15_000;
/** Health mentions the history series only once their last full refresh is older than this. */
export const HISTORY_NOTE_AFTER_MS = 3_600_000;

/** The library_check note addition: nothing while the series are fresh (or when the facts could not be read). */
export function historyNote(h: { refreshed_at: string | null } | null | undefined, now: number): string | null {
  if (!h) return null;
  const t = h.refreshed_at ? Date.parse(h.refreshed_at) : NaN;
  if (!Number.isFinite(t)) return "history series: no completed refresh recorded yet";
  if (now - t <= HISTORY_NOTE_AFTER_MS) return null;
  const m = Math.round((now - t) / 60_000);
  return `history series last refreshed ${m < 120 ? `${m}m` : m < 2880 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`} ago (${new Date(t).toISOString().slice(0, 16).replace("T", " ")} UTC)`;
}
