/** R2a-2 · the sync split. The library_sync RPC is unchanged: it only ever sees panel rows and former members (panel_since set).
 *  New domains and rows that never joined are stored inactive with onboarding = true, in server code, and never reach the RPC. */
export type SyncSite = { domain: string; sector: string; name?: string | undefined; category?: string | undefined; subcategory?: string | undefined };
export type StoredSite = { domain: string; sector: string; active: boolean | null; onboarding: boolean; panel_since: string | null };
export type OnboardingInsert = { domain: string; sector: string; name: string; active: false; onboarding: true; panel_since: null; category: string | null; subcategory: string | null };
export type SyncStore = {
  /** Rows for these domains (callers pass at most SYNC_PAGE). */
  read(domains: readonly string[]): Promise<StoredSite[]>;
  /** Every row with onboarding = true (paged by the store). */
  onboardingDomains(): Promise<string[]>;
  /** Every row with active = true (paged by the store). */
  activeDomains(): Promise<string[]>;
  insertOnboarding(rows: readonly OnboardingInsert[]): Promise<void>;
  updateOnboarding(domain: string, patch: { sector: string; name?: string; onboarding: true; active: false }): Promise<void>;
  clearOnboarding(domains: readonly string[]): Promise<void>;
  rpcSync(sites: readonly Omit<SyncSite, "category" | "subcategory">[]): Promise<void>;
};
export const SYNC_PAGE = 200;
/** How many active brands one sync may set inactive: a handful of removals, never a wrong file. */
export const maxLeaving = (active: number) => Math.max(10, Math.ceil(active * 0.03));
export type SyncResult = { ok: true; panel: number; onboarding_new: number; onboarding_kept: number; onboarding_cleared: number } | { ok: false; error: string };

export async function splitSync(store: SyncStore, sites: readonly SyncSite[], classify: (s: SyncSite) => { category: string; subcategory: string } | null): Promise<SyncResult> {
  const known = new Map<string, StoredSite>();
  for (let i = 0; i < sites.length; i += SYNC_PAGE) for (const r of await store.read(sites.slice(i, i + SYNC_PAGE).map(s => s.domain))) known.set(r.domain, r);
  const panel: SyncSite[] = [], fresh: SyncSite[] = [], waiting: SyncSite[] = [];
  for (const s of sites) { const r = known.get(s.domain); (!r ? fresh : r.panel_since ? panel : waiting).push(s); }
  // An RPC call without a panel row would set every active row inactive: the library would vanish. Refuse before writing anything.
  if (!panel.length) return { ok: false, error: "Sync refused: the payload holds no panel brand, and syncing it would empty the library." };
  // The RPC sets every active row it is not given inactive. A list that would drop many brands at once is far more
  // likely a wrong file or a short read than an intention, and it would bend every share: refuse it before writing.
  const sent = new Set(panel.map(s => s.domain)), active = await store.activeDomains(), leaving = active.filter(d => !sent.has(d));
  if (leaving.length > maxLeaving(active.length)) return { ok: false, error: `Sync refused: it would set ${leaving.length} of ${active.length} active brands inactive (at most ${maxLeaving(active.length)} in one sync).` };
  await store.rpcSync(panel.map(({ category: _c, subcategory: _s, ...s }) => s));
  if (fresh.length) await store.insertOnboarding(fresh.map(s => { const c = classify(s); return { domain: s.domain, sector: s.sector, name: s.name ?? s.domain, active: false, onboarding: true, panel_since: null, category: c?.category ?? null, subcategory: c?.subcategory ?? null }; }));
  for (const s of waiting) {
    const r = known.get(s.domain)!;
    if (r.onboarding && !r.active && r.sector === s.sector && s.name === undefined) continue;
    await store.updateOnboarding(s.domain, { sector: s.sector, ...(s.name ? { name: s.name } : {}), onboarding: true, active: false });
  }
  const listed = new Set(sites.map(s => s.domain)), dropped = (await store.onboardingDomains()).filter(d => !listed.has(d));
  if (dropped.length) await store.clearOnboarding(dropped);
  return { ok: true, panel: panel.length, onboarding_new: fresh.length, onboarding_kept: waiting.length, onboarding_cleared: dropped.length };
}
