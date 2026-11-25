/** R2a-2 · pure shaping of onboarding brands for the crawler's state answers, in the exact shape the RPCs return, plus onboarding: true. */
export type LiveSnap = { page_type: string; viewport: string; html_hash: string | null; content_hash: string | null; signals_hash: string | null; captured_at: string };
export type ArchiveSnap = { captured_at: string; quarter: string | null };
export type OnboardingSite = { domain: string; sector: string; pages: unknown };

/** Newest live capture per page_type:viewport (rows in any order). */
export function latestByKey(rows: readonly LiveSnap[]) {
  const out: Record<string, { html_hash: string | null; content_hash: string | null; signals_hash: string | null; captured_at: string }> = {};
  for (const r of rows) { const k = `${r.page_type}:${r.viewport}`, cur = out[k]; if (!cur || r.captured_at > cur.captured_at) out[k] = { html_hash: r.html_hash, content_hash: r.content_hash, signals_hash: r.signals_hash, captured_at: r.captured_at }; }
  return out;
}
export const liveEntry = (s: OnboardingSite, live: readonly LiveSnap[], wayback: readonly ArchiveSnap[]) =>
  ({ domain: s.domain, sector: s.sector, active: false, pages: s.pages ?? {}, latest: latestByKey(live), wayback: [...wayback].sort((a, b) => a.captured_at.localeCompare(b.captured_at)).map(w => w.captured_at), onboarding: true as const });
export const archiveEntry = (s: OnboardingSite, wayback: readonly ArchiveSnap[]) =>
  ({ domain: s.domain, wayback: [...wayback].sort((a, b) => a.captured_at.localeCompare(b.captured_at)), onboarding: true as const });

/** Adds entries to an RPC answer ({ sites: [...] }), keeping its order by domain and every other field. */
export function withOnboarding(data: unknown, extra: readonly { domain: string }[]): unknown {
  if (!extra.length || !data || typeof data !== "object" || Array.isArray(data)) return data;
  const d = data as { sites?: { domain: string }[] }, have = new Set((d.sites ?? []).map(s => s.domain));
  const sites = [...(d.sites ?? []), ...extra.filter(e => !have.has(e.domain))].sort((a, b) => a.domain.localeCompare(b.domain));
  return { ...d, sites };
}
