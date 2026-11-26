/** R2a · the panel entry rule. Pure: one place decides who counts in shares and trends. */
export type PanelSite = { domain: string; sector: string; active?: boolean | null; panel_since?: string | null; onboarding?: boolean | null };
export type Readiness = { domain: string; liveHomeCaptures: readonly string[]; archiveComplete: boolean; latestWellRead: boolean };

export const PANEL_FROM_QUARTER = '2021Q1'; // the archive crawler (START_YEAR) and every series begin here
export const PANEL_HOLD_DAYS = 7;
/** The archive readings a brand needs before it joins: the first quarter of each year, which is the archive crawler's
 *  first pass (crawler/src/wayback-lib.js passOf) and what every panel brand has. The crawler's later passes fill the
 *  other quarters for all brands alike; asking for them here would hold a new brand to more than the panel itself holds. */
export const panelArchiveQuarter = (q: string) => q.endsWith('Q1');
export const MIN_CAPTURE_GAP_MS = 24 * 3600_000;

/** In the panel: active and dated. Everything that is a share or a trend filters through this. */
export const inPanel = (s: PanelSite) => s.active === true && !!s.panel_since;
/** R2a-2 · onboarding is its own stored flag; such rows are inactive and invisible to readers until a panel step. */
export const onboarding = (s: PanelSite) => s.onboarding === true;
export const panelOnly = <T extends PanelSite>(rows: readonly T[]) => rows.filter(inPanel);
export const panelDomains = (rows: readonly PanelSite[]) => new Set(panelOnly(rows).map(r => r.domain));

/** Ready: two live home captures more than 24 h apart, archive back to 2021 Q1 settled, latest capture well read. */
export function isReady(r: Readiness): boolean {
  const t = r.liveHomeCaptures.map(x => Date.parse(x)).filter(Number.isFinite).sort((a, b) => a - b);
  const spread = t.length >= 2 && t[t.length - 1]! - t[0]! > MIN_CAPTURE_GAP_MS;
  return spread && r.archiveComplete && r.latestWellRead;
}

/** Every quarter from 2021 Q1 to `upTo` is read or recorded as not available. */
export function archiveComplete(settled: ReadonlySet<string>, upTo: string): boolean {
  for (let q = PANEL_FROM_QUARTER; q <= upTo; q = nextQuarter(q)) if (panelArchiveQuarter(q) && !settled.has(q)) return false;
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
  return sites.map(s => (j.has(s.domain) ? { ...s, active: true, onboarding: false, panel_since: plan.at } : s));
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
    'A brand is ready when slug has two live readings of its homepage more than a day apart, the first quarter of every year back to 2021 is read from an archived copy or recorded as not available, and its latest reading is clear. Ready brands join together, on one dated step, and every quarter of every series is then recomputed over the larger panel.',
  ];
  if (!steps.length) lines.push('The panel has not grown since slug began reading.');
  for (const s of steps) lines.push(`${fmt(s.at)}: ${s.brands_before} to ${s.brands_after} brands.`);
  return lines;
}

/** The health / engineering summary line. */
export function panelHealthLine(f: { panel: number; onboarding: number; ready: number; unfiled: number; last_step: PanelStepRow | null; invariant?: readonly string[] }): string {
  const step = f.last_step ? `last panel step ${fmt(f.last_step.at)} (${f.last_step.brands_before} to ${f.last_step.brands_after})` : "no panel step yet";
  const broken = f.invariant?.length ? ` PANEL INVARIANT BROKEN: ${f.invariant.join("; ")}.` : "";
  return `Panel ${f.panel} brands; ${f.onboarding} onboarding (${f.ready} ready); ${f.unfiled} unfiled; ${step}.${broken}`;
}

export function prevQuarter(q: string): string {
  const y = Number(q.slice(0, 4)), n = Number(q.slice(5));
  return n <= 1 ? `${y - 1}Q4` : `${y}Q${n - 1}`;
}
export type ReadinessInput = { liveHomeCaptures: readonly string[]; archiveQuarters: ReadonlySet<string>; gapQuarters: ReadonlySet<string>; latestWellRead: boolean };
/** R2a-2 · readiness with its reasons. The first quarter of each year from 2021Q1 up to the quarter before `now` is settled by a stored archive copy
 *  or a recorded gap; the current quarter is settled by the live captures. */
export function readiness(r: ReadinessInput, now: Date): { ready: boolean; missing: string[] } {
  const missing: string[] = [];
  const t = r.liveHomeCaptures.map(x => Date.parse(x)).filter(Number.isFinite).sort((a, b) => a - b);
  if (t.length < 2) missing.push(`live home captures: ${t.length} of 2`);
  else if (t[t.length - 1]! - t[0]! <= MIN_CAPTURE_GAP_MS) missing.push("live home captures are not more than 24 hours apart");
  const upTo = prevQuarter(quarterOf(now.toISOString())), quarters: string[] = [];
  for (let q = PANEL_FROM_QUARTER; q <= upTo; q = nextQuarter(q)) if (panelArchiveQuarter(q) && !r.archiveQuarters.has(q) && !r.gapQuarters.has(q)) quarters.push(q);
  if (quarters.length) missing.push(`archive quarters not settled: ${quarters.join(", ")}`);
  if (t.length && !r.latestWellRead) missing.push("latest live capture does not read clearly");
  return { ready: !missing.length, missing };
}
/** R2a-2 · invariants the health line checks loudly. */
export function panelInvariantProblems(rows: readonly PanelSite[]): string[] {
  const p: string[] = [];
  const noDate = rows.filter(r => r.active === true && !r.panel_since).map(r => r.domain);
  const both = rows.filter(r => r.active === true && r.onboarding === true).map(r => r.domain);
  if (noDate.length) p.push(`active without panel_since: ${noDate.slice(0, 10).join(", ")}${noDate.length > 10 ? ` (+${noDate.length - 10})` : ""}`);
  if (both.length) p.push(`active and onboarding: ${both.slice(0, 10).join(", ")}${both.length > 10 ? ` (+${both.length - 10})` : ""}`);
  return p;
}

// R2b ------------------------------------------------------------------------------------------------
/** Stored reader records that list or count brands; a real step marks them so the records sweep rebuilds them at its next pass. */
export const PANEL_RECORD_KINDS = ['brands-index', 'site-index', 'collections', 'collection', 'gallery', 'data-index', 'signals', 'quarter-series'] as const;
export const panelRecordKey = (key: string) => (PANEL_RECORD_KINDS as readonly string[]).includes(key.split(':')[0] ?? key);
/** What is only right after the weekly forecast run on the new panel (written to the step's note). */
export const AFTER_FORECAST_NOTE = 'Right only after the next weekly forecast run on this panel: the forecasts and tiers (held for one run), the structure series, lead and lag, and the designer-kit records. Shares and history restate within minutes; the stored brand lists rebuild at the next records sweep.';

/** The dry step's not-ready brands grouped by reason, with counts and up to 20 example domains each. */
export type NotReadyGroup = { reason: string; count: number; examples: string[]; quarters?: string[] };
export function notReadyByReason(waiting: readonly { domain: string; missing: readonly string[] }[], max = 20): NotReadyGroup[] {
  const groups = new Map<string, { domains: string[]; quarters: Set<string> }>();
  const add = (reason: string, domain: string, qs: string[] = []) => { const g = groups.get(reason) ?? { domains: [], quarters: new Set<string>() }; g.domains.push(domain); qs.forEach(q => g.quarters.add(q)); groups.set(reason, g); };
  for (const w of waiting) for (const m of w.missing) {
    if (m.startsWith('live home captures:')) add('fewer than two live readings', w.domain);
    else if (m.startsWith('live home captures are not')) add('second live reading less than a day after the first', w.domain);
    else if (m.startsWith('archive quarters not settled:')) add('yearly archive quarter not settled', w.domain, m.slice('archive quarters not settled:'.length).split(',').map(x => x.trim()).filter(Boolean));
    else if (m.startsWith('latest live capture')) add('latest reading unclear', w.domain);
    else add(m, w.domain);
  }
  return [...groups].map(([reason, g]) => ({ reason, count: g.domains.length, examples: [...g.domains].sort().slice(0, max), ...(g.quarters.size ? { quarters: [...g.quarters].sort() } : {}) })).sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}
/** The backdated time that makes a record due at the sweep's next pass while readers keep its copy (older than `every`, younger than its max age). */
export const markedAt = (every: number, now: number) => new Date(now - every - 1000).toISOString();
