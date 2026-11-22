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
/** The gate's checks, in the order they are run and shown. */
export const GATE_CHECKS = [
  { id: "tests", name: "No failed tests" },
  { id: "complete", name: "Every page and width of the review list is in the after run" },
  { id: "overflow", name: "No page scrolls sideways at any width" },
  { id: "first_byte", name: `First byte within ${SPEED_TARGETS.firstMs} ms on every page and width` },
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
  proposal: "open" | "accepted" | "declined" | null;
  live: LivingValues;
};
const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;
const where = (r: { page: string; width: number }) => `${REVIEW_PAGES.find(p => p.id === r.page)?.name ?? r.page} at ${r.width} px`;

/** Every check with its numbers, and pass only when every check that applies passes. */
export function gateVerdict(g: GateInput): { pass: boolean; checks: GateCheck[] } {
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
    else { slowest = Math.max(slowest, m.first_byte_ms); if (m.first_byte_ms > SPEED_TARGETS.firstMs) fb.push(`${where(r)}: first byte ${Math.round(m.first_byte_ms)} ms, over ${SPEED_TARGETS.firstMs} ms.`); }
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
  add("first_byte", [...noAfter, ...fb], { target_ms: SPEED_TARGETS.firstMs, slowest_ms: Math.round(slowest) });
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
  return { pass: checks.every(c => c.ok), checks };
}
