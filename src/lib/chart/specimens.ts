// L2 · the two proposed forms' specimens (pure): a slope chart of one signal's share by sector at two quarters from the stored
// history, and dots with ranges for next quarter's forecast from the newest run. specimens.server.ts only loads the rows.
import { label, sectorName } from "../labels";

export type Quarter = { q: string; s: number | null; n: number; c: number };
const covered = (p: Quarter | undefined): p is Quarter & { s: number } => !!p && p.s != null && p.n >= 15 && p.c >= 0.25;
export type SlopeRow = { id: string; label: string; from: number; to: number };
export type SlopeModel = { signal: string; name: string; from: string; to: string; rows: SlopeRow[]; moved: string | null };
/** One signal's sectors at the oldest and newest quarters that most of them cover well (n ≥ 15, coverage ≥ 25%); at most ten rows,
 *  sorted by now; `moved` is the row whose share changed most. Null with fewer than two rows. */
export function slopeModel(signal: string, sectors: readonly { scope: string; quarters: readonly Quarter[] | null }[]): SlopeModel | null {
  const by = sectors.map(r => ({ scope: r.scope, q: new Map((r.quarters ?? []).map(p => [p.q, p])) }));
  const qs = [...new Set(by.flatMap(r => [...r.q.keys()]))].sort();
  const count = (q: string) => by.filter(r => covered(r.q.get(q))).length;
  const to = [...qs].reverse().find(q => count(q) >= 2);
  if (!to) return null;
  const need = Math.max(2, Math.ceil(count(to) * 0.6));
  const from = qs.find(q => q < to && by.filter(r => covered(r.q.get(q)) && covered(r.q.get(to))).length >= need);
  if (!from) return null;
  const rows = by.flatMap(r => { const a = r.q.get(from), b = r.q.get(to); return covered(a) && covered(b) ? [{ id: r.scope, label: sectorName(r.scope), from: a.s, to: b.s }] : []; })
    .sort((a, b) => b.to - a.to || a.id.localeCompare(b.id)).slice(0, 10);
  if (rows.length < 2) return null;
  const moved = [...rows].sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from) || a.id.localeCompare(b.id))[0]!.id;
  return { signal, name: label(signal).name, from, to, rows, moved };
}
export type RangeRow = { id: string; label: string; value: number; lo: number; hi: number };
export type DotRangeModel = { quarter: string | null; rows: RangeRow[]; widest: string | null };
/** The signals with the highest share that carry next quarter's forecast range, at most twelve, sorted by share; `widest` is the row
 *  with the widest range. */
export function dotRangeModel(rows: readonly { dimension: string; value: string; current_share: number | null; proj_q1_lo: number | null; proj_q1_hi: number | null }[], keep: (key: string) => boolean, quarter: string | null): DotRangeModel {
  const out = rows.flatMap(r => { const id = `${r.dimension}:${r.value}`; return keep(id) && r.current_share != null && r.proj_q1_lo != null && r.proj_q1_hi != null ? [{ id, label: label(id).name, value: r.current_share, lo: Math.min(r.proj_q1_lo, r.proj_q1_hi), hi: Math.max(r.proj_q1_lo, r.proj_q1_hi) }] : []; })
    .sort((a, b) => b.value - a.value || a.id.localeCompare(b.id)).slice(0, 12);
  const widest = out.length ? [...out].sort((a, b) => (b.hi - b.lo) - (a.hi - a.lo) || a.id.localeCompare(b.id))[0]!.id : null;
  return { quarter, rows: out, widest };
}
/** The quarter after `q` ("2026Q4" → "2027Q1"). */
export const nextQuarter = (q: string) => { const m = /^(\d{4})Q([1-4])$/.exec(q); if (!m) return q; const y = Number(m[1]), n = Number(m[2]); return n === 4 ? `${y + 1}Q1` : `${y}Q${n + 1}`; };
