export type Scope = "en" | "all";
export type IndexFilter = "BOTH" | "VANGUARD" | "MAINSTREAM";
export const INDEXES = ["vanguard", "mainstream"] as const;
export const percent = (value: number | null | undefined) => value == null ? "—" : `${(value * 100).toFixed(1)}%`;
export const spreadText = (value: number | null | undefined) => value == null ? "—" : `${value > 0 ? "+" : ""}${Math.round(value)} PTS`;
export const compare = <T extends { index_name: string; share: number }>(rows: T[], key: (row: T) => string) => {
  const map = new Map<string, { label: string; v: number; m: number }>();
  for (const row of rows) {
    const label = key(row), item = map.get(label) ?? { label, v: 0, m: 0 };
    if (row.index_name === "vanguard") item.v = row.share;
    else item.m = row.share;
    map.set(label, item);
  }
  return [...map.values()].sort((a, b) => b.v - a.v || a.label.localeCompare(b.label));
};
export const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b), i = Math.floor(sorted.length / 2);
  return sorted.length ? sorted.length % 2 ? sorted[i] ?? 0 : ((sorted[i - 1] ?? 0) + (sorted[i] ?? 0)) / 2 : null;
};
export function readScope(storage: Pick<Storage, "getItem">): Scope {
  try { return storage.getItem("dsgn.scope") === "all" ? "all" : "en"; } catch { return "en"; }
}
export function saveScope(storage: Pick<Storage, "setItem">, scope: Scope) {
  try { storage.setItem("dsgn.scope", scope); } catch { /* Storage can be unavailable. */ }
}