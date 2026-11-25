// Y1 · THE TIMING TEST (pure). Where a dated fact falls against a signal's curve: before the rise began, during it, or after it. The
// rise begins at the first well-covered quarter (the forecast's own coverage rule) whose share sits more than twice the binomial noise
// band (√(p(1−p)/n)) above the first well-covered quarter's share; it ends at the highest share after that. A fact dated after the rise
// cannot be offered as a cause.
import { THRESHOLDS, qIndex } from "../forecast";
export type Quarter = { q: string; s: number | null; n: number; c?: number };
export type Phase = "before" | "during" | "after" | "no rise";
const covered = (p: Quarter): p is Quarter & { s: number } => p.s != null && p.n >= THRESHOLDS.denomAll && (p.c == null || p.c >= THRESHOLDS.coverage);
export const noiseBand = (p: number, n: number) => 2 * Math.sqrt(Math.max(p * (1 - p), 1 / n) / n);
/** First day of a quarter, as YYYY-MM-DD. */
export const quarterStart = (q: string) => `${q.slice(0, 4)}-${String((Number(q.slice(5)) - 1) * 3 + 1).padStart(2, "0")}-01`;
export const quarterEnd = (q: string) => { const i = qIndex(q) + 1, y = Math.floor(i / 4), m = (i % 4) * 3 + 1; return `${y}-${String(m).padStart(2, "0")}-01`; };
export function timing(quarters: readonly Quarter[]) {
  const ps = [...quarters].filter(covered).sort((a, b) => qIndex(a.q) - qIndex(b.q)), base = ps[0];
  const start = base ? ps.find(p => p.s - base.s > noiseBand(base.s, base.n)) ?? null : null;
  const after = start ? ps.filter(p => qIndex(p.q) >= qIndex(start.q)) : [];
  const peak = after.length ? after.reduce((m, p) => (p.s > m.s ? p : m)) : null;
  // The rise is counted from the quarter before the first clear quarter (the move happened in between).
  const prev = start ? ps[ps.indexOf(start) - 1] ?? start : null;
  const from = prev ? quarterStart(prev.q) : null, to = peak ? quarterEnd(peak.q) : null;
  const phaseOf = (date: string): Phase => { const d = date.length === 7 ? `${date}-01` : date.slice(0, 10); return !from || !to ? "no rise" : d < from ? "before" : d >= to ? "after" : "during"; };
  return { riseStart: start?.q ?? null, riseEnd: peak?.q ?? null, from, to, phaseOf };
}
/** An entry may be offered as a cause only before or during the rise. */
export const mayCause = (p: Phase | undefined) => p === "before" || p === "during";
