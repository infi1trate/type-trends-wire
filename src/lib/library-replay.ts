import { advance, diffLibrarySignals, type Baseline, type Pending, type LibraryEvent } from "./library-diff";
export type ReplaySnapshot = { id: number; domain: string; sector: string; page_type: string; viewport: string; source: string; captured_at: string; signals: Record<string, unknown> };
export function replayLibrary(rows: ReplaySnapshot[]) {
  const baselines = new Map<string, { domain: string; page_type: string; viewport: string; source: string; baseline: Baseline; pending: Pending }>();
  const events: (LibraryEvent & { domain: string; page_type: string; viewport: string; snapshot_id: number; source: string; detected_at: string })[] = [];
  const first = new Map<string, string>(), surfaces = new Set<string>();
  for (const row of [...rows].sort((a,b) => Date.parse(a.captured_at)-Date.parse(b.captured_at) || a.id-b.id)) {
    const key = JSON.stringify([row.domain,row.page_type,row.viewport,row.source]), surface = `${row.domain}:${row.page_type}:${row.source}`;
    const prior = baselines.get(key);
    const context = { ...row, new_surface: !surfaces.has(surface), first_captured_at: first.get(row.domain) ?? null };
    const result = advance(prior?.baseline ?? null, prior?.pending ?? {}, { signals: row.signals, snapshot_id: row.id, captured_at: row.captured_at, context });
    result.events.push(...diffLibrarySignals(null, row.signals, context));
    events.push(...result.events.map(e => ({ ...e, domain: row.domain, page_type: row.page_type, viewport: row.viewport, snapshot_id: row.id, source: row.source, detected_at: row.captured_at })));
    baselines.set(key, { domain: row.domain, page_type: row.page_type, viewport: row.viewport, source: row.source, baseline: result.baseline, pending: result.pending });
    if (row.source === "live" && !first.has(row.domain)) first.set(row.domain,row.captured_at);
    surfaces.add(surface);
  }
  return { baselines: [...baselines.values()], events };
}