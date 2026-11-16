// /signals on the server: the pure index built from the memoised signal snapshot and the all-sector series, so the page ships only
// the rows it shows (the full snapshot of every scope stays on the server). Anonymous SELECT-only reads; no AI.
import { loadSignalSnapshot } from "./signals.server";
import { loadSignalSeries } from "./read.server";
import { tiersFrom } from "./signals";
import { lensSignals } from "./sector-lens";
import { signalsIndex, type SignalsView } from "./signals-index";

export async function loadSignalsIndex(v: SignalsView) {
  const [snap, series] = await Promise.all([loadSignalSnapshot(), loadSignalSeries("all")]);
  const tiers = tiersFrom(snap.rows, new Map(snap.prev));
  const lens = lensSignals(snap.rows, tiers, v.sector), all = v.sector === "all" ? lens.signals : lensSignals(snap.rows, tiers, "all").signals;
  const idx = signalsIndex({ all, lens, series }, v);
  // Only what the page renders: the lens's own signal list stays server-side.
  return { runId: snap.run_id, idx };
}
export type SignalsIndexPage = Awaited<ReturnType<typeof loadSignalsIndex>>;
