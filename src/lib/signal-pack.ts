// The signal snapshot travels to the browser as columns of arrays instead of one object per row: the same values, without repeating eleven
// field names on ~1,700 rows, so the terminal's hydration payload is smaller. Pure and lossless; `unpackSnapshot(packSnapshot(s))` equals s.
import type { SignalRow, SignalSnapshot } from "./signals";

export const PACK_COLS = ["dimension", "value", "scope", "status", "stage", "momentum", "current_share", "next_wave_score", "present", "sites", "usable"] as const;
type Col = (typeof PACK_COLS)[number];
export type PackedSnapshot = Omit<SignalSnapshot, "rows"> & { packed: 1; cols: readonly Col[]; rows: (string | number | boolean | null)[][] };

export function packSnapshot(s: SignalSnapshot): PackedSnapshot {
  return { run_id: s.run_id, computed_at: s.computed_at, prev_runs: s.prev_runs, prev: s.prev, packed: 1, cols: PACK_COLS, rows: s.rows.map(r => PACK_COLS.map(c => ((r as Record<Col, unknown>)[c] ?? null) as string | number | boolean | null)) };
}
export function unpackSnapshot(p: PackedSnapshot | SignalSnapshot): SignalSnapshot {
  if (!("packed" in p)) return p;
  const rows = p.rows.map(a => Object.fromEntries(p.cols.map((c, k) => [c, a[k] ?? null])) as unknown as SignalRow);
  return { run_id: p.run_id, computed_at: p.computed_at, prev_runs: p.prev_runs, prev: p.prev, rows };
}
