/** R2a · the panel entry rule. Pure: one place decides who counts in shares and trends. */
export type PanelSite = { domain: string; sector: string; active?: boolean | null; panel_since?: string | null };
export type Readiness = { domain: string; liveHomeCaptures: readonly string[]; archiveComplete: boolean; latestWellRead: boolean };

export const PANEL_FROM_QUARTER = '2020Q4';
export const PANEL_HOLD_DAYS = 7;
export const MIN_CAPTURE_GAP_MS = 24 * 3600_000;

/** In the panel: active and dated. Everything that is a share or a trend filters through this. */
export const inPanel = (s: PanelSite) => s.active !== false && !!s.panel_since;
export const onboarding = (s: PanelSite) => s.active !== false && !s.panel_since;
export const panelOnly = <T extends PanelSite>(rows: readonly T[]) => rows.filter(inPanel);
export const panelDomains = (rows: readonly PanelSite[]) => new Set(panelOnly(rows).map(r => r.domain));

/** Ready: two live home captures more than 24 h apart, archive back to 2020 Q4 settled, latest capture well read. */
export function isReady(r: Readiness): boolean {
  const t = r.liveHomeCaptures.map(x => Date.parse(x)).filter(Number.isFinite).sort((a, b) => a - b);
  const spread = t.length >= 2 && t[t.length - 1]! - t[0]! > MIN_CAPTURE_GAP_MS;
  return spread && r.archiveComplete && r.latestWellRead;
}

/** Every quarter from 2020 Q4 to `upTo` is read or recorded as not available. */
export function archiveComplete(settled: ReadonlySet<string>, upTo: string): boolean {
  for (let q = PANEL_FROM_QUARTER; q <= upTo; q = nextQuarter(q)) if (!settled.has(q)) return false;
  return true;
}
export function nextQuarter(q: string): string {
  const y = Number(q.slice(0, 4)), n = Number(q.slice(5));
  return n >= 4 ? `${y + 1}Q1` : `${y}Q${n + 1}`;
}

export type PanelStepPlan = { at: string; domains: string[]; brands_before: number; brands_after: number; by_sector: Record<string, number> };
/** All ready onboarding brands at once, never a trickle; null when nobody is ready. */
export function planPanelStep(sites: readonly PanelSite[], ready: ReadonlySet<string>, at: string): PanelStepPlan | null {
  const joining = sites.filter(s => onboarding(s) && ready.has(s.domain));
  if (!joining.length) return null;
  const before = panelOnly(sites).length, by_sector: Record<string, number> = {};
  for (const s of joining) by_sector[s.sector] = (by_sector[s.sector] ?? 0) + 1;
  return { at, domains: joining.map(s => s.domain).sort(), brands_before: before, brands_after: before + joining.length, by_sector };
}
export function applyPanelStep<T extends PanelSite>(sites: readonly T[], plan: PanelStepPlan): T[] {
  const j = new Set(plan.domains);
  return sites.map(s => (j.has(s.domain) ? { ...s, panel_since: plan.at } : s));
}

/** The follow-up topics a step marks for a full recompute over the larger panel. */
export const PANEL_RECOMPUTE_TOPICS = ['panel:shares', 'panel:structure', 'panel:lead-lag', 'panel:kit', 'panel:forecast', 'panel:backtest'] as const;

export type PanelStepRow = { at: string; brands_before: number; brands_after: number };
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
/** The readout note at a step's tick on every share chart. */
export const panelStepNote = (s: PanelStepRow) =>
  `Panel grew from ${s.brands_before} to ${s.brands_after} brands on ${fmt(s.at)}; earlier quarters are recomputed over the larger panel`;
export function quarterOf(iso: string): string {
  const d = new Date(iso); return `${d.getUTCFullYear()}Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
}
/** Chart ticks: one per step, at the quarter it happened in. */
export const panelTicks = (steps: readonly PanelStepRow[]) => steps.map(s => ({ quarter: quarterOf(s.at), note: panelStepNote(s) }));

/** A tier / rising-fading change within a week after a step is held for the data desk, never published from the step alone. */
export function holdForStep(changedAt: string, steps: readonly PanelStepRow[]): PanelStepRow | null {
  const t = Date.parse(changedAt);
  return steps.find(s => { const a = Date.parse(s.at); return t >= a && t - a < PANEL_HOLD_DAYS * 86400_000; }) ?? null;
}

/** Single-brand events of onboarding brands are stored but kept out of Latest changes, the story queue and RSS. */
export const eventVisible = (domain: string, panel: ReadonlySet<string>) => panel.has(domain);

/** Board line and chips: panel count plus a separate onboarding count. */
export function splitCounts(rows: readonly PanelSite[]) {
  return { panel: panelOnly(rows).length, onboarding: rows.filter(onboarding).length };
}
export const onboardingNote = (n: number) => (n > 0 ? `+${n} onboarding` : '');

/** The methodology section, generated from the stored steps. */
export function howThePanelGrows(steps: readonly (PanelStepRow & { by_sector?: Record<string, number> })[], panel: number | null): string[] {
  const lines = [
    `Every share on slug is a count over the panel: the ${panel != null ? `${panel} ` : ""}homepages slug reads that have joined it. A brand added to the library starts as onboarding. Its own pages are readable at once, but it counts in no share, trend, forecast or story until it joins.`,
    'A brand is ready when slug has two live readings of its homepage more than a day apart, every quarter back to the end of 2020 is read from archived copies or recorded as not available, and its latest reading is clear. Ready brands join together, on one dated step, and every quarter of every series is then recomputed over the larger panel.',
  ];
  if (!steps.length) lines.push('The panel has not grown since slug began reading.');
  for (const s of steps) lines.push(`${fmt(s.at)}: ${s.brands_before} to ${s.brands_after} brands.`);
  return lines;
}

/** The health / engineering summary line. */
export function panelHealthLine(f: { panel: number; onboarding: number; ready: number; unfiled: number; last_step: PanelStepRow | null }): string {
  const step = f.last_step ? `last panel step ${fmt(f.last_step.at)} (${f.last_step.brands_before} to ${f.last_step.brands_after})` : "no panel step yet";
  return `Panel ${f.panel} brands; ${f.onboarding} onboarding (${f.ready} ready); ${f.unfiled} unfiled; ${step}.`;
}
