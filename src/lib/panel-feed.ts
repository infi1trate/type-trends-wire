/** R2a-2 · pure: the redesigns-per-year figure over panel brands, in library_redesigns' shape and order. */
export type RedesignEvent = { domain: string; source: string | null; detected_at: string; effective_at: string | null };
export type RedesignRow = { year: number; sector: string; source: string | null; redesigns: number };
export function redesignsByYear(events: readonly RedesignEvent[], panel: ReadonlySet<string>, sectorOf: ReadonlyMap<string, string>): RedesignRow[] {
  const m = new Map<string, RedesignRow>();
  for (const e of events) {
    const sector = sectorOf.get(e.domain);
    if (!panel.has(e.domain) || !sector) continue;
    const year = new Date(e.effective_at ?? e.detected_at).getUTCFullYear(), k = `${year}|${sector}|${e.source}`;
    const r = m.get(k) ?? m.set(k, { year, sector, source: e.source, redesigns: 0 }).get(k)!;
    r.redesigns++;
  }
  return [...m.values()].sort((a, b) => a.year - b.year || a.sector.localeCompare(b.sector) || String(a.source).localeCompare(String(b.source)));
}
