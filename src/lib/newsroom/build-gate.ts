// N4 · THE GATE every product change passes before it can go live (pure). The door takes no verdict: `gate_result` names the item, the
// commit, the test numbers and two review runs (before and after the build), and this file works out every check with its numbers.
// A design move also passes the living-design gate (`gate()` in living/gate.ts), called here, not copied. Shown on /desk from these
// constants.
import { SPEED_TARGETS } from "../perf/speed";
import { COMPARE_PAGES, COMPARE_WIDTHS, gate as livingGate } from "../living/gate";
import { isSettingId, type LivingValues, type Value } from "../living/settings";
import type { Move } from "../living/editions";
import { REVIEW_PAGES, REVIEW_WIDTHS, cellsOf, missingCells, type ReviewKind, type ReviewRow } from "./design-review";
import { needsProposal, type Expects } from "./queue";

/** How much visible change each expectation allows on every page and width of the review list. */
export const VISIBLE_LIMITS = {
  "no visible change": { share: 0.01, heightPx: 20, heightShare: null },
  small: { share: 0.1, heightPx: null, heightShare: 0.08 },
  layout: null,
} as const;
/** Measures that may not rise above the before run on any page and width. */
export const NO_WORSE = ["console_errors", "failed_requests", "small_targets", "low_contrast"] as const;
/** P2 · the speed measures the gate judges against history, with how much worse than the history's middle value counts as this
 *  deploy's doing. */
export const SPEED_TOLERANCE = { first_byte_ms: 150, lcp_ms: 300, cls: 0.02 } as const;
export type SpeedMeasure = keyof typeof SPEED_TOLERANCE;
/** How many stored runs before the after run make a page's history, and which kinds count. */
export const HISTORY_RUNS = 5;
export const HISTORY_KINDS: readonly ReviewKind[] = ["weekly", "before", "after"];
/** P2b · first byte and largest paint on an after run compare with other just-after-deploy runs only: the last HISTORY_RUNS runs of kind
 *  "after" measured at or after this time. Earlier first bytes were measured with a headless browser name, which made the site render the
 *  whole page before its first byte, so they read slow. */
export const REVIEW_NAME_SINCE = "2026-11-22T19:45:00Z";
/** With fewer than this many such runs, the measure falls back to the pair rule against the gate's own before run. */
export const AFTER_HISTORY_MIN = 3;
/** Measures whose history is after runs only (layout shift never depended on the browser name and keeps every counted kind). */
export const AFTER_ONLY: readonly SpeedMeasure[] = ["first_byte_ms", "lcp_ms"];
const SPEED_TARGET_OF: Record<SpeedMeasure, number> = { first_byte_ms: SPEED_TARGETS.firstMs, lcp_ms: SPEED_TARGETS.lcpMs, cls: SPEED_TARGETS.cls };
export const NOT_CAUSED = "over target, not caused by this deploy";
/** The middle value (the mean of the middle two for an even count). */
export const middleOf = (xs: readonly number[]) => { const a = [...xs].sort((x, y) => x - y), n = a.length; return n ? (n % 2 ? a[(n - 1) / 2]! : (a[n / 2 - 1]! + a[n / 2]!) / 2) : null; };
/** A page and width over its target but not worse than its history by more than the tolerance (filed once as a bug by the gate). */
export type NotCaused = { key: string; page: string; width: number; measure: SpeedMeasure; after: number; middle: number; runs: string[]; line: string };
const runAt = (r: GateRun) => r.rows.reduce((m, x) => (x.at < m ? x.at : m), r.rows[0]?.at ?? "");
/** One page and width's history for one measure: the values of its last HISTORY_RUNS stored runs of a counted kind older than the
 *  after run (newest first), or, with none, the named before run's value. P2b · first byte and largest paint read only after runs
 *  measured since REVIEW_NAME_SINCE, never this gate's before run; with fewer than AFTER_HISTORY_MIN of them the history is the before
 *  run alone (the pair rule). */
export function historyOf(page: string, width: number, measure: SpeedMeasure, after: GateRun, history: readonly GateRun[], before: GateRun | null): { values: number[]; runs: string[]; pair: boolean } {
  const t = runAt(after), values: number[] = [], runs: string[] = [], afterOnly = AFTER_ONLY.includes(measure);
  const counted = (h: GateRun) => (afterOnly ? h.kind === "after" && runAt(h) >= REVIEW_NAME_SINCE && h.run !== before?.run : h.kind != null && HISTORY_KINDS.includes(h.kind));
  const older = history.filter(h => h.run !== after.run && counted(h) && h.rows.length && runAt(h) < t).sort((a, b) => runAt(b).localeCompare(runAt(a)));
  for (const h of older) {
    const v = h.rows.find(r => r.page === page && r.width === width)?.measures[measure];
    if (typeof v === "number") { values.push(v); runs.push(h.run); }
    if (values.length >= HISTORY_RUNS) break;
  }
  const pairRule = afterOnly ? values.length < AFTER_HISTORY_MIN : !values.length;
  if (pairRule) {
    values.length = 0; runs.length = 0;
    if (before && before.kind !== "test") { const v = before.rows.find(r => r.page === page && r.width === width)?.measures[measure]; if (typeof v === "number") { values.push(v); runs.push(before.run); } }
  }
  return { values, runs, pair: afterOnly && pairRule };
}
/**
 * P2 · one speed measure over the after run, judged against history: it fails only when the after value is over its target and worse
 * than the middle of its history by more than its tolerance. Over target but not worse is reported as "over target, not caused by this
 * deploy" and does not fail. A missing measure is "not measured" and fails neither way.
 */
export function speedProblems(after: GateRun, history: readonly GateRun[], before: GateRun | null, measure: SpeedMeasure) {
  const target = SPEED_TARGET_OF[measure], tol = SPEED_TOLERANCE[measure], problems: string[] = [], notMeasured: string[] = [], notCaused: NotCaused[] = [];
  const fmt = (x: number) => (measure === "cls" ? String(Math.round(x * 1000) / 1000) : `${Math.round(x)} ms`), what = measure === "cls" ? "layout shift" : measure === "lcp_ms" ? "largest paint" : "first byte";
  let worst = 0;
  for (const r of cellsOf(after.rows).values()) {
    const y = r.measures[measure];
    if (typeof y !== "number") { notMeasured.push(where(r)); continue; }
    worst = Math.max(worst, y);
    if (y <= target) continue;
    const h = historyOf(r.page, r.width, measure, after, history, before), mid = middleOf(h.values);
    if (mid != null && y - mid <= tol + 1e-9) {
      notCaused.push({ key: `speed:${measure}:${r.page}@${r.width}`, page: r.page, width: r.width, measure, after: y, middle: mid, runs: h.runs, line: h.pair ? `${where(r)}: ${what} ${fmt(y)}, over ${fmt(target)}; the before run read ${fmt(mid)}: ${NOT_CAUSED}.` : `${where(r)}: ${what} ${fmt(y)}, over ${fmt(target)}; its last ${h.values.length} run${h.values.length === 1 ? "" : "s"} read ${fmt(mid)} in the middle: ${NOT_CAUSED}.` });
      continue;
    }
    problems.push(mid == null ? `${where(r)}: ${what} ${fmt(y)}, over ${fmt(target)}, with no earlier run to compare.` : h.pair ? `${where(r)}: ${what} ${fmt(y)}, over ${fmt(target)} and ${fmt(y - mid)} worse than the before run (${fmt(mid)}; tolerance ${fmt(tol)}).` : `${where(r)}: ${what} ${fmt(y)}, over ${fmt(target)} and ${fmt(y - mid)} worse than the middle of its last ${h.values.length} run${h.values.length === 1 ? "" : "s"} (${fmt(mid)}; tolerance ${fmt(tol)}).`);
  }
  const round = (x: number) => (measure === "cls" ? Math.round(x * 1000) / 1000 : Math.round(x));
  return { problems, notCaused, numbers: { target, tolerance: tol, worst: round(worst), not_measured: notMeasured, not_caused: notCaused.map(n => ({ page: n.page, width: n.width, after: round(n.after), middle: round(n.middle), runs: n.runs })) } };
}
/** The gate's checks, in the order they are run and shown. */
export const GATE_CHECKS = [
  { id: "tests", name: "No failed tests" },
  { id: "complete", name: "Every page and width of the review list is in the after run" },
  { id: "overflow", name: "No page scrolls sideways at any width" },
  { id: "first_byte", name: `First byte within ${SPEED_TARGETS.firstMs} ms on every page and width, or no more than ${SPEED_TOLERANCE.first_byte_ms} ms worse than the middle of its last ${HISTORY_RUNS} after runs measured since ${REVIEW_NAME_SINCE.slice(0, 16).replace("T", " ")} UTC (with fewer than ${AFTER_HISTORY_MIN}, than the before run)` },
  { id: "layout_shift", name: `Layout shift within ${SPEED_TARGETS.cls} on every page and width, or no more than ${SPEED_TOLERANCE.cls} worse than the middle of its last ${HISTORY_RUNS} weekly, before or after runs` },
  { id: "largest_paint", name: `Largest paint within ${SPEED_TARGETS.lcpMs} ms on every page and width, or no more than ${SPEED_TOLERANCE.lcp_ms} ms worse than the middle of its last ${HISTORY_RUNS} after runs measured since ${REVIEW_NAME_SINCE.slice(0, 16).replace("T", " ")} UTC (with fewer than ${AFTER_HISTORY_MIN}, than the before run)` },
  { id: "no_worse", name: "Console errors, failed requests, small tap targets and low-contrast text not above the before run" },
  { id: "visible", name: "Visible change within what the item said to expect (no visible change: at most 1% of pixels and 20 px of height; small: 10% and 8%; layout: no pixel limit)" },
  { id: "proposal", name: "A layout change has the owner's accepted proposal" },
  { id: "living", name: "A design move passes the living-design gate" },
] as const;
export type GateCheckId = (typeof GATE_CHECKS)[number]["id"];
export type GateCheck = { id: GateCheckId; name: string; ok: boolean; applies: boolean; numbers: Record<string, unknown>; problems: string[] };
export type GateRun = { run: string; kind: ReviewKind | null; rows: readonly ReviewRow[] };
export type GateInput = {
  item: { kind: string; expects: Expects; move: { setting: string; from?: Value; to: Value } | null };
  tests: { passed: number; failed: number; skipped: number };
  before: GateRun; after: GateRun;
  /** P2 · stored runs (any kind; only weekly, before and after runs older than the after run count) for the speed checks' history. */
  history?: readonly GateRun[];
  proposal: "open" | "accepted" | "declined" | null;
  live: LivingValues;
};
const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;
const where = (r: { page: string; width: number }) => `${REVIEW_PAGES.find(p => p.id === r.page)?.name ?? r.page} at ${r.width} px`;

/** Every check with its numbers, and pass only when every check that applies passes. */
export function gateVerdict(g: GateInput): { pass: boolean; checks: GateCheck[]; notCaused: NotCaused[] } {
  const named = new Map(GATE_CHECKS.map(c => [c.id, c.name] as const));
  const checks: GateCheck[] = [];
  const add = (id: GateCheckId, problems: string[], numbers: Record<string, unknown>, applies = true) => checks.push({ id, name: named.get(id)!, ok: !applies || problems.length === 0, applies, numbers, problems });
  // A test run never counts toward the gate; the same run cannot be both sides.
  const usable = (r: GateRun, side: string) => (r.kind === "test" ? { rows: [] as ReviewRow[], why: `The ${side} run “${r.run}” is a test run; a test run never counts toward the gate.` } : !r.rows.length ? { rows: [] as ReviewRow[], why: `There is no ${side} run named “${r.run}”.` } : { rows: [...r.rows], why: null });
  const b = usable(g.before, "before"), a = usable(g.after, "after");
  const same = g.before.run === g.after.run ? [`The before and after runs are the same run (“${g.after.run}”).`] : [];
  add("tests", g.tests.failed > 0 ? [`${g.tests.failed} tests failed.`] : [], { ...g.tests });
  const missing = a.rows.length ? missingCells(a.rows) : [];
  add("complete", [...(a.why ? [a.why] : []), ...same, ...missing.map(m => `${m} is missing from the after run.`)], { pages: REVIEW_PAGES.length, widths: REVIEW_WIDTHS.length, present: cellsOf(a.rows).size, missing: missing.length });
  const after = cellsOf(a.rows), before = cellsOf(b.rows);
  const ov: string[] = [], fb: string[] = [], worse: string[] = [], vis: string[] = [];
  let sideways = 0, slowest = 0, maxShare = 0, maxHeight = 0;
  for (const r of after.values()) {
    const m = r.measures;
    if (m.overflow_x === undefined) ov.push(`${where(r)}: sideways scrolling was not measured.`); else if (m.overflow_x) { sideways++; ov.push(`${where(r)} scrolls sideways.`); }
    if (m.first_byte_ms === undefined) fb.push(`${where(r)}: first byte was not measured.`);
    else slowest = Math.max(slowest, m.first_byte_ms);
    const prev = before.get(`${r.page}@${r.width}`);
    for (const k of NO_WORSE) {
      const x = prev?.measures[k], y = m[k];
      if (!prev) { if (b.rows.length) worse.push(`${where(r)} is missing from the before run.`); break; }
      if (typeof y === "number" && typeof x === "number" && y > x) worse.push(`${where(r)}: ${k.replace(/_/g, " ")} ${x} → ${y}.`);
      else if (typeof y === "number" && x === undefined) worse.push(`${where(r)}: ${k.replace(/_/g, " ")} was not measured before.`);
      else if (y === undefined && x !== undefined) worse.push(`${where(r)}: ${k.replace(/_/g, " ")} was not measured after.`);
    }
    const lim = VISIBLE_LIMITS[g.item.expects];
    if (lim) {
      const share = m.changed_share;
      if (share === undefined) vis.push(`${where(r)}: the share of changed pixels was not measured.`);
      else {
        maxShare = Math.max(maxShare, share);
        if (r.against !== g.before.run) vis.push(`${where(r)}: the changed share was measured against “${r.against ?? "no run"}”, not the before run “${g.before.run}”.`);
        if (share > lim.share) vis.push(`${where(r)}: ${pct(share)} of pixels changed, over ${pct(lim.share)}.`);
      }
      const h0 = prev?.measures.height_px, h1 = m.height_px;
      if (typeof h0 !== "number" || typeof h1 !== "number") vis.push(`${where(r)}: the height was not measured on both runs.`);
      else {
        const d = Math.abs(h1 - h0); maxHeight = Math.max(maxHeight, d);
        if (lim.heightPx != null && d > lim.heightPx) vis.push(`${where(r)}: height ${h0} → ${h1} px, more than ${lim.heightPx} px.`);
        if (lim.heightShare != null && h0 > 0 && d / h0 > lim.heightShare) vis.push(`${where(r)}: height ${h0} → ${h1} px, more than ${pct(lim.heightShare)}.`);
      }
    }
  }
  const noAfter = a.why ? [a.why] : [];
  add("overflow", [...noAfter, ...ov], { sideways });
  // P2 · the speed checks judge the after run against each page's own history, not the luck of one before load.
  const hist = g.history ?? [], beforeRun = b.rows.length ? g.before : null, afterRun = { ...g.after, rows: a.rows };
  const fbs = speedProblems(afterRun, hist, beforeRun, "first_byte_ms"), cls = speedProblems(afterRun, hist, beforeRun, "cls"), lcp = speedProblems(afterRun, hist, beforeRun, "lcp_ms");
  add("first_byte", [...noAfter, ...fb, ...fbs.problems], { target_ms: SPEED_TARGETS.firstMs, slowest_ms: Math.round(slowest), ...fbs.numbers });
  add("layout_shift", [...noAfter, ...cls.problems], cls.numbers);
  add("largest_paint", [...noAfter, ...lcp.problems], lcp.numbers);
  add("no_worse", [...noAfter, ...(b.why ? [b.why] : []), ...worse], { measures: NO_WORSE });
  const lim = VISIBLE_LIMITS[g.item.expects];
  add("visible", lim ? [...noAfter, ...(b.why ? [b.why] : []), ...vis] : [], { expects: g.item.expects, limit_share: lim?.share ?? null, limit_height_px: lim?.heightPx ?? null, limit_height_share: lim?.heightShare ?? null, max_share: maxShare, max_height_change_px: maxHeight });
  // L2 · a phase item needs no proposal (the owner's brief approved it), whatever it expects readers to see.
  const wantsProposal = g.item.kind !== "phase" && (g.item.expects === "layout" || needsProposal(g.item.kind));
  add("proposal", g.proposal === "accepted" ? [] : [`The owner has not accepted the item's proposal (${g.proposal ?? "none linked"}).`], { proposal: g.proposal }, wantsProposal);
  if (g.item.kind === "design move") {
    const mv = g.item.move;
    if (!mv) add("living", ["A design move must name its setting and value."], {});
    else {
      const move: Move = { setting: mv.setting, from: (mv.from ?? (isSettingId(mv.setting) ? g.live[mv.setting] : mv.to)) as Value, to: mv.to, signal: null, share: null, count: null, base: null, rule: null };
      const shot = (c: Map<string, ReviewRow>, p: string, w: number) => c.get(`${p}@${w}`)?.picture ?? "";
      const comparison = { made_at: "", pages: COMPARE_PAGES.flatMap(p => COMPARE_WIDTHS.map(w => ({ page: p.id, width: w, share: after.get(`${p.id}@${w}`)?.measures.changed_share ?? Number.NaN, before: shot(before, p.id, w), after: shot(after, p.id, w) }))) };
      // An edition carries three to five moves; one queue item is one move, so the edition's count check is left to the edition.
      const lg = livingGate(g.live, [move], comparison), used = lg.checks.filter(c => c.id !== "count");
      add("living", used.flatMap(c => c.problems), { checks: used.map(c => ({ id: c.id, ok: c.ok })), skipped: "count (an edition's three to five moves)" });
    }
  } else add("living", [], {}, false);
  return { pass: checks.every(c => c.ok), checks, notCaused: [...fbs.notCaused, ...cls.notCaused, ...lcp.notCaused] };
}
