// Manual use only (U2c). Ingest never refreshes history through the API any more: the capture, tag and site triggers mark brands
// dirty and the scheduled `library-history-refresh` database job does the work inside its own budget. This helper stays for an
// operator script that wants one aggregate view refreshed now; the name is checked here and again by the database function.
import { isHistoryView } from "./history-refresh";

export type HistoryRpc = (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;

/** Refresh one named aggregate history view (manual). */
export async function refreshHistoryView(rpc: HistoryRpc, view: string): Promise<{ ok: boolean; skipped: boolean; ms: number }> {
  if (!isHistoryView(view)) throw new Error("unknown history view");
  const { data, error } = await rpc("library_history_refresh_view", { p_view: view });
  if (error) throw new Error("history view refresh failed");
  const d = (data ?? {}) as { ok?: unknown; skipped?: unknown; ms?: unknown };
  return { ok: d.ok === true, skipped: d.skipped === true, ms: Number(d.ms) || 0 };
}
