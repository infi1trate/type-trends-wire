// B2 · lead and lag counts (pure): for each signal and well-covered quarter, how many vanguard brands and how many other brands were
// read for it and how many showed it. The vanguard is today's list (vanguard.ts) applied to every quarter. The weekly structure
// follow-up stores these in `library_lead_lag_series`; pages only read the stored rows.
import { byQuarter, knows, traitsOf, usableRule, type HistRow, type SiteInfo } from "./data-stories/series";

export type LeadLagRow = { signal: string; quarter: string; van_n: number; van_yes: number; rest_n: number; rest_yes: number; vanguard_size: number };
export function leadLagRows(sites: readonly SiteInfo[], history: readonly HistRow[], vanguard: readonly string[], signals: readonly string[]): LeadLagRow[] {
  const active = new Set(sites.filter(s => s.active).map(s => s.domain)), van = new Set(vanguard.filter(d => active.has(d)));
  const rows = history.filter(r => active.has(r.domain)), rule = usableRule(null), n = new Map<string, number>();
  for (const r of rows) n.set(r.quarter, (n.get(r.quarter) ?? 0) + 1);
  const usable = new Set([...n].filter(([, c]) => c >= rule.minDenom && c / Math.max(1, active.size) >= rule.coverage).map(([q]) => q));
  const out: LeadLagRow[] = [];
  for (const key of signals) {
    const acc = new Map<string, LeadLagRow>();
    for (const r of rows) {
      if (!usable.has(r.quarter) || !knows(key, r)) continue;
      const e = acc.get(r.quarter) ?? { signal: key, quarter: r.quarter, van_n: 0, van_yes: 0, rest_n: 0, rest_yes: 0, vanguard_size: van.size };
      const yes = traitsOf(r).has(key) ? 1 : 0;
      if (van.has(r.domain)) { e.van_n++; e.van_yes += yes; } else { e.rest_n++; e.rest_yes += yes; }
      acc.set(r.quarter, e);
    }
    out.push(...[...acc.values()].sort((a, b) => byQuarter(a.quarter, b.quarter)));
  }
  return out;
}
