// New stories without a jump: polled stories wait behind a "2 new stories" control; activating it inserts them at the top and moves focus
// to the first. "Since your last visit" is a device-only marker (localStorage); no accounts and no server record. Pure apart from storage.
type Item = { id: string; at: string };
const newestFirst = <T extends Item>(a: T, b: T) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id);
/** Polled items not shown yet, newest first. */
export function pendingStories<T extends Item>(shown: readonly Item[], incoming: readonly T[]): T[] {
  const have = new Set(shown.map(s => s.id));
  return incoming.filter(s => !have.has(s.id)).sort(newestFirst);
}
/** Insert pending items; the list stays newest first and focus goes to the first inserted item in reading order. */
export function insertPending<T extends Item>(shown: readonly T[], pending: readonly T[]): { items: T[]; focusId: string | null } {
  const have = new Set(shown.map(s => s.id)), add = pending.filter(p => !have.has(p.id)).sort(newestFirst);
  const items = [...add, ...shown].sort(newestFirst);
  return { items, focusId: items.find(i => add.some(a => a.id === i.id))?.id ?? null };
}
export const newStoriesText = (n: number) => `${n} new ${n === 1 ? "story" : "stories"}`;
/** The polite live region speaks a count once: only when it differs from the last one it announced (and never for zero). */
export function announcement(lastAnnounced: number, count: number): string | null {
  return count > 0 && count !== lastAnnounced ? newStoriesText(count) : null;
}

export const LAST_VISIT_KEY = "dsgn.front.lastVisit";
type Store = Pick<Storage, "getItem" | "setItem">;
/** This device's last visit to the front page; any storage failure reads as none and writes nowhere. */
export function visitStore(get: () => Store | null | undefined = () => (typeof window === "undefined" ? null : window.localStorage)) {
  return {
    read(): string | null { try { const v = get()?.getItem(LAST_VISIT_KEY) ?? null; return v && !Number.isNaN(Date.parse(v)) ? v : null; } catch { return null; } },
    write(iso: string): void { try { get()?.setItem(LAST_VISIT_KEY, iso); } catch { /* private mode */ } },
  };
}
/** How many shown stories are newer than the last visit; the marker sits before the first older one. */
export function sinceVisit(items: readonly Item[], lastVisit: string | null): { count: number; beforeId: string | null } | null {
  if (!lastVisit) return null;
  const t = Date.parse(lastVisit), newer = items.filter(i => Date.parse(i.at) > t);
  return { count: newer.length, beforeId: items.find(i => Date.parse(i.at) <= t)?.id ?? null };
}
