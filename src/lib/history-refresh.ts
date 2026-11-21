// The library history (U2c). The stored site rows (`library_site_history_store`, read through `library_site_history_rows`) are replaced
// per brand by the scheduled `library-history-refresh` job (`library_history_refresh_job()`): ingest triggers only mark brands dirty
// (`library_history_dirty_domains`), and the job takes up to 40 a run inside a 25 s budget. The five aggregate series are refreshed
// CONCURRENTLY by the same job on a cadence. The app never refreshes history through the API. Pure, so the name guard and the health
// note are testable and match the database.

/** The aggregate views the database's manual per-view refresh accepts (library_history_refresh_view refuses any other name), in the
 *  scheduled job's order: small views first, the large share view last. */
export const HISTORY_VIEWS = ["library_font_series_mat", "library_tag_series_mat", "library_signal_series_mat", "library_css_series_mat", "library_history_share_mat"] as const;
export type HistoryView = (typeof HISTORY_VIEWS)[number];
export const isHistoryView = (name: unknown): name is HistoryView => typeof name === "string" && (HISTORY_VIEWS as readonly string[]).includes(name);

/** Health mentions the aggregate series only once their last full refresh is older than this. */
export const HISTORY_NOTE_AFTER_MS = 3_600_000;
/** A brand counts as "behind" once its stored rows have waited longer than this (the database counts it: rows_behind). */
export const HISTORY_BEHIND_AFTER_MS = 30 * 60_000;

export type HistoryFacts = { refreshed_at: string | null; rows_behind?: number | null | undefined; views_too_slow?: string[] | null | undefined };

/** The library_check note addition: nothing while the series are fresh and no brand is behind (or when the facts could not be read). */
export function historyNote(h: HistoryFacts | null | undefined, now: number): string | null {
  if (!h) return null;
  const parts: string[] = [];
  const behind = typeof h.rows_behind === "number" && Number.isFinite(h.rows_behind) ? Math.max(0, Math.round(h.rows_behind)) : 0;
  if (behind > 0) parts.push(`history ${behind} domain${behind === 1 ? "" : "s"} behind`);
  const slow = Array.isArray(h.views_too_slow) ? h.views_too_slow.filter(v => typeof v === "string") : [];
  if (slow.length) parts.push(`history series too slow for the job's budget: ${slow.join(", ")}`);
  const t = h.refreshed_at ? Date.parse(h.refreshed_at) : NaN;
  if (!Number.isFinite(t)) parts.push("history series: no completed refresh recorded yet");
  else if (now - t > HISTORY_NOTE_AFTER_MS) {
    const m = Math.round((now - t) / 60_000);
    parts.push(`history series last refreshed ${m < 120 ? `${m}m` : m < 2880 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`} ago (${new Date(t).toISOString().slice(0, 16).replace("T", " ")} UTC)`);
  }
  return parts.length ? parts.join("; ") : null;
}
