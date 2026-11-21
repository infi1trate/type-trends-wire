// L1 · what moves a setting: rules as data over measured signals of the leading brands only (the reader run's trendsetter ranking,
// top LEADING_TOP), and a dry run that says what the next edition would propose today. One step at most per edition, however far the
// signal has moved. Measured fields only (the crawler's computed styles and pixel ratios), never AI-read tags. Pure: no I/O, writes
// nothing.
import { SETTINGS, SETTING_IDS, stepped, valueText, type LivingValues, type SettingId, type Value } from "./settings";

/** The leading group: the top 30 of the trendsetter ranking (the same 30 the forecast's trendsetter gap reads), active brands with a
 *  current capture. */
export const LEADING_TOP = 30;
/** A share is read only when at least this many leading brands have the field measured. */
export const MIN_BASE = 15;
/** One leading brand's current measured fields (library_site_history, now). */
export type LeadingRow = { domain: string; rank: number; captured_at: string | null; cta_radius_bucket: string | null; h1_tracking: number | null; whitespace_ratio: number | null };

export const SIGNAL_IDS = ["pill_buttons", "tight_headlines", "generous_whitespace"] as const;
export type SignalId = (typeof SIGNAL_IDS)[number];
/** Each signal: its plain name, what counts it and what it is counted among. Thresholds mirror the library's own trait cut-offs. */
export const SIGNALS: Record<SignalId, { name: string; trait: string; counts: (r: LeadingRow) => boolean | null; base: string }> = {
  pill_buttons: { name: "Pill buttons", trait: "cta_shape:pill", base: "leading brands whose main button we measured",
    counts: r => (r.cta_radius_bucket == null ? null : r.cta_radius_bucket === "pill") },
  tight_headlines: { name: "Tight headline spacing", trait: "tracking:tight", base: "leading brands whose headline spacing we measured",
    counts: r => (typeof r.h1_tracking !== "number" ? null : r.h1_tracking <= -0.02) },
  generous_whitespace: { name: "Generous whitespace (60% or more of the first screen)", trait: "whitespace:high", base: "leading brands whose first screen we measured",
    counts: r => (typeof r.whitespace_ratio !== "number" ? null : r.whitespace_ratio >= 0.6) },
};

/** A rule: when the signal's share in the leading group is at or above `at`, the setting takes one step `up`; at or below `back`, one
 *  step the other way. Between them, no move. PROPOSED, like the ranges. */
export type Rule = { setting: SettingId; signal: SignalId; group: "leading"; at: number; up: 1 | -1; back: number; text: string };
export const RULES: readonly Rule[] = [
  { setting: "radius", signal: "pill_buttons", group: "leading", at: 0.6, up: 1, back: 0.2, text: "Pill buttons on 60% or more of the leading brands: corners one step rounder; 20% or fewer: one step squarer." },
  { setting: "tracking", signal: "tight_headlines", group: "leading", at: 0.6, up: -1, back: 0.2, text: "Tight headline spacing on 60% or more of the leading brands: headings one step tighter; 20% or fewer: one step looser." },
  { setting: "density", signal: "generous_whitespace", group: "leading", at: 0.6, up: 1, back: 0.2, text: "Generous whitespace on 60% or more of the leading brands: one step more space between sections; 20% or fewer: one step less." },
];
export const ruleOf = (id: SettingId) => RULES.find(r => r.setting === id) ?? null;

export type SignalShare = { signal: SignalId; name: string; count: number; base: number; group: number; share: number | null; domains: string[] };
/** Each signal's count among the leading brands that have the field measured. */
export function leadingShares(rows: readonly LeadingRow[]): Record<SignalId, SignalShare> {
  return Object.fromEntries(SIGNAL_IDS.map(id => {
    const s = SIGNALS[id], judged = rows.map(r => ({ r, c: s.counts(r) })).filter(x => x.c !== null), hit = judged.filter(x => x.c);
    return [id, { signal: id, name: s.name, count: hit.length, base: judged.length, group: rows.length, share: judged.length >= MIN_BASE ? hit.length / judged.length : null, domains: hit.map(x => x.r.domain).sort() }];
  })) as Record<SignalId, SignalShare>;
}
/** "Pill buttons on 10 of 18 leading brands whose main button we measured (56%)". */
export const shareText = (s: SignalShare) => `${s.name} on ${s.count} of ${s.base} ${SIGNALS[s.signal].base}${s.base ? ` (${Math.round(s.count / s.base * 100)}%)` : ""}`;

export type DryRow = { setting: SettingId; name: string; current: Value; currentText: string; driver: "signal" | "hand"; signal: SignalShare | null; signalText: string | null; rule: string | null;
  proposed: Value | null; proposedText: string; reason: string };
/** What the next edition would propose today: for each setting, its value, its signal in the leading group, the rule and the outcome. */
export function dryRun(values: LivingValues, rows: readonly LeadingRow[]): { group: number; rows: DryRow[] } {
  const shares = leadingShares(rows);
  const out = SETTING_IDS.map((id): DryRow => {
    const set = SETTINGS[id], rule = ruleOf(id), cur = values[id], base = { setting: id, name: set.name, current: cur, currentText: valueText(id, cur), driver: set.driver };
    if (!rule) return { ...base, signal: null, signalText: null, rule: null, proposed: null, proposedText: "Set by hand", reason: "No measured signal of the leading brands drives this setting; it is set by hand at each edition." };
    const s = shares[rule.signal], text = shareText(s);
    const none = (reason: string): DryRow => ({ ...base, signal: s, signalText: text, rule: rule.text, proposed: null, proposedText: "No move", reason });
    if (s.share === null) return none(`Fewer than ${MIN_BASE} leading brands have this measured, so the rule does not read it.`);
    const dir = s.share >= rule.at ? rule.up : s.share <= rule.back ? (-rule.up as 1 | -1) : 0;
    if (!dir) return none(`The share is between ${Math.round(rule.back * 100)}% and ${Math.round(rule.at * 100)}%.`);
    const next = stepped(id, cur as number, dir);
    if (next === null) return none(`The rule fired, but the setting is already at its ${dir > 0 ? "ceiling" : "floor"}.`);
    return { ...base, signal: s, signalText: text, rule: rule.text, proposed: next, proposedText: valueText(id, next), reason: `One step ${dir > 0 ? "up" : "down"}.` };
  });
  return { group: rows.length, rows: out };
}
