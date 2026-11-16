// Forecast ledger: which calls are recorded, how each one resolves, and the hit rate. Pure, no I/O.
// Reads what a stored forecast row already holds (stage, share, momentum, next-wave score, the next-quarter band);
// never recomputes or changes a forecast.
import { qAdd, qIndex, usablePoints, THRESHOLDS, type SeriesPoint } from "../forecast";
import { isoWeekKey } from "../forecast-brief";
import { parseTraitId } from "../chart/model";
import { DIMENSIONS, label, scopeText, stageName, STAGES, type Dimension } from "../labels";

/**
 * THE LEDGER RULE — one constant, shown on /ledger and in the methodology. Every weekly forecast records, with no picking:
 *  - every trait×scope the weekly brief names (each forecast citation and its one call to watch),
 *  - every wire alert the run emitted, in the alert's own scope,
 *  - the top 20 traits by next-wave score in scope "all".
 * Each call is the stored next-quarter forecast (horizon 1, the first point of the chart card's band): a direction
 * and an 80% band for one target quarter. The first call stored for (week, trait, scope) stands; reruns never overwrite it.
 */
export const LEDGER_RULE = {
  briefNamed: true,
  alertsEmitted: true,
  topNextWave: 20,
  topScope: "all",
  horizonQ: 1,
  text: [
    "Every Sunday the forecast records its calls with no picking: every signal the weekly brief names, every alert it sends, and the 20 highest next-wave scores across all sectors.",
    "Each call is the next-quarter forecast already on the chart: a direction (up, down or flat) and an 80% band for the share of homepages in one target quarter.",
    "The first call stored for a signal and scope in a week stands. Reruns never overwrite it, and calls are never edited or deleted.",
  ],
} as const;
export const LEDGER_RULE_TEXT = LEDGER_RULE.text.join(" ");
/** Calls needed before a percentage is shown anywhere (ledger page, terminal, Digest numbers). */
export const MIN_RATE_N = 20;
/** The model's own dead-band: the backtest's direction rule, sign(round(Δshare·10⁴)), i.e. moves under 0.005 points are flat. */
export const DIRECTION_SCALE = 1e4;
export const COVERAGE_MIN = THRESHOLDS.coverage;
const EPS = 1e-9;

export type Direction = "up" | "down" | "flat";
export type Outcome = "hit" | "miss" | "void";
export type Origin = "weekly" | "alert";
export type SelectedBy = "brief" | "alert" | "top20";
export const direction = (delta: number): Direction => { const s = Math.sign(Math.round(delta * DIRECTION_SCALE)); return s > 0 ? "up" : s < 0 ? "down" : "flat"; };

export type QuarterPt = { q: string; s: number | null; n: number; c: number };
export type LedgerRow = { dimension: string; value: string; scope: string; status: string; stage: string | null; current_share: number | null; momentum: number | null; next_wave_score: number | null; quarters: QuarterPt[] | null; proj_q1: number | null; proj_q1_lo: number | null; proj_q1_hi: number | null };
export type BriefCitations = { watch?: { id: string } | null; sections: { citations: { kind: string; id: string }[] }[] } | null;
export type AlertRef = { ref: string | null; url: string };
export type Selection = { trait: string; scope: string; origin: Origin; selected_by: SelectedBy[] };
export type CallRecord = {
  run_id: number; week: string; made_at: string; trait: string; scope: string; origin: Origin; selected_by: SelectedBy[];
  stage_at_call: string | null; share_at_call: number | null; momentum: number | null; next_wave_score: number | null;
  direction: Direction | null; band_lo: number | null; band_mid: number | null; band_hi: number | null; horizon_q: number | null; target_quarter: string | null; data_through: string | null;
  backfilled: boolean; resolved_at: string | null; actual_share: number | null; actual_n: number | null; outcome: Outcome | null; outcome_reason: string | null;
};
export type StoredCall = CallRecord & { id: number };

const ORDER: SelectedBy[] = ["brief", "alert", "top20"];
const alertScope = (url: string) => { const m = /[?&]sector=([^&#]+)/.exec(url); return m ? decodeURIComponent(m[1]!) : "all"; };

/** Apply LEDGER_RULE to one run's stored outputs. Deterministic order: brief, alerts, then next-wave rank. */
export function selectCalls(input: { brief: BriefCitations; alerts: AlertRef[]; rows: Pick<LedgerRow, "dimension" | "value" | "scope" | "next_wave_score">[] }): Selection[] {
  const out = new Map<string, Selection>();
  const add = (trait: string, scope: string, by: SelectedBy) => {
    if (!trait.includes(":")) return;
    const k = `${trait}|${scope}`, cur = out.get(k);
    if (cur) { if (!cur.selected_by.includes(by)) cur.selected_by = [...cur.selected_by, by].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)); }
    else out.set(k, { trait, scope, origin: "weekly", selected_by: [by] });
    const s = out.get(k)!; s.origin = s.selected_by.includes("alert") ? "alert" : "weekly";
  };
  if (LEDGER_RULE.briefNamed && input.brief) {
    const ids = [...(input.brief.watch?.id ? [input.brief.watch.id] : []), ...input.brief.sections.flatMap(s => s.citations.filter(c => c.kind === "forecast").map(c => c.id))];
    for (const id of ids) { const t = parseTraitId(id); add(`${t.dimension}:${t.value}`, t.scope, "brief"); }
  }
  if (LEDGER_RULE.alertsEmitted) for (const a of input.alerts) if (a.ref) add(a.ref, alertScope(a.url), "alert");
  const top = input.rows.filter(r => r.scope === LEDGER_RULE.topScope && r.next_wave_score != null)
    .sort((a, b) => b.next_wave_score! - a.next_wave_score! || `${a.dimension}:${a.value}`.localeCompare(`${b.dimension}:${b.value}`)).slice(0, LEDGER_RULE.topNextWave);
  for (const r of top) add(`${r.dimension}:${r.value}`, r.scope, "top20");
  return [...out.values()];
}

const minDenom = (scope: string) => (scope === "all" ? THRESHOLDS.denomAll : THRESHOLDS.denomSector);
const usable = (pts: QuarterPt[] | null, scope: string) => usablePoints((pts ?? []).map((p): SeriesPoint => ({ quarter: p.q, share: p.s, denom: p.n, coverage: p.c })), scope);

/** One ledger row from a selection and the run's stored forecast row. Rows without a next-quarter band are recorded as void. */
export function buildCall(sel: Selection, row: LedgerRow | undefined, ctx: { run_id: number; made_at: string; data_through: string | null; backfilled: boolean }): CallRecord {
  const base: CallRecord = { run_id: ctx.run_id, week: isoWeekKey(new Date(ctx.made_at)), made_at: ctx.made_at, trait: sel.trait, scope: sel.scope, origin: sel.origin, selected_by: sel.selected_by,
    stage_at_call: row?.stage ?? null, share_at_call: row?.current_share ?? null, momentum: row?.momentum ?? null, next_wave_score: row?.next_wave_score ?? null,
    direction: null, band_lo: null, band_mid: null, band_hi: null, horizon_q: null, target_quarter: null, data_through: ctx.data_through, backfilled: ctx.backfilled,
    resolved_at: null, actual_share: null, actual_n: null, outcome: null, outcome_reason: null };
  const last = row ? usable(row.quarters, row.scope).at(-1) : undefined;
  if (!row || row.status !== "ok" || row.proj_q1 == null || row.proj_q1_lo == null || row.proj_q1_hi == null || row.current_share == null || !last) {
    return { ...base, resolved_at: ctx.made_at, outcome: "void", outcome_reason: row ? "No forecast band when the call was made: fewer than four usable quarters of history." : "The signal was not in this run's forecast." };
  }
  return { ...base, direction: direction(row.proj_q1 - row.current_share), band_lo: row.proj_q1_lo, band_mid: row.proj_q1, band_hi: row.proj_q1_hi, horizon_q: LEDGER_RULE.horizonQ, target_quarter: qAdd(last.quarter, LEDGER_RULE.horizonQ) };
}

/** First call stands: drop incoming rows whose (week, trait, scope) is already stored or repeated earlier in the batch. */
export const callKey = (c: Pick<CallRecord, "week" | "trait" | "scope">) => `${c.week}|${c.trait}|${c.scope}`;
export function firstStands<T extends Pick<CallRecord, "week" | "trait" | "scope">>(existing: Iterable<string>, incoming: T[]): T[] {
  const seen = new Set(existing), out: T[] = [];
  for (const c of incoming) { const k = callKey(c); if (seen.has(k)) continue; seen.add(k); out.push(c); }
  return out;
}

/** First day of the quarter after `q` (UTC), as YYYY-MM-DD. */
export function quarterAfterStart(q: string): string { const i = qIndex(q) + 1; return `${Math.floor(i / 4)}-${String((i % 4) * 3 + 1).padStart(2, "0")}-01`; }
/** Weekly forecasts run on Sundays: the first Sunday on or after the quarter after `q` starts. */
export function resolvesOn(q: string): string { const d = new Date(`${quarterAfterStart(q)}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7)); return d.toISOString().slice(0, 10); }
export const quarterText = (q: string | null) => (q && /^\d{4}Q[1-4]$/.test(q) ? `Q${q.slice(5)} ${q.slice(0, 4)}` : q ?? "—");
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const longDay = (iso: string) => { const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

export type Resolution = { outcome: Outcome; actual_share: number | null; actual_n: number | null; outcome_reason: string };
/**
 * Resolve one open call once its target quarter is complete in the data: the quarter has ended AND the newest stored run's data
 * runs past it. HIT = actual share inside the band (edges count) AND the direction from the share at call was right; else MISS.
 * VOID (not counted) when the trait lost coverage in the target quarter. Returns null while the call is still open.
 */
export function resolveCall(call: Pick<CallRecord, "outcome" | "target_quarter" | "scope" | "band_lo" | "band_hi" | "direction" | "share_at_call">, ctx: { now: Date; cutoff: string | null; tracked: boolean; point: QuarterPt | null | undefined }): Resolution | null {
  if (call.outcome != null || !call.target_quarter || call.band_lo == null || call.band_hi == null || !call.direction || call.share_at_call == null) return null;
  const t = call.target_quarter, when = quarterText(t);
  if (ctx.now.getTime() < Date.parse(`${quarterAfterStart(t)}T00:00:00Z`)) return null;
  if (!ctx.cutoff || !/^\d{4}Q[1-4]$/.test(ctx.cutoff) || qIndex(ctx.cutoff) <= qIndex(t)) return null;
  const min = minDenom(call.scope), p = ctx.point;
  if (!ctx.tracked) return { outcome: "void", actual_share: null, actual_n: null, outcome_reason: `Lost coverage: the signal dropped out of the forecast before ${when} could be checked.` };
  if (!p || p.s == null) return { outcome: "void", actual_share: null, actual_n: p?.n ?? null, outcome_reason: `Lost coverage: no measurement for ${when}.` };
  if (p.n < min) return { outcome: "void", actual_share: p.s, actual_n: p.n, outcome_reason: `Lost coverage: only ${p.n} sites measured in ${when} (needs ${min}).` };
  if (p.c < COVERAGE_MIN) return { outcome: "void", actual_share: p.s, actual_n: p.n, outcome_reason: `Lost coverage: archive coverage was ${Math.round(p.c * 100)}% in ${when} (needs ${Math.round(COVERAGE_MIN * 100)}%).` };
  const inBand = p.s >= call.band_lo - EPS && p.s <= call.band_hi + EPS, moved = direction(p.s - call.share_at_call), dirOk = moved === call.direction;
  const landed = `Landed at ${pct(p.s)} (${p.n} sites)`, band = `${pct(call.band_lo)}–${pct(call.band_hi)}`;
  const verb = (d: Direction) => (d === "up" ? "rose" : d === "down" ? "fell" : "held");
  if (inBand && dirOk) return { outcome: "hit", actual_share: p.s, actual_n: p.n, outcome_reason: `${landed}, inside ${band}, and ${verb(moved)} as called.` };
  const why = !inBand ? `outside ${band}` : `inside ${band}, but it ${verb(moved)} when we called ${call.direction}`;
  return { outcome: "miss", actual_share: p.s, actual_n: p.n, outcome_reason: `${landed}, ${why}.` };
}

/** "What we said", in plain words. Names come only from labels.ts. */
export function callSentence(c: Pick<CallRecord, "trait" | "scope" | "direction" | "share_at_call" | "band_lo" | "band_hi" | "target_quarter" | "outcome" | "outcome_reason">): string {
  const name = label(c.trait).name, where = c.scope === "all" ? "homepages" : `${scopeText(c.scope)} homepages`;
  if (!c.direction || c.band_lo == null || c.band_hi == null || c.share_at_call == null) return `No call on ${name}: not enough history for a forecast band.`;
  const band = `${(c.band_lo * 100).toFixed(1)}–${pct(c.band_hi)}`, by = quarterText(c.target_quarter);
  if (c.direction === "up") return `${name}: rising from ${pct(c.share_at_call)} to ${band} of ${where} by ${by}.`;
  if (c.direction === "down") return `${name}: falling from ${pct(c.share_at_call)} to ${band} of ${where} by ${by}.`;
  return `${name}: holding near ${pct(c.share_at_call)} (${band}) of ${where} through ${by}.`;
}
export const outcomeWord = (o: Outcome | null) => (o === "hit" ? "Hit" : o === "miss" ? "Miss" : o === "void" ? "Void" : "Open");

export type Group = { key: string; hits: number; misses: number; n: number; rate: number | null; text: string };
export type LedgerSummary = { total: number; open: number; resolved: number; hits: number; misses: number; voids: number; rate: number | null; headline: string; nextResolution: string | null; byDimension: Group[]; byStage: Group[] };
const rateText = (hits: number, n: number) => (n >= MIN_RATE_N ? `${Math.round((hits / n) * 100)}% (${hits} of ${n})` : n ? `${hits} of ${n} landed` : "none resolved");
/** Hit rate = hits / (hits + misses) over resolved calls; void and open calls are not counted. Percentages only from 20 resolved calls. */
export function ledgerSummary(calls: Pick<CallRecord, "outcome" | "trait" | "stage_at_call" | "target_quarter">[]): LedgerSummary {
  const hits = calls.filter(c => c.outcome === "hit").length, misses = calls.filter(c => c.outcome === "miss").length, voids = calls.filter(c => c.outcome === "void").length;
  const openCalls = calls.filter(c => c.outcome == null), resolved = hits + misses;
  const next = openCalls.map(c => c.target_quarter).filter((q): q is string => !!q).sort((a, b) => qIndex(a) - qIndex(b))[0];
  const nextResolution = next ? resolvesOn(next) : null;
  const rate = resolved >= MIN_RATE_N ? hits / resolved : null;
  const when = nextResolution ? `; the first full quarter resolves on ${longDay(nextResolution)}` : "";
  const headline = rate != null ? `${Math.round(rate * 100)}% of resolved calls landed (${hits} of ${resolved}).`
    : resolved === 0 ? `No call has resolved yet. Too few to call a rate yet${when}.`
    : `${hits} of ${resolved} resolved calls landed. Too few to call a rate yet${when}.`;
  const group = (keyOf: (c: (typeof calls)[number]) => string | null, keys: readonly string[]): Group[] => keys.map(key => {
    const g = calls.filter(c => keyOf(c) === key), h = g.filter(c => c.outcome === "hit").length, n = h + g.filter(c => c.outcome === "miss").length;
    return { key, hits: h, misses: n - h, n, rate: n >= MIN_RATE_N ? h / n : null, text: rateText(h, n) };
  });
  return { total: calls.length, open: openCalls.length, resolved, hits, misses, voids, rate, headline, nextResolution,
    byDimension: group(c => label(c.trait).dimension, DIMENSIONS as readonly Dimension[]),
    byStage: group(c => stageName(c.stage_at_call) ?? "Not staged", [...STAGES, "Not staged"]) };
}

/** Derived ledger work after a stored forecast: any failure is reported, never thrown, so the run stays ok. */
export async function nonFatal<T>(stage: string, fn: () => Promise<T>): Promise<T | { ok: false; code: string }> {
  try { return await fn(); }
  catch (e) { const code = `${stage}: ${(e instanceof Error ? e.message : "failed").replace(/[^\w .:-]/g, "").slice(0, 120)}`; console.error("forecast ledger step failed:", code); return { ok: false, code }; }
}

/** Display projection of one stored call (UI, MCP, explainers). */
export type LedgerItem = {
  id: number; week: string; made_at: string; trait: string; name: string; dimension: Dimension; scope: string; scope_text: string; stage_at_call: string | null;
  origin: Origin; selected_by: SelectedBy[]; said: string; direction: Direction | null; share_at_call: number | null; band: [number, number] | null; target_quarter: string | null; target_text: string;
  resolves_on: string | null; outcome: Outcome | null; outcome_word: string; outcome_reason: string | null; actual_share: number | null; actual_n: number | null; resolved_at: string | null;
  backfilled: boolean; run_id: number; explainer_path: string; receipts_path: string;
};
export function ledgerItem(c: StoredCall): LedgerItem {
  const l = label(c.trait);
  return { id: c.id, week: c.week, made_at: c.made_at, trait: c.trait, name: l.name, dimension: l.dimension, scope: c.scope, scope_text: scopeText(c.scope), stage_at_call: c.stage_at_call,
    origin: c.origin, selected_by: c.selected_by, said: callSentence(c), direction: c.direction, share_at_call: c.share_at_call, band: c.band_lo != null && c.band_hi != null ? [c.band_lo, c.band_hi] : null,
    target_quarter: c.target_quarter, target_text: quarterText(c.target_quarter), resolves_on: c.outcome == null && c.target_quarter ? resolvesOn(c.target_quarter) : null,
    outcome: c.outcome, outcome_word: outcomeWord(c.outcome), outcome_reason: c.outcome_reason, actual_share: c.actual_share, actual_n: c.actual_n, resolved_at: c.resolved_at,
    backfilled: c.backfilled, run_id: c.run_id, explainer_path: `/signals/${encodeURIComponent(c.trait)}`, receipts_path: `/terminal?panel=brief&trait=${encodeURIComponent(c.trait)}&sector=${encodeURIComponent(c.scope)}` };
}
/** Calls as they stood at `asOf`: resolutions written later count as still open (keeps old Digest issues unchanged). */
export const asOf = <T extends Pick<CallRecord, "made_at" | "resolved_at" | "outcome">>(calls: T[], iso: string): T[] =>
  calls.filter(c => c.made_at < iso).map(c => (c.resolved_at && c.resolved_at >= iso ? { ...c, outcome: null, resolved_at: null } : c));

export type Backtest = { cutoff: string | null; median_mae_pts: number | null; hit_rate: number | null; n: number; next_wave: { ranked: number; grew_5pts: number } | null; text: string };
/** The model card's history replay, kept apart from the live record (it is never mixed into the live hit rate). */
export function backtestOf(card: Record<string, unknown> | null): Backtest | null {
  if (!card) return null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const nw = card["next_wave_backtest"] && typeof card["next_wave_backtest"] === "object" ? card["next_wave_backtest"] as Record<string, unknown> : null;
  const cutoff = typeof card["backtest_cutoff"] === "string" ? card["backtest_cutoff"] : null, mae = num(card["median_mae_pts"]), hr = num(card["hit_rate"]), n = num(card["n_backtested"]) ?? 0;
  const next = nw && num(nw["ranked"]) ? { ranked: num(nw["ranked"])!, grew_5pts: num(nw["grew_5pts"]) ?? 0 } : null;
  const parts = [hr != null && n ? `Trained on data through ${quarterText(cutoff)} and replayed against the quarters after it, the curves called the direction right in a median ${Math.round(hr * 100)}% of quarters across ${n} signals${mae != null ? `, with a median error of ${mae.toFixed(1)} points` : ""}.` : `No signal had enough history before ${quarterText(cutoff)} to replay yet.`,
    next ? `Of the top ${next.ranked} next-wave picks at that cutoff, ${next.grew_5pts} grew by 5 points or more.` : null];
  return { cutoff, median_mae_pts: mae, hit_rate: hr, n, next_wave: next, text: parts.filter(Boolean).join(" ") };
}
