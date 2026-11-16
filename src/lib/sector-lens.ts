// The one sector lens shared by both shells: a `?sector=` search param, remembered per device. Pure apart from injected storage.
import { SECTORS } from "./library";
import { sectorName } from "./labels";
import { buildSignals, rowKey, type Signal, type SignalRow } from "./signals";
import type { TierResult } from "./tiers";

export const SECTOR_KEY = "dsgn.sector";
export const LENS_SECTORS: readonly string[] = ["all", ...SECTORS];
export const resolveSector = (v: unknown): string => (typeof v === "string" && LENS_SECTORS.includes(v) ? v : "all");
type Store = Pick<Storage, "getItem" | "setItem">;
/** Device memory for the lens; any storage failure reads as All and writes nowhere. */
export function sectorStore(get: () => Store | null | undefined = () => (typeof window === "undefined" ? null : window.localStorage)) {
  return {
    read(): string { try { return resolveSector(get()?.getItem(SECTOR_KEY)); } catch { return "all"; } },
    write(v: string): void { try { get()?.setItem(SECTOR_KEY, resolveSector(v)); } catch { /* private mode: URL only */ } },
  };
}
/** "Showing: Fintech" — always written out near the top. */
export const showingText = (sector: string) => `Showing: ${sectorName(resolveSector(sector))}`;

/** A sector's numbers are used when at least this share of headline signals has an ok forecast row in it; otherwise lists fall back to All. */
export const SECTOR_COVERAGE_MIN = 0.5;
export type LensResult = { sector: string; scope: string; signals: Signal[]; note: string | null };
/** Signals for the lens: that sector's stage / Momentum / Confidence, or All with a visible note when it lacks coverage. */
export function lensSignals(rows: SignalRow[], tiers: Map<string, TierResult>, raw: unknown): LensResult {
  const sector = resolveSector(raw), all = () => buildSignals(rows, tiers, "all");
  if (sector === "all") return { sector, scope: "all", signals: all(), note: null };
  const head = [...tiers.values()].filter(t => t.tier === "headline").map(t => t.key);
  const ok = new Set(rows.filter(r => r.scope === sector && r.status === "ok").map(rowKey));
  const covered = head.filter(k => ok.has(k)).length;
  if (!head.length || covered / head.length < SECTOR_COVERAGE_MIN)
    return { sector, scope: "all", signals: all(), note: `${sectorName(sector)} doesn't have enough forecast coverage yet (${covered} of ${head.length} headline signals measured there), so these are all-sector numbers.` };
  return { sector, scope: sector, signals: buildSignals(rows, tiers, sector), note: null };
}
/** Stable partition: items in the chosen sector first, then the rest, each keeping its order. */
export function sectorFirst<T>(items: readonly T[], sector: string, sectorOf: (t: T) => string | null | undefined): T[] {
  const s = resolveSector(sector);
  if (s === "all") return [...items];
  return [...items.filter(i => sectorOf(i) === s), ...items.filter(i => sectorOf(i) !== s)];
}
