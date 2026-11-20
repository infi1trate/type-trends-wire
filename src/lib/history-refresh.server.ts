// Best-effort library history refresh, one view per database call (Fix · library intake). Never runs inside a crawl batch's
// answer: a batch only leaves library_history_control.dirty set (by trigger) and this step runs after it in the background
// when the host offers waitUntil, on the 15-minute wire poll before the records sweep, and at crawl finish.
//
// Order: begin (clears dirty, records the start; refused when clean, started < 5 min ago, or another refresh holds the lock)
// → each view while its estimate fits before the deadline → end (records refreshed_at when all five finished, otherwise puts
// dirty back). A batch stored mid-refresh sets dirty again through the trigger, so it is never lost. Never throws.
import { HISTORY_MIN_INTERVAL_MS, HISTORY_VIEWS, HISTORY_VIEW_ESTIMATE_MS, isHistoryView, type HistoryView } from "./history-refresh";

export type HistoryRpc = (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
export type HistoryRefreshResult = {
  /** started: the step ran (complete or not); otherwise why it returned at once. */
  outcome: "started" | "clean" | "recent" | "busy" | "no_time" | "error";
  complete: boolean;
  ms: Partial<Record<HistoryView, number>>;
  /** The view the step stopped at, and why. */
  stopped?: { view: HistoryView; why: "deadline" | "failed" | "busy" | "cut_off" };
  total_ms: number;
};

const learned = new Map<HistoryView, number>();
export const resetHistoryEstimates = () => learned.clear();
const estimate = (v: HistoryView) => learned.get(v) ?? HISTORY_VIEW_ESTIMATE_MS[v];
const CUT = Symbol("cut");
function within<T>(ms: number, work: PromiseLike<T>): Promise<T | typeof CUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const p = Promise.resolve(work); p.catch(() => {});
  return Promise.race([p, new Promise<typeof CUT>(r => { timer = setTimeout(() => r(CUT), Math.max(0, ms)); })]).finally(() => clearTimeout(timer));
}
const END_MS = 3_000;

async function defaultRpc(): Promise<HistoryRpc> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return (name, args) => supabaseAdmin.rpc(name as never, args as never) as unknown as PromiseLike<{ data: unknown; error: unknown }>;
}

/** Refresh one named history view. The name is checked here and again by the database function. */
export async function refreshHistoryView(rpc: HistoryRpc, view: string): Promise<{ ok: boolean; skipped: boolean; ms: number }> {
  if (!isHistoryView(view)) throw new Error("unknown history view");
  const { data, error } = await rpc("library_history_refresh_view", { p_view: view });
  if (error) throw new Error("history view refresh failed");
  const d = (data ?? {}) as { ok?: unknown; skipped?: unknown; ms?: unknown };
  return { ok: d.ok === true, skipped: d.skipped === true, ms: Number(d.ms) || 0 };
}

export async function refreshLibraryHistory(o: { deadline: number; job?: string; now?: () => number; rpc?: HistoryRpc }): Promise<HistoryRefreshResult> {
  const now = o.now ?? Date.now, t0 = now(), left = () => o.deadline - now();
  const out: HistoryRefreshResult = { outcome: "error", complete: false, ms: {}, total_ms: 0 };
  const finish = () => { out.total_ms = now() - t0; console.info("library history refresh", o.job ?? "", { outcome: out.outcome, complete: out.complete, ms: out.ms, total_ms: out.total_ms, ...(out.stopped ? { stopped: `${out.stopped.view}:${out.stopped.why}` } : {}) }); return out; };
  let rpc: HistoryRpc;
  try { rpc = o.rpc ?? await defaultRpc(); } catch { return finish(); }
  try {
    if (left() < 1_000) { out.outcome = "no_time"; return finish(); }
    const begun = await within(Math.min(left(), END_MS), rpc("library_history_refresh_begin", { p_min_age_seconds: HISTORY_MIN_INTERVAL_MS / 1000 }));
    // Cut off while waiting: begin may still have cleared dirty, so put it back (an extra refresh later is harmless).
    if (begun === CUT) { await within(END_MS, rpc("library_history_refresh_end", { p_ok: false })).catch(() => null); return finish(); }
    if (begun.error) return finish();
    const b = (begun.data ?? {}) as { started?: unknown; reason?: unknown };
    if (b.started !== true) { out.outcome = b.reason === "recent" || b.reason === "busy" ? b.reason : "clean"; return finish(); }
    out.outcome = "started";
    let complete = true;
    for (const view of HISTORY_VIEWS) {
      if (left() < estimate(view)) { out.stopped = { view, why: "deadline" }; complete = false; break; }
      const s = now();
      const r = await within(left(), refreshHistoryView(rpc, view)).catch(() => null);
      if (r === CUT) { out.stopped = { view, why: "cut_off" }; learned.set(view, Math.min(60_000, Math.max(estimate(view), now() - s) * 1.5)); complete = false; break; }
      if (!r) { out.stopped = { view, why: "failed" }; complete = false; break; }
      if (!r.ok) { out.stopped = { view, why: "busy" }; complete = false; break; }
      out.ms[view] = r.ms; learned.set(view, Math.max(r.ms, now() - s));
    }
    // End even past the deadline (short cap): an unfinished step must put dirty back so the next run picks the change up.
    const ended = await within(END_MS, rpc("library_history_refresh_end", { p_ok: complete })).catch(() => null);
    out.complete = complete && !!ended && ended !== CUT && !ended.error;
    return finish();
  } catch { return finish(); }
}
