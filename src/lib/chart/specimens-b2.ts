// B2 · the held study "Do the leaders lead?" (pure): every headline signal with stored lead-and-lag counts, ranked by the measured lag
// in quarters (vanguard furthest ahead first, then "not yet", then level, then behind).
import { lagOf, lagText, leadPoints, type LeadRow } from "@/components/chartkit/leadlag-layout";
export type LeadRank = { signal: string; name: string; kind: string; quarters: number | null; text: string; van: number | null; rest: number | null; quartersRead: number };
const ORDER: Record<string, number> = { ahead: 0, "not-yet": 1, level: 2, behind: 3 };
export function rankLeads(rows: Record<string, readonly LeadRow[]>, name: (k: string) => string): LeadRank[] {
  return Object.entries(rows).flatMap(([signal, r]) => {
    const ps = leadPoints(r), lag = lagOf(ps), last = ps.at(-1);
    if (!lag || !last || ps.filter(p => p.v != null && p.r != null).length < 3) return [];
    return [{ signal, name: name(signal), kind: lag.kind, quarters: lag.quarters, text: lagText(lag), van: last.v, rest: last.r, quartersRead: ps.length }];
  }).sort((a, b) => (ORDER[a.kind]! - ORDER[b.kind]!) || ((a.kind === "behind" ? -1 : 1) * ((b.quarters ?? 0) - (a.quarters ?? 0))) || a.name.localeCompare(b.name));
}
