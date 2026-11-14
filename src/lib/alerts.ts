// Pure wire-alert rules for the weekly forecast job. No I/O.
import { isCrossover } from "./curation";
import type { DiscourseSignal } from "./discourse";
import { SITE_URL } from "./site";

export const ALERT_KINDS = ["sentiment_turn", "crossover", "breakout", "discourse_spike", "saturation"] as const; // priority order
export type AlertKind = (typeof ALERT_KINDS)[number];
export const MAX_ALERTS = 10, ALERT_DEDUPE_DAYS = 28, SATURATION_SHARE = 0.35, BREAKOUT_MIN_SITES = 3, BREAKOUT_QUANTILE = 0.9;
export type AlertInput = {
  dimension: string; value: string; scope: string; status: string; stage: string | null; momentum: number | null; current_share: number | null; sites: number;
  prev?: { current_share: number | null; stage: string | null } | null;
  curation?: { lead_pts: number | null; prev_lead_pts: number | null } | null;
  discourse?: DiscourseSignal | null;
};
export type Alert = { kind: AlertKind; trait: string; scope: string; magnitude: number; title: string; excerpt: string };

const VALUE_ONLY = new Set(["aesthetic", "imagery", "components", "tone", "color_mood", "hero_layout", "framework", "css", "ai_positioning"]);
export const ticker = (dimension: string, value: string) => `$${(VALUE_ONLY.has(dimension) ? value : `${dimension}-${value}`).toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
const pct = (v: number | null | undefined) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);
const signed = (v: number, d = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}`;
function quantile(values: number[], q: number) { if (!values.length) return Infinity; const s = [...values].sort((a, b) => a - b), i = (s.length - 1) * q, f = Math.floor(i); return s[f]! + (s[Math.min(s.length - 1, f + 1)]! - s[f]!) * (i - f); }

/** All rule hits before dedupe. Breakout ranks across every ok row; trait-level rules use the library-wide ('all') row. */
/** Breakout: top-decile momentum (cut over every ok row) on ≥3 sites, below saturation share and not yet peaking/declining — bias against consensus; saturation alerts cover the rest. */
export function isBreakout(r: AlertInput, cut: number) {
  return r.status === "ok" && r.momentum !== null && r.momentum > 0 && r.momentum >= cut && r.sites >= BREAKOUT_MIN_SITES
    && r.current_share !== null && r.current_share < SATURATION_SHARE && r.stage !== "peaking" && r.stage !== "declining";
}
export function alertCandidates(rows: AlertInput[]): Alert[] {
  const out: Alert[] = [];
  const ok = rows.filter(r => r.status === "ok" && r.momentum !== null);
  const cut = quantile(ok.map(r => r.momentum!), BREAKOUT_QUANTILE);
  for (const r of rows) {
    const trait = `${r.dimension}:${r.value}`, t = ticker(r.dimension, r.value), base = `${r.sites} sites · share ${pct(r.current_share)} · stage ${r.stage ?? "n/a"}`;
    if (isBreakout(r, cut))
      out.push({ kind: "breakout", trait, scope: r.scope, magnitude: r.momentum, title: `BREAKOUT ${t} ${signed(r.momentum)} pts/q in ${r.scope}`, excerpt: `Momentum ${signed(r.momentum, 2)} pts/q ≥ top-decile cut ${signed(cut, 2)} across ${ok.length} fitted rows · share < 35%, not peaking/declining · ${base}` });
    if (r.scope !== "all") continue;
    const d = r.discourse;
    if (d?.fatigue_flag) out.push({ kind: "sentiment_turn", trait, scope: r.scope, magnitude: d.fatigue_ratio ?? 0, title: `SENTIMENT TURN ${t} fatigue ${pct(d.fatigue_ratio)} of mentions`, excerpt: `Fatigue language in ${pct(d.fatigue_ratio)} of mentions over 4 weeks (prior 4 weeks ${pct(d.prev_fatigue_ratio)}) · ${d.n_9w} mentions in 9 weeks · threshold 15%, n≥20 · ${base}` });
    const c = r.curation;
    if (c && isCrossover(c.prev_lead_pts, c.lead_pts)) out.push({ kind: "crossover", trait, scope: r.scope, magnitude: Math.abs(c.lead_pts! - c.prev_lead_pts!), title: `CROSSOVER ${t} curation lead ${signed(c.prev_lead_pts!)} → ${signed(c.lead_pts!)} pts`, excerpt: `Curated − mainstream share moved ${signed(c.lead_pts! - c.prev_lead_pts!)} pts between the last two crawl runs (sign flip, |Δ| ≥ 5) · ${base}` });
    if (d?.spike) out.push({ kind: "discourse_spike", trait, scope: r.scope, magnitude: d.spike_ratio ?? 0, title: `DISCOURSE SPIKE ${t} ${d.spike_ratio === null ? "new" : `${d.spike_ratio.toFixed(1)}×`} 8-week median`, excerpt: `${d.n_week} mentions this week · ${d.rate_per_10k ?? "—"} per 10k sampled posts · ${d.spike_ratio === null ? "no prior mentions" : `${d.spike_ratio.toFixed(2)}× the 8-week median rate`} · z ${d.z ?? "—"} · ${base}` });
    const p = r.prev;
    if (p && r.status === "ok") {
      const crossed = p.current_share !== null && p.current_share < SATURATION_SHARE && (r.current_share ?? 0) >= SATURATION_SHARE, peaked = p.stage !== "peaking" && r.stage === "peaking";
      if (crossed || peaked) out.push({ kind: "saturation", trait, scope: r.scope, magnitude: r.current_share ?? 0, title: `SATURATION ${t} ${crossed ? `${pct(r.current_share)} share` : "stage peaking"}`, excerpt: `${crossed ? `Share crossed 35% (${pct(p.current_share)} → ${pct(r.current_share)})` : `Stage ${p.stage ?? "n/a"} → peaking`} · ${base}` });
    }
  }
  return out;
}

/** Highest-priority alert per trait, skipping traits alerted in the last 28 days, capped at 10. */
export function selectAlerts(candidates: Alert[], recentTraits: Set<string>, max = MAX_ALERTS): Alert[] {
  const ranked = [...candidates].sort((a, b) => ALERT_KINDS.indexOf(a.kind) - ALERT_KINDS.indexOf(b.kind) || b.magnitude - a.magnitude || a.trait.localeCompare(b.trait));
  const seen = new Set(recentTraits), out: Alert[] = [];
  for (const a of ranked) { if (seen.has(a.trait)) continue; seen.add(a.trait); out.push(a); if (out.length >= max) break; }
  return out;
}

export function alertRow(a: Alert, runId: number, now: Date) {
  const link = `${SITE_URL}/?panel=brief&trait=${encodeURIComponent(a.trait)}&sector=${encodeURIComponent(a.scope)}&alert=${runId}-${a.kind}`;
  return { url: link, title: a.title.slice(0, 300), source: "DSGN/TERMINAL", source_kind: "alert", published_at: now.toISOString(), excerpt: `${a.excerpt} · run ${runId}`.slice(0, 600), link: null, ref: a.trait, tags: ["alert", a.kind] };
}
